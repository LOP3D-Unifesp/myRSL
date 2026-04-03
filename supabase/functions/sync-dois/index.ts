import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";
import { assertBodySize, getCorsHeaders, isOriginAllowed, jsonResponse } from "../_shared/http.ts";

const MAX_SYNC_BODY_BYTES = 64_000;
const CROSSREF_TIMEOUT_MS = 10_000;
const CROSSREF_MAX_ATTEMPTS = 3;
const CROSSREF_BASE_BACKOFF_MS = 700;

const requestSchema = z.object({
  articleIds: z.array(z.string().uuid()).max(200),
  includeAbstract: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(200).optional().default(200),
});

type ArticleRow = {
  id: string;
  study_id: string | null;
  title: string | null;
  doi: string | null;
  year: number | null;
  author: string | null;
  first_author: string | null;
  last_author: string | null;
  abstract: string | null;
};

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

type ConflictItem = {
  articleId: string;
  field: "doi" | "title" | "year" | "author" | "first_author" | "last_author" | "abstract";
  currentValue: string;
  suggestedValue: string;
};

const MAX_CONFLICTS_RETURNED = 100;

type ReviewSnapshot = {
  doi: string | null;
  title: string | null;
  year: number | null;
  author: string | null;
  first_author: string | null;
  last_author: string | null;
  abstract: string | null;
};

type ConflictArticleItem = {
  articleId: string;
  studyId: string | null;
  doiCurrent: string | null;
  doiSuggested: string | null;
  titleCurrent: string | null;
  current: ReviewSnapshot;
  suggested: ReviewSnapshot;
  fields: ConflictItem[];
};

async function fetchDoiByTitle(title: string): Promise<string | null> {
  const data = await fetchCrossrefJsonWithRetry(
    `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(title)}&rows=1`,
  );
  if (!data) return null;
  const doi = data?.message?.items?.[0]?.DOI;
  return typeof doi === "string" && doi.length > 0 ? doi : null;
}

