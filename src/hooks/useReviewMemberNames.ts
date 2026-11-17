import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActiveReviewId } from "@/lib/active-review";
import { fetchReviewMembers, type ReviewMember } from "@/lib/reviews";
import { useAuthUserId } from "@/contexts/auth-user-id";

export function memberDisplayName(member: Pick<ReviewMember, "full_name" | "email">): string {
  return member.full_name?.trim() || member.email.split("@")[0];
}

// Display names of the review's members, keyed by user id.
export function useReviewMemberNames(): Map<string, string> {
  const userId = useAuthUserId();
  const reviewId = getActiveReviewId();
  const { data } = useQuery({
    queryKey: ["review-members", reviewId],
    queryFn: () => fetchReviewMembers(reviewId as string),
    enabled: Boolean(userId && reviewId),
  });
  return useMemo(
    () => new Map(Array.isArray(data) ? data.map((member) => [member.user_id, memberDisplayName(member)] as const) : []),
    [data],
  );
}
