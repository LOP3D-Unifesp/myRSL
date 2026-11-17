import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActiveReviewId } from "@/lib/active-review";
import { fetchReviewMembers, type ReviewMember } from "@/lib/reviews";
import { useAuthUserId } from "@/contexts/auth-user-id";

export function memberDisplayName(member: Pick<ReviewMember, "full_name" | "email">): string {
  return member.full_name?.trim() || member.email.split("@")[0];
}

export function useReviewMembers(): ReviewMember[] {
  const userId = useAuthUserId();
  const reviewId = getActiveReviewId();
  const { data } = useQuery({
    queryKey: ["review-members", reviewId],
    queryFn: () => fetchReviewMembers(reviewId as string),
    enabled: Boolean(userId && reviewId),
  });
  return useMemo(() => (Array.isArray(data) ? data : []), [data]);
}

// Display names of the review's members, keyed by user id.
export function useReviewMemberNames(): Map<string, string> {
  const members = useReviewMembers();
  return useMemo(() => new Map(members.map((member) => [member.user_id, memberDisplayName(member)] as const)), [members]);
}

// The current user's reviewer number (1 or 2, if assigned) and whether they own the review.
export function useMyReviewerRole(): { slot: 1 | 2 | null; isOwner: boolean } {
  const userId = useAuthUserId();
  const members = useReviewMembers();
  return useMemo(() => {
    const me = members.find((member) => member.user_id === userId);
    return { slot: me?.reviewer_slot ?? null, isOwner: me?.role === "owner" };
  }, [members, userId]);
}