async function fetchCrossrefWorkByDoi(doi: string): Promise<CrossrefWork | null> {
  const data = await fetchCrossrefJsonWithRetry(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  if (!data) return null;
  return (data?.message ?? null) as CrossrefWork | null;
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const asSeconds = Number(value);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return Math.round(asSeconds * 1000);
  const asDate = Date.parse(value);
  if (!Number.isNaN(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

async function fetchCrossrefJsonWithRetry(url: string): Promise<any | null> {
  for (let attempt = 1; attempt <= CROSSREF_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CROSSREF_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "SysReview/1.0 (mailto:admin@example.com)" },
        signal: controller.signal,
      });

      if (response.ok) return await response.json();
      if (!shouldRetryStatus(response.status) || attempt === CROSSREF_MAX_ATTEMPTS) return null;

      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      const backoffMs = retryAfterMs ?? Math.round(CROSSREF_BASE_BACKOFF_MS * (2 ** (attempt - 1)));
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    } catch (error) {
      if (attempt === CROSSREF_MAX_ATTEMPTS) return null;
      const backoffMs = Math.round(CROSSREF_BASE_BACKOFF_MS * (2 ** (attempt - 1)));
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      if (error instanceof DOMException && error.name === "AbortError") continue;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return null;
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

function asConflictString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return String(value);
}

function maybeSetField(
  articleId: string,
  field: ConflictItem["field"],
  current: string | number | null,
  suggested: string | number | null,
  updatePayload: Record<string, string | number>,
  conflicts: ConflictItem[],
) {
  if (suggested == null) return;

  if (typeof suggested === "number") {
    if (current == null) {
      updatePayload[field] = suggested;
      return;
    }
    if (typeof current === "number" && current === suggested) return;
    if (conflicts.length < MAX_CONFLICTS_RETURNED) {
      conflicts.push({
        articleId,
        field,
        currentValue: asConflictString(current),
        suggestedValue: String(suggested),
      });
    }
    return;
  }

  const suggestedTrimmed = suggested.trim();
  if (!suggestedTrimmed) return;

  const currentString = typeof current === "number" ? String(current) : current;
  if (isBlank(currentString ?? null)) {
    updatePayload[field] = suggestedTrimmed;
    return;
  }
  if (normalizeText(currentString ?? "") === normalizeText(suggestedTrimmed)) return;
  if (conflicts.length < MAX_CONFLICTS_RETURNED) {
    conflicts.push({
      articleId,
      field,
      currentValue: asConflictString(currentString),
      suggestedValue: suggestedTrimmed,
    });
  }
}

serve(async (req) => {
  if (!isOriginAllowed(req)) {
    return jsonResponse(req, { error: "Origin not allowed." }, 403);
  }
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    assertBodySize(req, MAX_SYNC_BODY_BYTES);

    // Manual JWT verification (project uses ES256, incompatible with gateway verify_jwt=true)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(req, { code: "UNAUTHORIZED", error: "Missing authorization." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(req, { error: "Server environment is not configured." }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse(req, { code: "UNAUTHORIZED", error: "Invalid or expired session." }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(req, { error: parsed.error.issues[0]?.message || "Invalid request payload." }, 400);
    }

    const limit = parsed.data.limit ?? 200;
    const ids = parsed.data.articleIds;
    if (!ids || ids.length === 0) {
      return jsonResponse(req, { error: "articleIds is required and cannot be empty." }, 400);
    }
    const includeAbstract = parsed.data.includeAbstract ?? true;

    const { data, error } = await adminClient
      .from("articles")
      .select("id,study_id,title,doi,year,author,first_author,last_author,abstract")
      .or("doi.not.is.null,title.not.is.null")
      .eq("user_id", user.id)
      .in("id", ids)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return jsonResponse(req, { error: "Could not fetch articles for DOI sync." }, 500);
    const candidates = (data ?? []) as ArticleRow[];

    let updated = 0;
    let unchanged = 0;
    let failed = 0;
    let missingSource = 0;
    const conflicts: ConflictItem[] = [];
    const conflictQueue: ConflictArticleItem[] = [];

    type ArticleResult = {
      updated: number; unchanged: number; failed: number; missingSource: number;
      conflicts: ConflictItem[]; conflictQueueItem: ConflictArticleItem | null;
    };

    async function processArticle(article: ArticleRow): Promise<ArticleResult> {
      const result: ArticleResult = { updated: 0, unchanged: 0, failed: 0, missingSource: 0, conflicts: [], conflictQueueItem: null };
      try {
        let resolvedDoi = article.doi;
        if (!resolvedDoi && article.title) {
          resolvedDoi = await fetchDoiByTitle(article.title);
        }

        if (!resolvedDoi) { result.missingSource = 1; return result; }

        const work = await fetchCrossrefWorkByDoi(resolvedDoi);
        if (!work) { result.missingSource = 1; return result; }

        const currentSnapshot: ReviewSnapshot = {
          doi: article.doi, title: article.title, year: article.year,
          author: article.author, first_author: article.first_author,
          last_author: article.last_author, abstract: article.abstract,
        };
        const suggestedSnapshot: ReviewSnapshot = {
          doi: resolvedDoi ?? null, title: work.title?.[0] ?? null,
          year: extractYearFromWork(work), author: null, first_author: null,
          last_author: null, abstract: includeAbstract ? cleanAbstract(work.abstract) : null,
        };

        const updatePayload: Record<string, string | number> = {};
        const articleConflicts: ConflictItem[] = [];

        maybeSetField(article.id, "doi", article.doi, suggestedSnapshot.doi, updatePayload, articleConflicts);
        maybeSetField(article.id, "title", article.title, suggestedSnapshot.title, updatePayload, articleConflicts);
        maybeSetField(article.id, "year", article.year, suggestedSnapshot.year, updatePayload, articleConflicts);

        const parsedAuthors = parseAuthors(work);
        suggestedSnapshot.author = parsedAuthors.author;
        suggestedSnapshot.first_author = parsedAuthors.firstAuthor;
        suggestedSnapshot.last_author = parsedAuthors.lastAuthor;
        maybeSetField(article.id, "author", article.author, suggestedSnapshot.author, updatePayload, articleConflicts);
        maybeSetField(article.id, "first_author", article.first_author, suggestedSnapshot.first_author, updatePayload, articleConflicts);
        maybeSetField(article.id, "last_author", article.last_author, suggestedSnapshot.last_author, updatePayload, articleConflicts);
        if (includeAbstract) {
          maybeSetField(article.id, "abstract", article.abstract, suggestedSnapshot.abstract, updatePayload, articleConflicts);
        }

        if (articleConflicts.length > 0) {
          result.conflictQueueItem = {
            articleId: article.id, studyId: article.study_id,
            doiCurrent: article.doi, doiSuggested: suggestedSnapshot.doi,
            titleCurrent: article.title, current: currentSnapshot, suggested: suggestedSnapshot,
            fields: articleConflicts,
          };
          result.conflicts = articleConflicts;
        }

        if (Object.keys(updatePayload).length === 0) { result.unchanged = 1; return result; }

        const { error: updateError } = await adminClient.from("articles").update(updatePayload).eq("id", article.id);
        if (updateError) { result.failed = 1; return result; }
        result.updated = 1;
      } catch {
        result.failed = 1;
      }
      return result;
    }

    const BATCH_SIZE = 5;
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(processArticle));
      for (const r of results) {
        updated += r.updated;
        unchanged += r.unchanged;
        failed += r.failed;
        missingSource += r.missingSource;
        if (r.conflictQueueItem) {
          conflictQueue.push(r.conflictQueueItem);
          for (const c of r.conflicts) {
            if (conflicts.length < MAX_CONFLICTS_RETURNED) conflicts.push(c);
          }
        }
      }
      if (i + BATCH_SIZE < candidates.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    const summary = {
      processed: candidates.length,
      updated_safe: updated,
      unchanged,
      missing_source: missingSource,
      failed,
      conflict_articles: conflictQueue.length,
      conflict_fields: conflictQueue.reduce((total, item) => total + item.fields.length, 0),
    };

    return jsonResponse(req, {
      summary,
      conflictQueue,
      processed: candidates.length,
      updated,
      unchanged,
      missing_source: missingSource,
      failed,
      conflict_articles: summary.conflict_articles,
      conflict_fields: summary.conflict_fields,
      conflicts_count: summary.conflict_fields,
      conflicts,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("sync-dois error:", error);
    return jsonResponse(req, { error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
