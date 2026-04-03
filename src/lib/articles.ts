import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { sanitizeArticleWriteInput, type ArticleWriteInput } from "@/lib/article-schemas";
import { buildArticlesWorkbookArrayBuffer, createArticlesExportFileName } from "@/lib/articles-export";
import { VERIFICATION_KEYS, type VerificationKey } from "@/lib/article-verification";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  (import.meta.env.VITE_SUPABASE_PROJECT_ID ? `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co` : "");
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

export type Article = Database["public"]["Tables"]["articles"]["Row"];
export type ArticleInsert = Omit<Article, "id" | "created_at" | "updated_at">;

export type ArticleListItem = Pick<
  Article,
  | "id"
  | "title"
  | "author"
  | "first_author"
  | "study_id"
  | "country"
  | "prosthesis_name"
  | "year"
  | "is_draft"
  | "created_at"
  | "updated_at"
  | "verify_peer1"
  | "verify_peer2"
  | "verify_qa3"
  | "verify_qa4"
  | "qa_score"
>;

export type VerificationListItem = Pick<
  Article,
  "id" | "title" | "author" | "year" | "country" | "verify_peer1" | "verify_peer2" | "verify_qa3" | "verify_qa4" | "qa_score"
>;

export type ArticleListSort = "recent_desc" | "year_desc" | "year_asc" | "qa_desc" | "qa_asc";
export type ArticleListStatus = "all" | "verified" | "pending" | "draft";
export type ArticleListVerificationFilter = VerificationKey;

export type FetchArticlesPageParams = {
  page: number;
  pageSize: number;
  search: string;
  country?: string;
  yearFrom?: number | null;
  yearTo?: number | null;
  qaMin?: number | null;
  qaMax?: number | null;
  status?: ArticleListStatus;
  verificationFilters?: ArticleListVerificationFilter[];
  sort?: ArticleListSort;
};

export type DoiSyncReviewField = "doi" | "title" | "year" | "author" | "first_author" | "last_author" | "abstract";
export type DoiReviewSnapshot = Pick<Article, DoiSyncReviewField>;

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

type SyncInvokePayload = {
  summary?: MetadataSyncSummary;
  conflictQueue?: MetadataConflictArticle[];
  processed?: number;
  updated?: number;
  unchanged?: number;
  missing_source?: number;
  failed?: number;
  conflict_articles?: number;
  conflict_fields?: number;
  conflicts_count?: number;
  conflicts?: MetadataSyncConflict[];
  error?: string;
  code?: string;
};

type FunctionInvokeError = {
  message?: string;
  context?: Response;
  status?: number;
};

async function getFreshAccessToken(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error("Unable to validate your session. Please sign in again.");
  }

  let session = sessionData.session;
  if (!session?.access_token) {
    throw new Error("Your session is invalid or expired. Please sign in again and retry DOI sync.");
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at ?? 0;
  if (expiresAt <= nowInSeconds + 30) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      throw new Error("Your session is invalid or expired. Please sign in again and retry DOI sync.");
    }
    session = refreshed.session;
  }

  return session.access_token;
}

function isUnauthorizedSyncError(error: unknown): boolean {
  const invokeError = error as FunctionInvokeError | null;
  if (!invokeError) return false;
  if (invokeError.status === 401) return true;
  if (invokeError.context instanceof Response && invokeError.context.status === 401) return true;
  const normalized = (invokeError.message ?? "").toLowerCase();
  return normalized.includes("401") || normalized.includes("unauthorized");
}

function normalizeSyncResult(raw: SyncInvokePayload | null | undefined): MetadataSyncResult {
  const summary = raw?.summary ?? {
    processed: raw?.processed ?? 0,
    updated_safe: raw?.updated ?? 0,
    unchanged: raw?.unchanged ?? 0,
    missing_source: raw?.missing_source ?? 0,
    failed: raw?.failed ?? 0,
    conflict_articles: raw?.conflict_articles ?? 0,
    conflict_fields: raw?.conflict_fields ?? 0,
  };
  const conflictQueue = Array.isArray(raw?.conflictQueue) ? raw.conflictQueue : [];
  const conflicts = Array.isArray(raw?.conflicts) ? raw.conflicts : [];
  return {
    summary,
    conflictQueue,
    updated: summary.updated_safe,
    unchanged: summary.unchanged,
    missing_source: summary.missing_source,
    failed: summary.failed,
    conflict_articles: summary.conflict_articles,
    conflict_fields: summary.conflict_fields,
    conflicts_count: raw?.conflicts_count ?? summary.conflict_fields,
    conflicts,
  };
}

