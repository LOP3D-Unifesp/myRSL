import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { sanitizeArticleWriteInput, type ArticleWriteInput } from "@/lib/article-schemas";
import { buildArticlesWorkbookArrayBuffer, createArticlesExportFileName } from "@/lib/articles-export";

export type Article = Database["public"]["Tables"]["articles"]["Row"];
export type ArticleInsert = Omit<Article, "id" | "created_at" | "updated_at">;

export type ArticleListItem = Pick<
  Article,
  "id" | "title" | "author" | "first_author" | "study_id" | "country" | "prosthesis_name" | "year" | "is_draft" | "created_at"
>;

export type VerificationListItem = Pick<
  Article,
  "id" | "title" | "author" | "year" | "country" | "verify_peer1" | "verify_peer2" | "verify_qa3" | "verify_qa4" | "qa_score"
>;

export type DoiSyncReviewField = "doi" | "title" | "year" | "author" | "first_author" | "last_author" | "abstract";
export type DoiReviewSnapshot = Pick<Article, DoiSyncReviewField>;

type CrossrefWork = {
  DOI?: string;
  title?: string[];
  abstract?: string;
  author?: Array<{ given?: string; family?: string; name?: string }>;
  issued?: { "date-parts"?: number[][] };
  published?: { "date-parts"?: number[][] };
  "published-print"?: { "date-parts"?: number[][] };
  "published-online"?: { "date-parts"?: number[][] };
  created?: { "date-parts"?: number[][] };
};

export type MetadataSyncConflict = {
  articleId: string;
  field: DoiSyncReviewField;
  currentValue: string;
  suggestedValue: string;
};

export type MetadataConflictArticle = {
  articleId: string;
  studyId?: string | null;
  doiCurrent?: string | null;
  doiSuggested?: string | null;
  titleCurrent?: string | null;
  current: DoiReviewSnapshot;
  suggested: DoiReviewSnapshot;
  fields: Array<{
    field: DoiSyncReviewField;
    currentValue: string;
    suggestedValue: string;
  }>;
};

export type MetadataSyncSummary = {
  processed: number;
  updated_safe: number;
  unchanged: number;
  missing_source: number;
  failed: number;
  conflict_articles: number;
  conflict_fields: number;
};

export type MetadataSyncResult = {
  summary: MetadataSyncSummary;
  conflictQueue: MetadataConflictArticle[];
  updated: number;
  unchanged: number;
  missing_source: number;
  failed: number;
  conflict_articles: number;
  conflict_fields: number;
  conflicts_count: number;
  conflicts: MetadataSyncConflict[];
};

type SyncOptions = {
  articleIds?: string[];
  includeAbstract?: boolean;
  limit?: number;
};

