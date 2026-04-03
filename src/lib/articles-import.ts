import * as XLSX from "xlsx";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeArticleWriteInput, type ArticleWriteInput } from "@/lib/article-schemas";
import { ARTICLE_EXPORT_HEADERS } from "@/lib/articles-export";

type ExistingIdentifierRow = Pick<Database["public"]["Tables"]["articles"]["Row"], "doi" | "study_id">;

type DedupeField = "doi" | "study_id";

const ARRAY_FIELDS: Array<keyof ArticleWriteInput> = [
  "amputation_cause",
  "amputation_level",
  "control_strategy",
  "sensors",
  "feedback_modalities",
  "setting",
  "functional_tests",
  "research_questions",
];

const BOOLEAN_FIELDS: Array<keyof ArticleWriteInput> = ["is_draft", "verify_peer1", "verify_peer2", "verify_qa3", "verify_qa4"];
const INTEGER_FIELDS: Array<keyof ArticleWriteInput> = ["year", "sample_size"];
const NUMBER_FIELDS: Array<keyof ArticleWriteInput> = ["qa_score"];

const IGNORED_IMPORT_FIELDS = new Set(["id", "user_id", "created_at", "updated_at", "pdf_url"]);

type ImportInsertPayload = Omit<
  Database["public"]["Tables"]["articles"]["Insert"],
  "id" | "user_id" | "created_at" | "updated_at" | "pdf_url"
>;

export type ImportPreparedRow = {
  rowNumber: number;
  payload: ImportInsertPayload;
  duplicateField: DedupeField | null;
  duplicateValue: string | null;
};

export type ImportRowIssue = {
  rowNumber: number;
  reason: string;
};

export type DuplicateCandidate = {
  rowNumber: number;
  duplicateField: DedupeField;
  duplicateValue: string;
};

export type ImportPreview = {
  fileName: string;
  totalRows: number;
  validRows: ImportPreparedRow[];
  possibleDuplicateRows: ImportPreparedRow[];
  duplicateInFileRows: ImportPreparedRow[];
  invalidRows: ImportRowIssue[];
  duplicateCandidates: DuplicateCandidate[];
};

export type ImportExecutionMode = "skip_duplicates" | "import_all_duplicates";

export type ImportExecutionFailure = {
  rowNumber: number;
  message: string;
};

export type ImportResult = {
  attempted: number;
  imported: number;
  skippedDuplicates: number;
  invalid: number;
  failed: number;
  failures: ImportExecutionFailure[];
};

function toTrimmedString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeDoi(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/i, "");
  return cleaned;
}

function parseArrayField(value: unknown): string[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const items = value.map((item) => toTrimmedString(item)).filter(Boolean);
    return items.length > 0 ? items : null;
  }
  const text = toTrimmedString(value);
  if (!text) return null;
  const items = text
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

function parseBooleanField(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }
  const text = toTrimmedString(value).toLowerCase();
  if (!text) return undefined;
  if (["true", "1", "yes", "y", "sim", "s"].includes(text)) return true;
  if (["false", "0", "no", "n", "nao", "não"].includes(text)) return false;
  return undefined;
}

function parseNumber(value: unknown): number | null | undefined {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  const text = toTrimmedString(value);
  if (!text) return null;
  const normalized = text.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInteger(value: unknown): number | null | undefined {
  const parsed = parseNumber(value);
  if (parsed == null) return parsed;
  return Number.isInteger(parsed) ? parsed : undefined;
}

function normalizeRawRow(raw: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const header of ARTICLE_EXPORT_HEADERS) {
    if (IGNORED_IMPORT_FIELDS.has(header)) continue;

    const value = raw[header];

    if (ARRAY_FIELDS.includes(header as keyof ArticleWriteInput)) {
      normalized[header] = parseArrayField(value);
      continue;
    }

    if (BOOLEAN_FIELDS.includes(header as keyof ArticleWriteInput)) {
      normalized[header] = parseBooleanField(value);
      continue;
    }

    if (INTEGER_FIELDS.includes(header as keyof ArticleWriteInput)) {
      normalized[header] = parseInteger(value);
      continue;
    }

    if (NUMBER_FIELDS.includes(header as keyof ArticleWriteInput)) {
      normalized[header] = parseNumber(value);
      continue;
    }

    const text = toTrimmedString(value);
    normalized[header] = text ? text : null;
  }

  return normalized;
}

function getDuplicateInfo(payload: ImportInsertPayload): { field: DedupeField; value: string } | null {
  const doi = typeof payload.doi === "string" ? normalizeDoi(payload.doi) : "";
  if (doi) return { field: "doi", value: doi };

  const studyId = typeof payload.study_id === "string" ? payload.study_id.trim().toLowerCase() : "";
  if (studyId) return { field: "study_id", value: studyId };

  return null;
}

function hasAnyMeaningfulValue(payload: ImportInsertPayload): boolean {
  return Object.values(payload).some((value) => {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });
}

function zodErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues?: unknown[] }).issues)) {
    const issue = (error as { issues: Array<{ path?: unknown[]; message?: string }> }).issues[0];
    const path = Array.isArray(issue?.path) && issue.path.length > 0 ? String(issue.path[0]) : "row";
    const message = issue?.message ?? "Invalid value";
    return `${path}: ${message}`;
  }
  if (error instanceof Error) return error.message;
  return "Invalid row format";
}

