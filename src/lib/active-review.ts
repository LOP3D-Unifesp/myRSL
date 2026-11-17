let activeReviewId: string | null = null;

// Set by CurrentReviewProvider; read by data helpers so every query is scoped to the selected review.
export function setActiveReviewId(id: string | null) {
  activeReviewId = id;
}

export function getActiveReviewId(): string | null {
  return activeReviewId;
}

export function requireActiveReviewId(): string {
  if (!activeReviewId) throw new Error("No review selected.");
  return activeReviewId;
}