export async function fetchArticles() {
  const { data, error } = await supabase.from("articles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Article[];
}

export async function exportCurrentUserArticlesToExcel() {
  const articles = await fetchArticles();
  const workbookArrayBuffer = buildArticlesWorkbookArrayBuffer(articles);
  const fileName = createArticlesExportFileName();
  const blob = new Blob([workbookArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return { fileName, count: articles.length };
}

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function extractYearFromWork(work: CrossrefWork): number | null {
  const candidates = [
    work.issued?.["date-parts"]?.[0]?.[0],
    work["published-print"]?.["date-parts"]?.[0]?.[0],
    work["published-online"]?.["date-parts"]?.[0]?.[0],
    work.published?.["date-parts"]?.[0]?.[0],
    work.created?.["date-parts"]?.[0]?.[0],
  ];
  for (const year of candidates) {
    if (typeof year === "number" && Number.isInteger(year) && year >= 1800 && year <= 2100) {
      return year;
    }
  }
  return null;
}

function cleanAbstract(value: string | undefined): string | null {
  if (!value) return null;
  const withoutTags = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return withoutTags.length > 0 ? withoutTags : null;
}

function parseAuthors(work: CrossrefWork): { author: string | null; firstAuthor: string | null; lastAuthor: string | null } {
  const authorEntries = Array.isArray(work.author) ? work.author : [];
  const names = authorEntries
    .map((entry) => {
      if (typeof entry.name === "string" && entry.name.trim()) return entry.name.trim();
      const parts = [entry.given?.trim(), entry.family?.trim()].filter(Boolean);
      return parts.join(" ").trim();
    })
    .filter((name) => Boolean(name));

  if (names.length === 0) return { author: null, firstAuthor: null, lastAuthor: null };
  return {
    author: names.join("; "),
    firstAuthor: names[0] ?? null,
    lastAuthor: names[names.length - 1] ?? null,
  };
}

async function fetchDoiByTitle(title: string): Promise<string | null> {
  const response = await fetch(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(title)}&rows=1`, {
    headers: { "User-Agent": "SysReview/1.0 (mailto:admin@example.com)" },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const doi = data?.message?.items?.[0]?.DOI;
  return typeof doi === "string" && doi.length > 0 ? doi : null;
}

async function fetchCrossrefWorkByDoi(doi: string): Promise<CrossrefWork | null> {
  const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: { "User-Agent": "SysReview/1.0 (mailto:admin@example.com)" },
  });
  if (!response.ok) return null;
  const data = await response.json();
  return (data?.message ?? null) as CrossrefWork | null;
}

function asConflictString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return String(value);
}

function maybeSetField(
  articleId: string,
  field: DoiSyncReviewField,
  current: string | number | null,
  suggested: string | number | null,
  updatePayload: Partial<ArticleInsert>,
  conflicts: MetadataSyncConflict[],
) {
  if (suggested == null) return;

  if (typeof suggested === "number") {
    if (current == null) {
      updatePayload[field] = suggested as never;
      return;
    }
    if (typeof current === "number" && current === suggested) return;
    conflicts.push({
      articleId,
      field,
      currentValue: asConflictString(current),
      suggestedValue: String(suggested),
    });
    return;
  }

  const suggestedTrimmed = suggested.trim();
  if (!suggestedTrimmed) return;

  const currentString = typeof current === "number" ? String(current) : current;
  if (isBlank(currentString ?? null)) {
    updatePayload[field] = suggestedTrimmed as never;
    return;
  }
  if (normalizeText(currentString ?? "") === normalizeText(suggestedTrimmed)) return;
  conflicts.push({
    articleId,
    field,
    currentValue: asConflictString(currentString),
    suggestedValue: suggestedTrimmed,
  });
}

export async function syncCurrentUserDoiMetadata(options: SyncOptions = {}): Promise<MetadataSyncResult> {
  const includeAbstract = options.includeAbstract ?? true;
  const limit = options.limit ?? 200;
  const allArticles = await fetchArticles();
  const scopedByIds = options.articleIds?.length
    ? allArticles.filter((article) => options.articleIds?.includes(article.id))
    : allArticles;

  const candidates = scopedByIds
    .filter((article) => !isBlank(article.doi) || !isBlank(article.title))
    .slice(0, limit);

  let updatedSafe = 0;
  let unchanged = 0;
  let failed = 0;
  let missingSource = 0;
  const conflicts: MetadataSyncConflict[] = [];
  const conflictQueue: MetadataConflictArticle[] = [];

  for (const article of candidates) {
    try {
      let resolvedDoi = article.doi;
      if (isBlank(resolvedDoi) && !isBlank(article.title)) {
        resolvedDoi = await fetchDoiByTitle(article.title!);
      }

      if (isBlank(resolvedDoi)) {
        missingSource += 1;
        continue;
      }

      const work = await fetchCrossrefWorkByDoi(resolvedDoi!);
      if (!work) {
        missingSource += 1;
        continue;
      }

      const currentSnapshot: DoiReviewSnapshot = {
        doi: article.doi,
        title: article.title,
        year: article.year,
        author: article.author,
        first_author: article.first_author,
        last_author: article.last_author,
        abstract: article.abstract,
      };
      const suggestedSnapshot: DoiReviewSnapshot = {
        doi: resolvedDoi ?? null,
        title: work.title?.[0] ?? null,
        year: extractYearFromWork(work),
        author: null,
        first_author: null,
        last_author: null,
        abstract: includeAbstract ? cleanAbstract(work.abstract) : null,
      };
      const parsedAuthors = parseAuthors(work);
      suggestedSnapshot.author = parsedAuthors.author;
      suggestedSnapshot.first_author = parsedAuthors.firstAuthor;
      suggestedSnapshot.last_author = parsedAuthors.lastAuthor;

      const updatePayload: Partial<ArticleInsert> = {};
      const conflictStart = conflicts.length;
      maybeSetField(article.id, "doi", article.doi, suggestedSnapshot.doi, updatePayload, conflicts);
      maybeSetField(article.id, "title", article.title, suggestedSnapshot.title, updatePayload, conflicts);
      maybeSetField(article.id, "year", article.year, suggestedSnapshot.year, updatePayload, conflicts);
      maybeSetField(article.id, "author", article.author, suggestedSnapshot.author, updatePayload, conflicts);
      maybeSetField(article.id, "first_author", article.first_author, suggestedSnapshot.first_author, updatePayload, conflicts);
      maybeSetField(article.id, "last_author", article.last_author, suggestedSnapshot.last_author, updatePayload, conflicts);
      if (includeAbstract) maybeSetField(article.id, "abstract", article.abstract, suggestedSnapshot.abstract, updatePayload, conflicts);

      const articleConflicts = conflicts.slice(conflictStart);
      if (articleConflicts.length > 0) {
        conflictQueue.push({
          articleId: article.id,
          studyId: article.study_id,
          doiCurrent: article.doi,
          doiSuggested: suggestedSnapshot.doi,
          titleCurrent: article.title,
          current: currentSnapshot,
          suggested: suggestedSnapshot,
          fields: articleConflicts.map((conflict) => ({
            field: conflict.field,
            currentValue: conflict.currentValue,
            suggestedValue: conflict.suggestedValue,
          })),
        });
      }

      if (Object.keys(updatePayload).length === 0) {
        unchanged += 1;
        continue;
      }

      await updateArticle(article.id, updatePayload);
      updatedSafe += 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch {
      failed += 1;
    }
  }

  const summary: MetadataSyncSummary = {
    processed: candidates.length,
    updated_safe: updatedSafe,
    unchanged,
    missing_source: missingSource,
    failed,
    conflict_articles: conflictQueue.length,
    conflict_fields: conflicts.length,
  };

  return {
    summary,
    conflictQueue,
    updated: updatedSafe,
    unchanged,
    missing_source: missingSource,
    failed,
    conflict_articles: conflictQueue.length,
    conflict_fields: conflicts.length,
    conflicts_count: conflicts.length,
    conflicts: conflicts.slice(0, 100),
  };
}

export async function fetchArticle(id: string) {
  const { data, error } = await supabase.from("articles").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Article;
}

export async function fetchArticleSummaries() {
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,author,first_author,study_id,country,prosthesis_name,year,is_draft,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ArticleListItem[];
}

export async function fetchVerificationSummaries() {
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,author,year,country,verify_peer1,verify_peer2,verify_qa3,verify_qa4,qa_score")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as VerificationListItem[];
}

export async function fetchArticlesPage(page: number, pageSize: number, search: string) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("articles")
    .select("id,title,author,first_author,study_id,country,prosthesis_name,year,is_draft,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const term = search.trim();
  if (term) {
    const escaped = term.replaceAll("%", "\\%");
    query = query.or(
      `author.ilike.%${escaped}%,first_author.ilike.%${escaped}%,title.ilike.%${escaped}%,study_id.ilike.%${escaped}%,country.ilike.%${escaped}%,prosthesis_name.ilike.%${escaped}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    data: (data ?? []) as ArticleListItem[],
    count: count ?? 0,
  };
}

export async function createArticle(article: Partial<ArticleInsert>) {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) throw new Error("Not authenticated");

  const sanitized: ArticleWriteInput = sanitizeArticleWriteInput(article);
  const payload: Database["public"]["Tables"]["articles"]["Insert"] = {
    ...sanitized,
    user_id: user.id,
  };

  const { data, error } = await supabase.from("articles").insert(payload).select().single();
  if (error) throw error;
  return data as Article;
}

export async function updateArticle(id: string, article: Partial<ArticleInsert>) {
  const sanitized: ArticleWriteInput = sanitizeArticleWriteInput(article);
  const payload: Database["public"]["Tables"]["articles"]["Update"] = sanitized;
  const { data, error } = await supabase.from("articles").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data as Article;
}

export async function deleteArticle(id: string) {
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) throw error;
}
