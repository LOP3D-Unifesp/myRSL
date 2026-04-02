import { createClient } from "npm:@supabase/supabase-js@2";

type EnforceLimitParams = {
  endpoint: "chat-with-pdf" | "extract-pdf" | "sync-dois";
  userId: string;
  ipAddress: string | null;
  limit: number;
  windowSeconds: number;
};

export async function enforceRateLimit(params: EnforceLimitParams): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const subjectKey = `${params.userId}|${params.ipAddress ?? "unknown"}`;

  const { data, error } = await adminClient.rpc("consume_edge_rate_limit", {
    p_endpoint: params.endpoint,
    p_subject_key: subjectKey,
    p_user_id: params.userId,
    p_ip: params.ipAddress,
    p_limit: params.limit,
    p_window_seconds: params.windowSeconds,
  });

  if (error) {
    console.error("rate_limit_rpc_error", {
      endpoint: params.endpoint,
      userId: params.userId,
      message: error.message,
    });
    throw new Error("Unable to enforce rate limit.");
  }

  return Boolean(data);
}
