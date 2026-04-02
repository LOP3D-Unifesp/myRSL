import * as XLSX from "xlsx";
import type { Database } from "@/integrations/supabase/types";

type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];

type ExportColumn = {
  key: keyof ArticleRow;
  header: string;
};

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "id", header: "id" },
  { key: "user_id", header: "user_id" },
  { key: "created_at", header: "created_at" },
  { key: "updated_at", header: "updated_at" },
  { key: "is_draft", header: "is_draft" },
  { key: "review_status", header: "review_status" },
  { key: "pdf_url", header: "pdf_url" },
  { key: "doi", header: "doi" },
  { key: "title", header: "title" },
  { key: "abstract", header: "abstract" },
  { key: "study_id", header: "study_id" },
  { key: "author", header: "author" },
  { key: "first_author", header: "first_author" },
  { key: "last_author", header: "last_author" },
  { key: "universities", header: "universities" },
  { key: "publication_place", header: "publication_place" },
  { key: "year", header: "year" },
  { key: "country", header: "country" },
  { key: "publication_type", header: "publication_type" },
  { key: "study_design", header: "study_design" },
  { key: "has_pediatric_participants", header: "has_pediatric_participants" },
  { key: "sample_size", header: "sample_size" },
  { key: "age_range", header: "age_range" },
  { key: "amputation_cause", header: "amputation_cause" },
  { key: "amputation_level", header: "amputation_level" },
  { key: "pediatric_approach", header: "pediatric_approach" },
  { key: "prosthesis_name", header: "prosthesis_name" },
  { key: "prosthesis_level", header: "prosthesis_level" },
  { key: "dof", header: "dof" },
  { key: "control_strategy", header: "control_strategy" },
  { key: "sensors", header: "sensors" },
  { key: "sensors_used", header: "sensors_used" },
  { key: "technical_innovation", header: "technical_innovation" },
  { key: "feedback_modalities", header: "feedback_modalities" },
  { key: "feedback_modalities_text", header: "feedback_modalities_text" },
  { key: "manufacturing_method", header: "manufacturing_method" },
  { key: "growth_accommodation", header: "growth_accommodation" },
  { key: "setting", header: "setting" },
  { key: "functional_tests", header: "functional_tests" },
  { key: "statistical_tests_performed", header: "statistical_tests_performed" },
  { key: "statistical_tests_specified", header: "statistical_tests_specified" },
  { key: "quantitative_results", header: "quantitative_results" },
  { key: "usage_outcomes", header: "usage_outcomes" },
  { key: "gaps", header: "gaps" },
  { key: "technical_challenges", header: "technical_challenges" },
  { key: "primary_research_question", header: "primary_research_question" },
  { key: "research_questions", header: "research_questions" },
  { key: "verify_peer1", header: "verify_peer1" },
  { key: "verify_peer2", header: "verify_peer2" },
  { key: "verify_qa3", header: "verify_qa3" },
  { key: "verify_qa4", header: "verify_qa4" },
  { key: "qa_q1", header: "qa_q1" },
  { key: "qa_q2", header: "qa_q2" },
  { key: "qa_q3", header: "qa_q3" },
  { key: "qa_q4", header: "qa_q4" },
  { key: "qa_q5", header: "qa_q5" },
  { key: "qa_q6", header: "qa_q6" },
  { key: "qa_q7", header: "qa_q7" },
  { key: "qa_q8", header: "qa_q8" },
  { key: "qa_q9", header: "qa_q9" },
  { key: "qa_q10", header: "qa_q10" },
  { key: "qa_score", header: "qa_score" },
  { key: "q1", header: "q1" },
  { key: "q2", header: "q2" },
  { key: "q3", header: "q3" },
  { key: "q4", header: "q4" },
  { key: "q5", header: "q5" },
];

export const ARTICLE_EXPORT_HEADERS = EXPORT_COLUMNS.map((column) => column.header);

function deriveFirstAuthorFromAuthors(authors: string | null): string {
  if (!authors) return "";
  const first = authors
    .split(";")
    .map((item) => item.trim())
    .find(Boolean);
  return first ?? "";
}

function normalizeValue(value: ArticleRow[keyof ArticleRow]): string | number | boolean {
  if (Array.isArray(value)) return value.join("; ");
  if (value == null) return "";
  return value;
}

export function mapArticleToExportRow(article: ArticleRow): Record<string, string | number | boolean> {
  const row: Record<string, string | number | boolean> = {};
  for (const column of EXPORT_COLUMNS) {
    if (column.key === "first_author") {
      const firstAuthorValue = article.first_author ?? deriveFirstAuthorFromAuthors(article.author);
      row[column.header] = normalizeValue(firstAuthorValue);
      continue;
    }
    row[column.header] = normalizeValue(article[column.key]);
  }
  return row;
}

export function buildArticlesSheetRows(articles: ArticleRow[]): Array<Record<string, string | number | boolean>> {
  return articles.map(mapArticleToExportRow);
}

function buildColumnWidths(headers: string[], rows: Array<Record<string, string | number | boolean>>) {
  return headers.map((header) => {
    const maxValueLength = rows.reduce((max, row) => {
      const value = row[header];
      return Math.max(max, String(value ?? "").length);
    }, header.length);
    return { wch: Math.min(60, Math.max(12, maxValueLength + 2)) };
  });
}

export function buildArticlesWorkbookArrayBuffer(articles: ArticleRow[]): ArrayBuffer {
  const rows = buildArticlesSheetRows(articles);
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: ARTICLE_EXPORT_HEADERS });
  worksheet["!cols"] = buildColumnWidths(ARTICLE_EXPORT_HEADERS, rows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Articles");

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;
}

export function createArticlesExportFileName(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `articles-export-${year}${month}${day}-${hour}${minute}.xlsx`;
}
