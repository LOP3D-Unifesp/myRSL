import { supabase } from "@/integrations/supabase/client";

export type ReviewRole = "owner" | "reviewer";

export type Review = {
  id: string;
  name: string;
  role: ReviewRole;
};

export type ReviewMember = {
  user_id: string;
  role: ReviewRole;
  email: string;
  full_name: string | null;
};

export async function fetchMyReviews(userId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("review_members")
    .select("role, reviews(id, name, created_at)")
    .eq("user_id", userId);
  if (error) throw error;

  return (data ?? [])
    .flatMap((row) => {
      const review = Array.isArray(row.reviews) ? row.reviews[0] : row.reviews;
      return review ? [{ id: review.id, name: review.name, role: row.role as ReviewRole, createdAt: review.created_at }] : [];
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(({ id, name, role }) => ({ id, name, role }));
}

export async function createReview(name: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_review", { p_name: name });
  if (error) throw error;
  return data;
}

export async function fetchReviewMembers(reviewId: string): Promise<ReviewMember[]> {
  const { data, error } = await supabase.rpc("list_review_members", { p_review_id: reviewId });
  if (error) throw error;
  return (data ?? []) as ReviewMember[];
}

export async function addReviewMember(reviewId: string, email: string): Promise<void> {
  const { error } = await supabase.rpc("add_review_member", { p_review_id: reviewId, p_email: email });
  if (error) throw error;
}

export async function removeReviewMember(reviewId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("review_members").delete().eq("review_id", reviewId).eq("user_id", userId);
  if (error) throw error;
}
