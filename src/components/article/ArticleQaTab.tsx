import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthUserId } from "@/contexts/auth-user-id";
import { answersOf, fetchQaAssessments, type ReviewerSlot } from "@/lib/qa-assessments";
import type { QAKey } from "@/lib/qa-questions";
import type { QaQuestionView } from "@/hooks/useProtocolData";

type Props = {
  articleId: string;
  questions: QaQuestionView[];
  finalAnswers: Record<QAKey, string | null>;
  onOpenReview: () => void;
};

function formatAnswer(answer: string | null | undefined) {
  if (answer === "Yes") return "Yes (1)";
  if (answer === "Partial") return "Partial (0.5)";
  if (answer === "No") return "No (0)";
  return "Not set";
}

// Read-only QA view: the final answer per item, plus each reviewer's answer when they differ.
export function ArticleQaTab({ articleId, questions, finalAnswers, onOpenReview }: Props) {
  const userId = useAuthUserId();
  const { data: rows } = useQuery({
    queryKey: ["qa-assessments", articleId] as const,
    queryFn: () => fetchQaAssessments(articleId),
    enabled: Boolean(userId),
  });

  const bySlot = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    const pick = (slot: ReviewerSlot) => {
      const row = list.find((item) => item.reviewer_slot === slot);
      return row ? answersOf(row as unknown as Partial<Record<QAKey, string | null>>) : null;
    };
    return { first: pick(1), second: pick(2) };
  }, [rows]);

  const differs = (key: QAKey) => {
    const a = bySlot.first?.[key];
    const b = bySlot.second?.[key];
    return Boolean(a && b && a !== b);
  };
  const disagreements = questions.filter((question) => differs(question.key)).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {disagreements > 0 ? (
          <Badge variant="outline" className="border-warning/40 bg-warning/15 text-warning-foreground">
            <AlertTriangle className="mr-1 h-3 w-3" /> {disagreements} {disagreements === 1 ? "disagreement" : "disagreements"} between reviewers
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Final answers per item.</span>
        )}
        <Button variant="outline" size="sm" onClick={onOpenReview}>Open review panel</Button>
      </div>

      {questions.map((question) => {
        const a = bySlot.first?.[question.key] ?? null;
        const b = bySlot.second?.[question.key] ?? null;
        const split = differs(question.key);
        return (
          <div
            key={question.key}
            className={`rounded-md border px-3 py-2 text-sm ${split ? "border-warning/40 bg-warning/10" : "border-border/60 bg-background/60"}`}
            data-differs={split ? "true" : "false"}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{question.label}</span>
              <Badge variant="outline">{formatAnswer(finalAnswers[question.key])}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{question.description}</p>
            {split ? (
              <p className="mt-1 text-xs text-warning-foreground">R1: {a} · R2: {b}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
