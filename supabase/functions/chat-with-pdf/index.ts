import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";
import { assertBodySize, getClientIp, getCorsHeaders, isOriginAllowed, jsonResponse } from "../_shared/http.ts";
import { hasPdfMagicBytes } from "../_shared/pdf.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";

const MAX_CHAT_BODY_BYTES = 128_000;
const RATE_LIMIT_PER_WINDOW = 20;
const RATE_WINDOW_SECONDS = 60;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

const requestSchema = z.object({
  articleId: z.string().uuid(),
  articleTitle: z.string().min(1).max(500).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(25),
});

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Response(JSON.stringify({ error: "Missing Authorization header." }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: "Invalid or expired token." }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
  return data.user;
}

function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function getStoragePath(pdfRef: string): string {
  if (!/^https?:\/\//i.test(pdfRef)) {
    return pdfRef;
  }
  const match = pdfRef.match(/\/storage\/v1\/object\/(?:public|sign)\/research-pdfs\/([^?]+)/i);
  if (!match?.[1]) {
    throw new Error("Unsupported PDF reference format.");
  }
  return decodeURIComponent(match[1]);
}

serve(async (req) => {
  if (!isOriginAllowed(req)) {
    return jsonResponse(req, { error: "Origin not allowed." }, 403);
  }
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    assertBodySize(req, MAX_CHAT_BODY_BYTES);
    const user = await getAuthenticatedUser(req);
    const clientIp = getClientIp(req);
    const withinLimit = await enforceRateLimit({
      endpoint: "chat-with-pdf",
      userId: user.id,
      ipAddress: clientIp,
      limit: RATE_LIMIT_PER_WINDOW,
      windowSeconds: RATE_WINDOW_SECONDS,
    });
    if (!withinLimit) {
      return jsonResponse(req, { error: "Rate limit exceeded, please try again later." }, 429);
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(req, { error: parsed.error.issues[0]?.message || "Invalid request payload." }, 400);
    }

    const { articleId, articleTitle, messages } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(req, { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, 500);
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: article, error: articleError } = await adminClient
      .from("articles")
      .select("id,title,pdf_url")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (articleError || !article?.pdf_url) {
      console.warn(
        "security_access_denied",
        JSON.stringify({
          endpoint: "chat-with-pdf",
          reason: articleError ? "article_lookup_failed" : "article_not_owned_or_missing_pdf",
          userId: user.id,
          articleId,
          ipAddress: clientIp,
        }),
      );
      return jsonResponse(req, { error: "Access denied for article/pdf." }, 403);
    }

    const pdfPath = getStoragePath(article.pdf_url);
    if (!pdfPath.startsWith(`${user.id}/`)) {
      console.warn(
        "security_access_denied",
        JSON.stringify({
          endpoint: "chat-with-pdf",
          reason: "pdf_path_outside_user_scope",
          userId: user.id,
          articleId,
          pdfPath,
          ipAddress: clientIp,
        }),
      );
      return jsonResponse(req, { error: "Access denied for article/pdf." }, 403);
    }

    const { data: pdfBlob, error: downloadError } = await adminClient.storage.from("research-pdfs").download(pdfPath);
    if (downloadError || !pdfBlob) {
      return jsonResponse(req, { error: "Unable to load PDF for chat context." }, 404);
    }

    if (pdfBlob.type && pdfBlob.type !== "application/pdf") {
      return jsonResponse(req, { error: "Stored file is not a valid PDF." }, 400);
    }

    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
    if (pdfBytes.byteLength > MAX_PDF_BYTES) {
      return jsonResponse(req, { error: "PDF too large for chat processing." }, 413);
    }
    if (!hasPdfMagicBytes(pdfBytes)) {
      return jsonResponse(req, { error: "Stored file is not a valid PDF." }, 400);
    }
    const pdfBase64 = toBase64(pdfBytes);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return jsonResponse(req, { error: "GEMINI_API_KEY is not configured" }, 500);
    }

    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    const conversation = messages.slice(-6).map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n");
    const question = lastUserMessage?.content ?? "Summarize the key findings.";

    const titleForPrompt = article.title || articleTitle || "this paper";
    const systemPrompt = `You are a research paper assistant for "${titleForPrompt}".
Answer ONLY from the attached PDF content.
If the answer is not present in the paper, respond exactly: "I cannot find this information in the paper."
Keep answers concise and factual.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    `Conversation (latest last):\n${conversation}\n\n` +
                    `Current question: ${question}\n\n` +
                    "Use only information found in the attached PDF.",
                },
                { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.1 },
        }),
      },
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) return jsonResponse(req, { error: "Rate limit exceeded, please try again later." }, 429);
      const text = await response.text();
      console.error("chat-with-pdf model error:", response.status, text);
      return jsonResponse(req, { error: "AI chat failed." }, 502);
    }

    const aiData = await response.json();
    const reply =
      aiData?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("\n").trim() ||
      "I cannot find this information in the paper.";

    return jsonResponse(req, { reply });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("chat-with-pdf error:", error);
    return jsonResponse(req, { error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
