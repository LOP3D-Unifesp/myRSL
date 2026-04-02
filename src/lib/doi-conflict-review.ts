import type { MetadataConflictArticle, MetadataSyncSummary } from "@/lib/articles";

const DOI_CONFLICT_REVIEW_KEY = "doi_conflict_review_v1";

export type DoiConflictReviewState = {
  createdAt: string;
  summary: MetadataSyncSummary;
  queue: MetadataConflictArticle[];
  currentIndex: number;
  started: boolean;
};

export function saveDoiConflictReviewState(state: DoiConflictReviewState): void {
  localStorage.setItem(DOI_CONFLICT_REVIEW_KEY, JSON.stringify(state));
}

export function loadDoiConflictReviewState(): DoiConflictReviewState | null {
  const raw = localStorage.getItem(DOI_CONFLICT_REVIEW_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DoiConflictReviewState;
    if (!parsed || !Array.isArray(parsed.queue)) return null;

    const normalizedQueue: MetadataConflictArticle[] = parsed.queue.map((item) => ({
      articleId: item.articleId,
      studyId: "studyId" in item ? item.studyId ?? null : null,
      doiCurrent: "doiCurrent" in item ? item.doiCurrent ?? null : item.current?.doi ?? null,
      doiSuggested: "doiSuggested" in item ? item.doiSuggested ?? null : item.suggested?.doi ?? null,
      titleCurrent: "titleCurrent" in item ? item.titleCurrent ?? null : item.current?.title ?? null,
      current: item.current,
      suggested: item.suggested,
      fields: Array.isArray(item.fields) ? item.fields : [],
    }));

    return {
      createdAt: parsed.createdAt,
      summary: parsed.summary,
      queue: normalizedQueue,
      currentIndex: parsed.currentIndex ?? 0,
      started: Boolean(parsed.started),
    };
  } catch {
    return null;
  }
}

export function clearDoiConflictReviewState(): void {
  localStorage.removeItem(DOI_CONFLICT_REVIEW_KEY);
}
