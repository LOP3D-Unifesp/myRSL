import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const requestSchema = z.object({
  articleTitle: z.string().min(1).max(500),
  pdfRef: z.string().min(1).max(2000),
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Response(JSON.stringify({ error: "Missing Authorization header." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await getAuthenticatedUser(req);

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.issues[0]?.message || "Invalid request payload." }, 400);
    }

    const { articleTitle, pdfRef, messages } = parsed.data;
    const pdfPath = getStoragePath(pdfRef);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, 500);
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: pdfBlob, error: downloadError } = await adminClient.storage.from("research-pdfs").download(pdfPath);
    if (downloadError || !pdfBlob) {
      return jsonResponse({ error: "Unable to load PDF for chat context." }, 404);
    }

    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
    if (pdfBytes.byteLength > 20 * 1024 * 1024) {
      return jsonResponse({ error: "PDF too large for chat processing." }, 413);
    }
    const pdfBase64 = toBase64(pdfBytes);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return jsonResponse({ error: "GEMINI_API_KEY is not configured" }, 500);
    }

    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    const conversation = messages.slice(-6).map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n");
    const question = lastUserMessage?.content ?? "Summarize the key findings.";

    const systemPrompt = `You are a research paper assistant for "${articleTitle}".
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
      if (response.status === 429) return jsonResponse({ error: "Rate limit exceeded, please try again later." }, 429);
      const text = await response.text();
      console.error("chat-with-pdf model error:", response.status, text);
      return jsonResponse({ error: "AI chat failed." }, 502);
    }

    const aiData = await response.json();
    const reply =
      aiData?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("\n").trim() ||
      "I cannot find this information in the paper.";

    return jsonResponse({ reply });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("chat-with-pdf error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
