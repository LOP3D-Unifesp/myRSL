import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateArticle,
  fetchArticle,
  type ArticleInsert,
  type Article,
  type DoiSyncReviewField,
  type MetadataConflictArticle,
} from "@/lib/articles";
import { clearDoiConflictReviewState, loadDoiConflictReviewState, saveDoiConflictReviewState } from "@/lib/doi-conflict-review";

type Decision = {
  action: "keep" | "replace" | "edit";
  editedValue: string;
};

function toDisplay(value: string | number | null): string {
  if (value == null) return "";
  return String(value);
}

function buildDefaultDecisions(item: MetadataConflictArticle): Record<string, Decision> {
  const decisions: Record<string, Decision> = {};
  for (const field of item.fields) {
    decisions[field.field] = { action: "keep", editedValue: field.suggestedValue };
  }
  return decisions;
}

function buildFieldStats(queue: MetadataConflictArticle[], startIndex = 0): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const item of queue.slice(startIndex)) {
    for (const field of item.fields) stats[field.field] = (stats[field.field] ?? 0) + 1;
  }
  return stats;
}

function removeResolvedField(item: MetadataConflictArticle, field: DoiSyncReviewField): MetadataConflictArticle {
  return {
    ...item,
    fields: item.fields.filter((conflict) => conflict.field !== field),
  };
}