async function invokeSyncDois(accessToken: string, body: SyncOptions): Promise<SyncInvokePayload | null> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-dois`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      articleIds: body.articleIds,
      includeAbstract: body.includeAbstract ?? true,
      limit: body.limit ?? 200,
    }),
  });

  const payload = (await response.json().catch(() => null)) as SyncInvokePayload | null;
  if (!response.ok) {
    const message = payload?.message || payload?.error || `DOI metadata sync failed (${response.status})`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function syncCurrentUserDoiMetadata(options: SyncOptions = {}): Promise<MetadataSyncResult> {
  const accessToken = await getFreshAccessToken();
  try {
    const payload = await invokeSyncDois(accessToken, options);
    if (payload?.error) {
      if (payload.code === "UNAUTHORIZED") {
        throw new Error("Your session is invalid or expired. Please sign in again and retry DOI sync.");
      }
      throw new Error(payload.error);
    }
    return normalizeSyncResult(payload);
  } catch (error) {
    if (isUnauthorizedSyncError(error)) {
      throw new Error("Your session is invalid or expired. Please sign in again and retry DOI sync.");
    }
    const invokeError = error as FunctionInvokeError | null;
    throw new Error(invokeError?.message || "DOI metadata sync failed");
  }
}

export async function fetchArticle(id: string) {
  const { data, error } = await supabase.from("articles").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Article;
}

export async function fetchArticleSummaries() {
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,author,first_author,study_id,country,prosthesis_name,year,is_draft,created_at,updated_at,verify_peer1,verify_peer2,verify_qa3,verify_qa4")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ArticleListItem[];
}

export type ArticleFilterOption = Pick<Article, "id" | "country" | "year">;

export async function fetchFilterOptions(): Promise<ArticleFilterOption[]> {
  const { data, error } = await supabase.from("articles").select("id,country,year").order("created_at", { ascending: false });
  if (error) throw error;
  return data as ArticleFilterOption[];
}

export async function fetchVerificationSummaries() {
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,author,year,country,verify_peer1,verify_peer2,verify_qa3,verify_qa4,qa_score")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as VerificationListItem[];
}

export async function fetchArticlesPage(params: FetchArticlesPageParams) {
  const {
    page,
    pageSize,
    search,
    country,
    yearFrom,
    yearTo,
    qaMin,
    qaMax,
    status = "all",
    verificationFilters = [],
    sort = "recent_desc",
  } = params;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("articles")
    .select("id,title,author,first_author,study_id,country,prosthesis_name,year,is_draft,created_at,updated_at,verify_peer1,verify_peer2,verify_qa3,verify_qa4,qa_score", { count: "exact" })
    .range(from, to);

  const term = search.trim();
  if (term) {
    const escaped = term.replaceAll("%", "\\%");
    query = query.or(
      `author.ilike.%${escaped}%,first_author.ilike.%${escaped}%,title.ilike.%${escaped}%,study_id.ilike.%${escaped}%,country.ilike.%${escaped}%,prosthesis_name.ilike.%${escaped}%`,
    );
  }

  if (country && country !== "all") {
    query = query.eq("country", country);
  }

  if (yearFrom != null) {
    query = query.gte("year", yearFrom);
  }

  if (yearTo != null) {
    query = query.lte("year", yearTo);
  }

  if (qaMin != null) {
    query = query.gte("qa_score", qaMin);
  }

  if (qaMax != null) {
    query = query.lte("qa_score", qaMax);
  }

  if (status === "draft") {
    query = query.eq("is_draft", true);
  } else if (status === "verified") {
    query = query.eq("is_draft", false);
    for (const verificationKey of VERIFICATION_KEYS) {
      query = query.eq(verificationKey, true);
    }
  } else if (status === "pending") {
    query = query
      .eq("is_draft", false)
      .or(VERIFICATION_KEYS.map((key) => `${key}.is.false`).join(","));
  }

  for (const verificationFilter of verificationFilters) {
    query = query.eq(verificationFilter, true);
  }

  if (sort === "year_desc") {
    query = query.order("year", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  } else if (sort === "year_asc") {
    query = query.order("year", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  } else if (sort === "qa_desc") {
    query = query.order("qa_score", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  } else if (sort === "qa_asc") {
    query = query.order("qa_score", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
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
