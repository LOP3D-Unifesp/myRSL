import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { setActiveReviewId } from "@/lib/active-review";
import { createReview, fetchMyReviews, type Review } from "@/lib/reviews";
import { useAuthUserId } from "@/contexts/auth-user-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CurrentReviewValue = {
  review: Review;
  reviews: Review[];
  selectReview: (id: string) => void;
};

const CurrentReviewContext = createContext<CurrentReviewValue | null>(null);

const STORAGE_KEY = "myrsl.currentReviewId";

function readStoredId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeId(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage can be unavailable; the first review is used on the next load.
  }
}

export const reviewsQueryKey = (userId: string | null) => ["reviews", userId ?? "no-user"] as const;

function CreateReviewGate({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      onCreated(await createReview(name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6">
        <div>
          <h1 className="text-xl font-semibold">Create your review</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Articles and the protocol belong to a review. Create one, or ask an owner to add you to theirs.
          </p>
        </div>
        <Input placeholder="e.g. Pediatric myoelectric prostheses" value={name} onChange={(e) => setName(e.target.value)} />
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" onClick={submit} disabled={!name.trim() || saving}>
          {saving ? "Creating..." : "Create review"}
        </Button>
      </div>
    </div>
  );
}

export function CurrentReviewProvider({ children }: { children: ReactNode }) {
  const userId = useAuthUserId();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(readStoredId);

  const { data: reviews, isLoading, refetch } = useQuery({
    queryKey: reviewsQueryKey(userId),
    queryFn: () => fetchMyReviews(userId!),
    enabled: Boolean(userId),
  });

  const review = useMemo(
    () => reviews?.find((item) => item.id === selectedId) ?? reviews?.[0] ?? null,
    [reviews, selectedId],
  );

  // Data helpers read the active review from this module, so set it before children render.
  setActiveReviewId(review?.id ?? null);

  const selectReview = useCallback(
    (id: string) => {
      storeId(id);
      setActiveReviewId(id);
      setSelectedId(id);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "reviews" });
    },
    [queryClient],
  );

  useEffect(() => {
    if (review) storeId(review.id);
  }, [review]);

  if (isLoading || !reviews) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!review) {
    return (
      <CreateReviewGate
        onCreated={async (id) => {
          storeId(id);
          setSelectedId(id);
          await refetch();
        }}
      />
    );
  }

  return <CurrentReviewContext.Provider value={{ review, reviews, selectReview }}>{children}</CurrentReviewContext.Provider>;
}

export function useCurrentReview(): CurrentReviewValue {
  const value = useContext(CurrentReviewContext);
  if (!value) throw new Error("useCurrentReview must be used inside CurrentReviewProvider");
  return value;
}