const DoiConflictReview = () => {
  const initial = loadDoiConflictReviewState();
  const [state, setState] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [resolvedArticleInfo, setResolvedArticleInfo] = useState<Pick<Article, "study_id" | "doi" | "title"> | null>(null);
  const [loadingArticleInfo, setLoadingArticleInfo] = useState(false);

  const currentItem = useMemo(() => {
    if (!state) return null;
    return state.queue[state.currentIndex] ?? null;
  }, [state]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() => (currentItem ? buildDefaultDecisions(currentItem) : {}));

  const fieldStats = useMemo(() => {
    if (!state) return {};
    return buildFieldStats(state.queue, 0);
  }, [state]);

  const remainingFieldStats = useMemo(() => {
    if (!state) return {};
    return buildFieldStats(state.queue, state.currentIndex);
  }, [state]);

  const finished = state ? state.currentIndex >= state.queue.length : false;

  useEffect(() => {
    let active = true;
    async function resolveFallbackInfo() {
      if (!currentItem) {
        if (active) setResolvedArticleInfo(null);
        return;
      }
      const hasInlineInfo = Boolean(currentItem.studyId || currentItem.doiCurrent || currentItem.titleCurrent);
      if (hasInlineInfo) {
        if (active) setResolvedArticleInfo(null);
        return;
      }
      try {
        if (active) setLoadingArticleInfo(true);
        const article = await fetchArticle(currentItem.articleId);
        if (active) {
          setResolvedArticleInfo({
            study_id: article.study_id,
            doi: article.doi,
            title: article.title,
          });
        }
      } catch {
        if (active) setResolvedArticleInfo(null);
      } finally {
        if (active) setLoadingArticleInfo(false);
      }
    }
    resolveFallbackInfo();
    return () => {
      active = false;
    };
  }, [currentItem]);

  const persistState = (nextState: NonNullable<typeof state>) => {
    setState(nextState);
    saveDoiConflictReviewState(nextState);
  };

  const startReview = () => {
    if (!state) return;
    const nextState = { ...state, started: true };
    persistState(nextState);
  };

  const clearAndExit = () => {
    clearDoiConflictReviewState();
    setState(null);
    toast.success("Conflict review queue cleared.");
  };

  const handleBulkReplaceField = async (field: DoiSyncReviewField) => {
    if (!state) return;
    const pendingArticles = state.queue.slice(state.currentIndex).filter((item) => item.fields.some((f) => f.field === field));
    if (pendingArticles.length === 0) {
      toast.info(`No remaining ${field} conflicts to replace.`);
      return;
    }

    const confirmed = window.confirm(
      `Replace "${field}" with DOI suggestion for ${pendingArticles.length} remaining article(s)?`,
    );
    if (!confirmed) return;

    setBulkApplying(true);
    let updatedCount = 0;
    let failedCount = 0;

    try {
      const failedArticleIds = new Set<string>();
      for (const item of pendingArticles) {
        const conflict = item.fields.find((f) => f.field === field);
        if (!conflict) continue;

        const patch: Partial<ArticleInsert> = {};
        if (field === "year") {
          const trimmed = conflict.suggestedValue.trim();
          if (!trimmed) {
            patch.year = null;
          } else {
            const parsed = Number(trimmed);
            if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
              failedCount += 1;
              failedArticleIds.add(item.articleId);
              continue;
            }
            patch.year = parsed;
          }
        } else {
          patch[field] = conflict.suggestedValue.trim() ? conflict.suggestedValue.trim() : null;
        }

        try {
          await updateArticle(item.articleId, patch);
          updatedCount += 1;
        } catch {
          failedCount += 1;
          failedArticleIds.add(item.articleId);
        }
      }

      const nextQueue = state.queue.map((item, index) => {
        if (index < state.currentIndex) return item;
        if (failedArticleIds.has(item.articleId)) return item;
        return removeResolvedField(item, field);
      });

      const compactedQueue = nextQueue.filter((item) => item.fields.length > 0);
      const nextCurrentIndex = Math.min(state.currentIndex, compactedQueue.length);
      const nextState = {
        ...state,
        queue: compactedQueue,
        currentIndex: nextCurrentIndex,
        summary: {
          ...state.summary,
          conflict_articles: compactedQueue.length,
          conflict_fields: compactedQueue.reduce((acc, item) => acc + item.fields.length, 0),
        },
      };
      persistState(nextState);

      const nextItem = nextState.queue[nextState.currentIndex] ?? null;
      setDecisions(nextItem ? buildDefaultDecisions(nextItem) : {});

      toast.success(`Bulk replace for "${field}" completed: ${updatedCount} updated, ${failedCount} failed.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk replace failed";
      toast.error(message);
    } finally {
      setBulkApplying(false);
    }
  };

  const handleSaveNext = async () => {
    if (!state || !currentItem) return;
    setSaving(true);
    try {
      const patch: Partial<ArticleInsert> = {};
      for (const conflict of currentItem.fields) {
        const decision = decisions[conflict.field] ?? { action: "keep", editedValue: conflict.suggestedValue };
        if (decision.action === "keep") continue;

        const source = decision.action === "replace" ? conflict.suggestedValue : decision.editedValue;
        if (conflict.field === "year") {
          const trimmed = source.trim();
          if (!trimmed) {
            patch.year = null;
          } else {
            const parsed = Number(trimmed);
            if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
              toast.error(`Invalid year value for article ${currentItem.articleId}.`);
              setSaving(false);
              return;
            }
            patch.year = parsed;
          }
        } else {
          patch[conflict.field] = source.trim() ? source.trim() : null;
        }
      }

      if (Object.keys(patch).length > 0) {
        await updateArticle(currentItem.articleId, patch);
      }

      const nextIndex = state.currentIndex + 1;
      const nextState = { ...state, currentIndex: nextIndex };
      persistState(nextState);
      const nextItem = nextState.queue[nextIndex];
      setDecisions(nextItem ? buildDefaultDecisions(nextItem) : {});
      if (nextIndex >= nextState.queue.length) {
        toast.success("Conflict review completed.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save review decision";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!state || state.queue.length === 0) {
    return (
      <div className="animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle>DOI Conflict Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">No pending DOI conflict review queue.</p>
            <Button asChild variant="outline">
              <Link to="/">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>DOI Sync Conflict Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{state.summary.conflict_articles} article(s) with conflict</p>
          <p>{state.summary.conflict_fields} conflict field(s)</p>
          <p>{state.summary.updated_safe} article(s) auto-updated safely</p>
          <p>{state.summary.missing_source} article(s) without DOI/metadata source</p>
          <div className="pt-2">
            <p className="font-medium">Conflicts by field:</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(fieldStats).map(([field, count]) => (
                <span key={field} className="text-xs rounded border px-2 py-1">
                  {field}: {count}
                </span>
              ))}
            </div>
          </div>
          <div className="pt-4 flex gap-2">
            {!state.started && <Button onClick={startReview}>Start Review</Button>}
            <Button variant="outline" asChild>
              <Link to="/">Back to Dashboard</Link>
            </Button>
            <Button variant="ghost" onClick={clearAndExit}>Clear Queue</Button>
          </div>
        </CardContent>
      </Card>

      {state.started && !finished && (
        <Card>
          <CardHeader>
            <CardTitle>Bulk Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Apply DOI suggestion for one field across all remaining articles.</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(remainingFieldStats).map(([field, count]) => (
                <Button
                  key={field}
                  size="sm"
                  variant="outline"
                  disabled={bulkApplying}
                  onClick={() => handleBulkReplaceField(field as DoiSyncReviewField)}
                >
                  Replace remaining {field} ({count})
                </Button>
              ))}
              {Object.keys(remainingFieldStats).length === 0 && (
                <p className="text-sm text-muted-foreground">No remaining fields for bulk replace.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {state.started && !finished && currentItem && (
        <Card>
          <CardHeader>
            <CardTitle>
              Reviewing {state.currentIndex + 1} of {state.queue.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded border p-3 text-sm space-y-1">
              <p><span className="font-medium">Study ID:</span> {currentItem.studyId || resolvedArticleInfo?.study_id || "-"}</p>
              <p><span className="font-medium">Current DOI:</span> {currentItem.doiCurrent || resolvedArticleInfo?.doi || "-"}</p>
              <p><span className="font-medium">Suggested DOI:</span> {currentItem.doiSuggested || currentItem.suggested.doi || "-"}</p>
              <p><span className="font-medium">Current Title:</span> {currentItem.titleCurrent || resolvedArticleInfo?.title || "-"}</p>
              <p className="text-xs text-muted-foreground">Technical ID: {currentItem.articleId}</p>
              {loadingArticleInfo && <p className="text-xs text-muted-foreground">Loading article context...</p>}
            </div>

            {currentItem.fields.map((conflict) => {
              const decision = decisions[conflict.field] ?? { action: "keep", editedValue: conflict.suggestedValue };
              return (
                <div key={conflict.field} className="rounded border p-3 space-y-2">
                  <Label className="font-semibold">{conflict.field}</Label>
                  <p className="text-xs text-muted-foreground">Current: {toDisplay(conflict.currentValue) || "-"}</p>
                  <p className="text-xs text-muted-foreground">DOI suggestion: {toDisplay(conflict.suggestedValue) || "-"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={decision.action === "keep" ? "default" : "outline"}
                      onClick={() => setDecisions((prev) => ({ ...prev, [conflict.field]: { ...decision, action: "keep" } }))}
                    >
                      Keep
                    </Button>
                    <Button
                      size="sm"
                      variant={decision.action === "replace" ? "default" : "outline"}
                      onClick={() => setDecisions((prev) => ({ ...prev, [conflict.field]: { ...decision, action: "replace" } }))}
                    >
                      Replace
                    </Button>
                    <Button
                      size="sm"
                      variant={decision.action === "edit" ? "default" : "outline"}
                      onClick={() => setDecisions((prev) => ({ ...prev, [conflict.field]: { ...decision, action: "edit" } }))}
                    >
                      Edit
                    </Button>
                  </div>
                  {decision.action === "edit" && (
                    <Input
                      value={decision.editedValue}
                      onChange={(e) =>
                        setDecisions((prev) => ({
                          ...prev,
                          [conflict.field]: { ...decision, editedValue: e.target.value },
                        }))
                      }
                      placeholder="Type value"
                    />
                  )}
                </div>
              );
            })}

            <div className="flex gap-2">
              <Button onClick={handleSaveNext} disabled={saving || bulkApplying}>
                {saving ? "Saving..." : "Save and Next"}
              </Button>
              <Button variant="outline" onClick={clearAndExit}>End Review</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.started && finished && (
        <Card>
          <CardContent className="py-10 space-y-3">
            <p className="font-medium">Review queue finished.</p>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link to="/">Back to Dashboard</Link>
              </Button>
              <Button onClick={clearAndExit}>Clear Queue</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DoiConflictReview;
