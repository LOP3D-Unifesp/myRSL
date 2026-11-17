import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Reviews the user belongs to. Edge functions use the service role, so they must apply the same
// membership rule the RLS policies enforce for the browser.
export async function getReviewIdsForUser(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await admin.from("review_members").select("review_id").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row: { review_id: string }) => row.review_id);
}