async function fetchExistingIdentifiers(): Promise<{ doi: Set<string>; studyId: Set<string> }> {
  const { data, error } = await supabase.from("articles").select("doi,study_id");
  if (error) throw error;

  const rows = (data ?? []) as ExistingIdentifierRow[];
  const doi = new Set<string>();
  const studyId = new Set<string>();

  for (const row of rows) {
    if (row.doi) {
      const normalized = normalizeDoi(row.doi);
      if (normalized) doi.add(normalized);
    }
    if (row.study_id) {
      const normalized = row.study_id.trim().toLowerCase();
      if (normalized) studyId.add(normalized);
    }
  }

  return { doi, studyId };
}

async function readFileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("Failed to read Excel file."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read Excel file."));
    reader.readAsArrayBuffer(file);
  });
}

export async function previewArticlesExcelImport(file: File): Promise<ImportPreview> {
  const arrayBuffer = await readFileToArrayBuffer(file);
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("Excel file has no sheets.");

  const worksheet = workbook.Sheets[firstSheetName];
  const headerRows = XLSX.utils.sheet_to_json<Array<unknown>>(worksheet, { header: 1, blankrows: false });
  const headers = (headerRows[0] ?? []).map((value) => toTrimmedString(value));
  const recognizedHeaders = headers.filter((header) => ARTICLE_EXPORT_HEADERS.includes(header));

  if (recognizedHeaders.length < 5) {
    throw new Error("Invalid import file format. Use an Excel file generated by Export Excel.");
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    raw: true,
    defval: null,
    blankrows: false,
  });

  const existing = await fetchExistingIdentifiers();
  const seenInFile = new Set<string>();

  const validRows: ImportPreparedRow[] = [];
  const possibleDuplicateRows: ImportPreparedRow[] = [];
  const duplicateInFileRows: ImportPreparedRow[] = [];
  const invalidRows: ImportRowIssue[] = [];
  const duplicateCandidates: DuplicateCandidate[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const normalized = normalizeRawRow(rawRow);
    let payload: ImportInsertPayload;

    try {
      payload = sanitizeArticleWriteInput(normalized) as ImportInsertPayload;
    } catch (error) {
      invalidRows.push({ rowNumber, reason: zodErrorMessage(error) });
      return;
    }

    if (!hasAnyMeaningfulValue(payload)) {
      invalidRows.push({ rowNumber, reason: "Row has no importable values." });
      return;
    }

    const duplicateInfo = getDuplicateInfo(payload);
    const prepared: ImportPreparedRow = {
      rowNumber,
      payload,
      duplicateField: duplicateInfo?.field ?? null,
      duplicateValue: duplicateInfo?.value ?? null,
    };

    if (!duplicateInfo) {
      validRows.push(prepared);
      return;
    }

    const key = `${duplicateInfo.field}:${duplicateInfo.value}`;
    if (seenInFile.has(key)) {
      duplicateInFileRows.push(prepared);
      duplicateCandidates.push({
        rowNumber,
        duplicateField: duplicateInfo.field,
        duplicateValue: duplicateInfo.value,
      });
      return;
    }
    seenInFile.add(key);

    const existsInDatabase = duplicateInfo.field === "doi"
      ? existing.doi.has(duplicateInfo.value)
      : existing.studyId.has(duplicateInfo.value);

    if (existsInDatabase) {
      possibleDuplicateRows.push(prepared);
      duplicateCandidates.push({
        rowNumber,
        duplicateField: duplicateInfo.field,
        duplicateValue: duplicateInfo.value,
      });
      return;
    }

    validRows.push(prepared);
  });

  return {
    fileName: file.name,
    totalRows: rawRows.length,
    validRows,
    possibleDuplicateRows,
    duplicateInFileRows,
    invalidRows,
    duplicateCandidates,
  };
}

export async function executeArticlesExcelImport(preview: ImportPreview, mode: ImportExecutionMode = "skip_duplicates"): Promise<ImportResult> {
  const rowsToInsert = mode === "import_all_duplicates"
    ? [...preview.validRows, ...preview.possibleDuplicateRows, ...preview.duplicateInFileRows]
    : [...preview.validRows];

  rowsToInsert.sort((a, b) => a.rowNumber - b.rowNumber);

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) throw new Error("Not authenticated");

  let imported = 0;
  const failures: ImportExecutionFailure[] = [];

  for (const row of rowsToInsert) {
    const { error } = await supabase.from("articles").insert({
      ...row.payload,
      user_id: user.id,
    });
    if (error) {
      failures.push({
        rowNumber: row.rowNumber,
        message: error.message,
      });
      continue;
    }
    imported += 1;
  }

  const skippedDuplicates = mode === "skip_duplicates"
    ? preview.possibleDuplicateRows.length + preview.duplicateInFileRows.length
    : 0;

  return {
    attempted: rowsToInsert.length,
    imported,
    skippedDuplicates,
    invalid: preview.invalidRows.length,
    failed: failures.length,
    failures,
  };
}
