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
});

type ArticleRow = {
  id: string;
  title: string | null;
  doi: string | null;
};

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
      .select("id,title,doi")
      .eq("user_id", userId)
      .is("doi", null)
      .not("title", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    const ids = parsed.data.articleIds;
    if (ids && ids.length > 0) {
      query = query.in("id", ids);
    }

    const { data, error } = await query;
    if (error) return jsonResponse(req, { error: "Could not fetch articles for DOI sync." }, 500);
    const candidates = (data ?? []) as ArticleRow[];

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const article of candidates) {
      if (!article.title) {
        skipped += 1;
        continue;
      }
      try {
        const doi = await fetchDoiByTitle(article.title);
        if (!doi) {
          failed += 1;
          continue;
        }
        const { error: updateError } = await adminClient.from("articles").update({ doi }).eq("id", article.id).eq("user_id", userId);
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
      failed,
      skipped,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("sync-dois error:", error);
    return jsonResponse(req, { error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
