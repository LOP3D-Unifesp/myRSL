import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";
import { assertBodySize, getClientIp, getCorsHeaders, isOriginAllowed, jsonResponse } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";

const MAX_SYNC_BODY_BYTES = 64_000;
const RATE_LIMIT_PER_WINDOW = 5;
const RATE_WINDOW_SECONDS = 60;

const requestSchema = z.object({
  articleIds: z.array(z.string().uuid()).max(200).optional(),
  includeAbstract: z.boolean().optional().default(true),
});

type ArticleRow = {
  id: string;
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

async function getUserIdFromToken(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Response(JSON.stringify({ error: "Missing Authorization header." }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Missing Supabase env configuration.");

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: "Invalid or expired token." }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
  return data.user.id;
}

async function fetchDoiByTitle(title: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  const response = await fetch(
    `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(title)}&rows=1`,
    {
      headers: { "User-Agent": "SysReview/1.0 (mailto:admin@example.com)" },
      signal: controller.signal,
    },
  );
  clearTimeout(timeoutId);
  if (!response.ok) return null;
  const data = await response.json();
  const doi = data?.message?.items?.[0]?.DOI;
  return typeof doi === "string" && doi.length > 0 ? doi : null;
}

async function fetchCrossrefWorkByDoi(doi: string): Promise<CrossrefWork | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  const response = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    {
      headers: { "User-Agent": "SysReview/1.0 (mailto:admin@example.com)" },
      signal: controller.signal,
    },
  );
  clearTimeout(timeoutId);
  if (!response.ok) return null;
  const data = await response.json();
  return (data?.message ?? null) as CrossrefWork | null;
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
    const userId = await getUserIdFromToken(req);
    const clientIp = getClientIp(req);
    const withinLimit = await enforceRateLimit({
      endpoint: "sync-dois",
      userId,
      ipAddress: clientIp,
      limit: RATE_LIMIT_PER_WINDOW,
      windowSeconds: RATE_WINDOW_SECONDS,
    });
    if (!withinLimit) {
      return jsonResponse(req, { error: "Rate limit exceeded, please try again later." }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(req, { error: parsed.error.issues[0]?.message || "Invalid request payload." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(req, { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, 500);
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    let query = adminClient
      .from("articles")
      .select("id,title,doi,year,author,first_author,last_author,abstract")
      .eq("user_id", userId)
      .or("doi.not.is.null,title.not.is.null")
      .order("created_at", { ascending: false })
      .limit(200);

    const ids = parsed.data.articleIds;
    const includeAbstract = parsed.data.includeAbstract ?? true;
    if (ids && ids.length > 0) {
      query = query.in("id", ids);
    }

    const { data, error } = await query;
    if (error) return jsonResponse(req, { error: "Could not fetch articles for DOI sync." }, 500);
    const candidates = (data ?? []) as ArticleRow[];

    let updated = 0;
    let unchanged = 0;
    let failed = 0;
    let missingSource = 0;
    const conflicts: ConflictItem[] = [];

    for (const article of candidates) {
      try {
        let resolvedDoi = article.doi;
        if (!resolvedDoi && article.title) {
          resolvedDoi = await fetchDoiByTitle(article.title);
        }

        if (!resolvedDoi) {
          missingSource += 1;
          continue;
        }

        const work = await fetchCrossrefWorkByDoi(resolvedDoi);
        if (!work) {
          missingSource += 1;
          continue;
        }

        const updatePayload: Record<string, string | number> = {};

        maybeSetField(article.id, "doi", article.doi, resolvedDoi, updatePayload, conflicts);
        maybeSetField(article.id, "title", article.title, work.title?.[0] ?? null, updatePayload, conflicts);
        maybeSetField(article.id, "year", article.year, extractYearFromWork(work), updatePayload, conflicts);

        const parsedAuthors = parseAuthors(work);
        maybeSetField(article.id, "author", article.author, parsedAuthors.author, updatePayload, conflicts);
        maybeSetField(article.id, "first_author", article.first_author, parsedAuthors.firstAuthor, updatePayload, conflicts);
        maybeSetField(article.id, "last_author", article.last_author, parsedAuthors.lastAuthor, updatePayload, conflicts);
        if (includeAbstract) {
          maybeSetField(article.id, "abstract", article.abstract, cleanAbstract(work.abstract), updatePayload, conflicts);
        }

        if (Object.keys(updatePayload).length === 0) {
          unchanged += 1;
          continue;
        }

        const { error: updateError } = await adminClient.from("articles").update(updatePayload).eq("id", article.id).eq("user_id", userId);
        if (updateError) {
          failed += 1;
          continue;
        }
        updated += 1;
      } catch {
        failed += 1;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return jsonResponse(req, {
      processed: candidates.length,
      updated,
      unchanged,
      missing_source: missingSource,
      failed,
      conflicts_count: conflicts.length,
      conflicts,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("sync-dois error:", error);
    return jsonResponse(req, { error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
