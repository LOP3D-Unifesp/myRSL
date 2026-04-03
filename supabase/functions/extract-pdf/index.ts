import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "npm:zod@3.25.76";
import { assertBodySize, getClientIp, getCorsHeaders, isOriginAllowed, jsonResponse } from "../_shared/http.ts";
import { decodeBase64ToBytes, hasPdfMagicBytes, sanitizePdfFileName } from "../_shared/pdf.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_BASE64_CHARS = 24_000_000;
const MAX_EXTRACT_BODY_BYTES = 28_000_000;
const RATE_LIMIT_PER_WINDOW = 10;
const RATE_WINDOW_SECONDS = 60;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

const requestSchema = z.object({
  pdfBase64: z.string().min(1).max(MAX_BASE64_CHARS),
  fileType: z.string().min(1).max(100),
  fileName: z.string().min(1).max(256).optional().default("article.pdf"),
});

const extractedSchema = z
  .object({
    doi: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    abstract: z.string().nullable().optional(),
    study_id: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    first_author: z.string().nullable().optional(),
    last_author: z.string().nullable().optional(),
    universities: z.string().nullable().optional(),
    publication_place: z.string().nullable().optional(),
    year: z.number().int().nullable().optional(),
    country: z.string().nullable().optional(),
    publication_type: z.string().nullable().optional(),
    study_design: z.string().nullable().optional(),
    has_pediatric_participants: z.string().nullable().optional(),
    sample_size: z.number().int().nullable().optional(),
    age_range: z.string().nullable().optional(),
    amputation_cause: z.array(z.string()).optional(),
    amputation_level: z.array(z.string()).optional(),
    pediatric_approach: z.string().nullable().optional(),
    prosthesis_name: z.string().nullable().optional(),
    prosthesis_level: z.string().nullable().optional(),
    dof: z.string().nullable().optional(),
    control_strategy: z.array(z.string()).optional(),
    sensors: z.array(z.string()).optional(),
    feedback_modalities: z.array(z.string()).optional(),
    manufacturing_method: z.string().nullable().optional(),
    growth_accommodation: z.string().nullable().optional(),
    technical_innovation: z.string().nullable().optional(),
    technical_challenges: z.string().nullable().optional(),
    setting: z.array(z.string()).optional(),
    functional_tests: z.array(z.string()).optional(),
    statistical_tests_performed: z.string().nullable().optional(),
    statistical_tests_specified: z.string().nullable().optional(),
    quantitative_results: z.string().nullable().optional(),
    usage_outcomes: z.string().nullable().optional(),
    gaps: z.string().nullable().optional(),
    primary_research_question: z.string().nullable().optional(),
    research_questions: z.array(z.string()).optional(),
  })
  .passthrough();

function parseJsonFromModelResponse(content: string) {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
  return JSON.parse(jsonStr);
}

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

function buildPrompt() {
  return `You are a research data extraction assistant for pediatric prosthetics systematic reviews.
Extract structured data from the provided PDF. Return valid JSON only.

Required keys: doi, title, abstract, study_id, author, first_author, last_author, universities, publication_place, year, country, publication_type, study_design, has_pediatric_participants, sample_size, age_range, amputation_cause, amputation_level, pediatric_approach, prosthesis_name, prosthesis_level, dof, control_strategy, sensors, feedback_modalities, manufacturing_method, growth_accommodation, technical_innovation, technical_challenges, setting, functional_tests, statistical_tests_performed, statistical_tests_specified, quantitative_results, usage_outcomes, gaps, primary_research_question, research_questions.

Rules:
1) Return null for missing scalar values and [] for missing arrays.
2) For title and abstract, copy verbatim from the paper.
3) For technical_challenges, always include both challenge and solution in format '- Challenge: ... -> Solution: ...'.
4) For inferential statistics fields, ignore descriptive stats.
5) Use only Q1..Q6 labels for research question fields.`;
}

serve(async (req) => {
  if (!isOriginAllowed(req)) {
    return jsonResponse(req, { error: "Origin not allowed." }, 403);
  }
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    assertBodySize(req, MAX_EXTRACT_BODY_BYTES);
    const user = await getAuthenticatedUser(req);
    const clientIp = getClientIp(req);
    const withinLimit = await enforceRateLimit({
      endpoint: "extract-pdf",
      userId: user.id,
      ipAddress: clientIp,
      limit: RATE_LIMIT_PER_WINDOW,
      windowSeconds: RATE_WINDOW_SECONDS,
    });
    if (!withinLimit) {
      return jsonResponse(req, { error: "Rate limit exceeded. Please wait before trying again." }, 429);
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(req, { error: parsed.error.issues[0]?.message || "Invalid request payload." }, 400);
    }

    const { pdfBase64, fileName, fileType } = parsed.data;
    if (fileType.toLowerCase() !== "application/pdf") {
      return jsonResponse(req, { error: "Invalid file MIME type. Expected application/pdf." }, 400);
    }
    const normalizedFileName = sanitizePdfFileName(fileName);
    const pdfBytes = decodeBase64ToBytes(pdfBase64);
    if (pdfBytes.byteLength > MAX_PDF_BYTES) {
      return jsonResponse(req, { error: "PDF too large for extraction." }, 413);
    }
    if (!hasPdfMagicBytes(pdfBytes)) {
      return jsonResponse(req, { error: "Invalid PDF file signature." }, 400);
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return jsonResponse(req, { error: "GEMINI_API_KEY is not configured" }, 500);
    }

    const systemPrompt = buildPrompt();
    const userMessage = `Extract structured data from this PDF: ${normalizedFileName}`;

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
                { text: userMessage },
                { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0 },
        }),
      },
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) return jsonResponse(req, { error: "Rate limit exceeded, please try again later." }, 429);
      if (response.status === 401 || response.status === 403) {
        return jsonResponse(req, { error: "Gemini authorization/quota error. Verify key and billing." }, 403);
      }
      if (response.status === 404) {
        return jsonResponse(req, { error: "Configured Gemini model is unavailable." }, 502);
      }
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return jsonResponse(req, { error: "AI extraction failed." }, 502);
    }

    const aiData = await response.json();
    const content = aiData?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("\n").trim() ?? "";
    if (!content) return jsonResponse(req, { error: "Empty response from model." }, 502);

    let extractedUnknown: unknown;
    try {
      extractedUnknown = parseJsonFromModelResponse(content);
    } catch {
      console.error("Failed to parse model output:", content);
      return jsonResponse(req, { error: "Could not parse extracted data. Please try again." }, 502);
    }

    const validated = extractedSchema.safeParse(extractedUnknown);
    if (!validated.success) {
      return jsonResponse(req, { error: "Model output failed schema validation." }, 502);
    }

    return jsonResponse(req, { extracted: validated.data });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("extract-pdf error:", error);
    return jsonResponse(req, { error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

