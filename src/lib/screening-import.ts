import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { inActiveReview } from "@/lib/articles";
import { requireActiveReviewId } from "@/lib/active-review";
import { fetchScreeningRecords, type ScreeningStatus } from "@/lib/screening";

type RecordInsert = Database["public"]["Tables"]["screening_records"]["Insert"];

export type ParsifalImportRow = {
  rowNumber: number;
  record: Omit<RecordInsert, "review_id">;
};

export type ParsifalImportPreview = {
  fileName: string;
  totalRows: number;
  rows: ParsifalImportRow[];
  invalid: Array<{ rowNumber: number; reason: string }>;
  unmatchedCriteria: string[];
};

export type ParsifalImportResult = { inserted: number; updated: number; linked: number; failed: number };

const SOURCE_ALIASES: Record<string, string> = {
  "acm digital library": "ACM",
  "ieee digital library": "IEEE",
  "ieee xplore": "IEEE",
  pubmed: "PubMed",
  scopus: "Scopus",
};

const STATUS_ALIASES: Record<string, ScreeningStatus> = {
  accepted: "accepted",
  rejected: "rejected",
  duplicated: "duplicate",
  duplicate: "duplicate",
  unclassified: "unclassified",
};

const text = (value: unknown): string => (value == null ? "" : String(value).trim());
const orNull = (value: unknown): string | null => text(value) || null;
const squash = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

export function normalizeDoi(value: unknown): string | null {
  const cleaned = text(value)
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "");
  return cleaned || null;
}

export function normalizeSource(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  return SOURCE_ALIASES[raw.toLowerCase()] ?? raw;
}

// Parsifal stores the criterion as its full text; the protocol knows it by code.
export function matchCriterionCode(criterionText: string, criteria: Array<{ code: string; text: string }>): string | null {
  const wanted = squash(criterionText);
  if (!wanted) return null;
  return criteria.find((item) => squash(item.text) === wanted)?.code ?? null;
}

export function mapParsifalRows(
  rawRows: Array<Record<string, unknown>>,
  criteria: Array<{ code: string; text: string }>,
): Pick<ParsifalImportPreview, "rows" | "invalid" | "unmatchedCriteria"> {
  const rows: ParsifalImportRow[] = [];
  const invalid: ParsifalImportPreview["invalid"] = [];
  const unmatched = new Set<string>();

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2;
    const title = orNull(raw.title);
    const doi = normalizeDoi(raw.doi);
    if (!title && !doi) {
      invalid.push({ rowNumber, reason: "Row has neither a title nor a DOI." });
      return;
    }

    const statusRaw = text(raw.status).toLowerCase();
    const status = STATUS_ALIASES[statusRaw] ?? "unclassified";
    const criterionText = text(raw.selection_criteria);
    const criterionCode = matchCriterionCode(criterionText, criteria);
    if (criterionText && !criterionCode) unmatched.add(criterionText);

    const yearNumber = Number(text(raw.year));
    rows.push({
      rowNumber,
      record: {
        source_database: normalizeSource(raw.source),
        title,
        authors: orNull(raw.author),
        journal: orNull(raw.journal),
        year: Number.isInteger(yearNumber) && yearNumber > 1000 ? yearNumber : null,
        doi,
        url: orNull(raw.url),
        abstract: orNull(raw.abstract),
        keywords: orNull(raw.keywords),
        document_type: orNull(raw.document_type),
        status,
        criterion_code: criterionCode,
        comments: orNull(raw.comments),
      },
    });
  });

  return { rows, invalid, unmatchedCriteria: Array.from(unmatched) };
}

export async function previewParsifalImport(file: File, criteria: Array<{ code: string; text: string }>): Promise<ParsifalImportPreview> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The file has no sheets.");

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { raw: true, defval: null, blankrows: false });
  const headers = Object.keys(rawRows[0] ?? {});
  if (!headers.includes("title") || !headers.includes("status")) {
    throw new Error("This does not look like a Parsifal export (columns title and status are required).");
  }

  return { fileName: file.name, totalRows: rawRows.length, ...mapParsifalRows(rawRows, criteria) };
}

const keyFor = (source: string | null, doi: string | null, title: string | null) =>
  `${(source ?? "").toLowerCase()}|${doi ?? `t:${squash(title ?? "")}`}`;

// Existing records with the same source and DOI (or title when there is no DOI) are updated, never duplicated.
export async function executeParsifalImport(preview: ParsifalImportPreview): Promise<ParsifalImportResult> {
  const reviewId = requireActiveReviewId();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id ?? null;

  const existing = await fetchScreeningRecords();
  const existingByKey = new Map(existing.map((item) => [keyFor(item.source_database, normalizeDoi(item.doi), item.title), item.id]));

  const { data: articles, error: articlesError } = await inActiveReview(supabase.from("articles").select("id,doi"));
  if (articlesError) throw articlesError;
  const articleByDoi = new Map<string, string>();
  for (const article of articles ?? []) {
    const doi = normalizeDoi(article.doi);
    if (doi) articleByDoi.set(doi, article.id);
  }

  let inserted = 0;
  let updated = 0;
  let linked = 0;
  let failed = 0;
  const toInsert: RecordInsert[] = [];
  const now = new Date().toISOString();

  for (const { record } of preview.rows) {
    const articleId = record.doi ? articleByDoi.get(record.doi) ?? null : null;
    const decided = record.status !== "unclassified";
    const payload = {
      ...record,
      article_id: articleId,
      ...(decided ? { screened_by: userId, screened_at: now } : {}),
    };
    if (articleId) linked += 1;

    const id = existingByKey.get(keyFor(record.source_database ?? null, record.doi ?? null, record.title ?? null));
    if (id) {
      const { error } = await supabase.from("screening_records").update(payload).eq("id", id);
      if (error) failed += 1;
      else updated += 1;
    } else {
      toInsert.push({ ...payload, review_id: reviewId });
    }
  }

  for (let start = 0; start < toInsert.length; start += 100) {
    const chunk = toInsert.slice(start, start + 100);
    const { error } = await supabase.from("screening_records").insert(chunk);
    if (error) failed += chunk.length;
    else inserted += chunk.length;
  }

  return { inserted, updated, linked, failed };
}
