import { afterEach, describe, expect, it, vi } from "vitest";
import { setActiveReviewId, requireActiveReviewId } from "@/lib/active-review";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { inActiveReview } from "@/lib/articles";

describe("inActiveReview", () => {
  afterEach(() => setActiveReviewId(null));

  it("leaves the query untouched when no review is active", () => {
    const query = { eq: vi.fn() };
    expect(inActiveReview(query)).toBe(query);
    expect(query.eq).not.toHaveBeenCalled();
  });

  it("filters by the active review", () => {
    const filtered = {};
    const query = { eq: vi.fn().mockReturnValue(filtered) };
    setActiveReviewId("review-1");
    expect(inActiveReview(query)).toBe(filtered);
    expect(query.eq).toHaveBeenCalledWith("review_id", "review-1");
  });

  it("requireActiveReviewId throws without a selection", () => {
    expect(() => requireActiveReviewId()).toThrow("No review selected.");
    setActiveReviewId("review-2");
    expect(requireActiveReviewId()).toBe("review-2");
  });
});
