import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMyReviewerRole, useReviewMembers, memberDisplayName } from "@/hooks/useReviewMemberNames";
import { useAuthUserId } from "@/contexts/auth-user-id";
import {
  answersOf,
  compareAnswers,
  fetchQaAssessments,
  saveQaAssessment,
  type QaAnswers,
  type ReviewerSlot,
} from "@/lib/qa-assessments";
import { calculateQAScore, type QAKey } from "@/lib/qa-questions";
import type { QaQuestionView } from "@/hooks/useProtocolData";

const OPTIONS = ["Yes", "Partial", "No"] as const;

type Props = {
  articleId: string;
  questions: QaQuestionView[];
  // The final (consensus) answers shown next to each reviewer's.
  finalAnswers: QaAnswers;
  onUseAnswer: (key: QAKey, value: string) => void;
};

const QaAssessmentPanel = ({ articleId, questions, finalAnswers, onUseAnswer }: Props) => {
  const userId = useAuthUserId();
  const queryClient = useQueryClient();
  const { slot, isOwner } = useMyReviewerRole();
  const members = useReviewMembers();
  const queryKey = ["qa-assessments", articleId] as const;

  const { data: rows } = useQuery({ queryKey, queryFn: () => fetchQaAssessments(articleId), enabled: Boolean(userId) });
  const assessments = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);

  const bySlot = (value: ReviewerSlot) => assessments.find((row) => row.reviewer_slot === value);
  const answersBySlot = (value: ReviewerSlot): QaAnswers | null => {
    const row = bySlot(value);
    return row ? answersOf(row as unknown as Partial<Record<QAKey, string | null>>) : null;
  };

  const savedMine = useMemo(() => (slot ? answersBySlot(slot) : null), [assessments, slot]); // eslint-disable-line react-hooks/exhaustive-deps
  const [mine, setMine] = useState<QaAnswers>(() => answersOf(null));

  useEffect(() => {
    setMine(savedMine ?? answersOf(null));
  }, [savedMine]);

  const dirty = questions.some((question) => (mine[question.key] ?? null) !== ((savedMine ?? answersOf(null))[question.key] ?? null));

  const saveMutation = useMutation({
    mutationFn: () => saveQaAssessment(articleId, slot as ReviewerSlot, mine),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Your assessment was saved.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save your assessment."),
  });

  const nameOf = (value: ReviewerSlot) => {
    const member = members.find((item) => item.reviewer_slot === value);
    return member ? memberDisplayName(member) : `Reviewer ${value}`;
  };

  const first = answersBySlot(1);
  const second = answersBySlot(2);
  const comparison = first && second ? compareAnswers(first, second) : null;
  const otherSlot: ReviewerSlot | null = slot === 1 ? 2 : slot === 2 ? 1 : null;
  const otherHidden = Boolean(slot) && otherSlot !== null && !bySlot(otherSlot);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">
            Your assessment {slot ? `(Reviewer ${slot})` : ""}
          </h4>
          {slot ? <Badge variant="outline">{calculateQAScore(mine)} / 10</Badge> : null}
        </div>

        {!slot ? (
          <p className="text-sm text-muted-foreground">
            {isOwner
              ? "You are not assigned as Reviewer 1 or 2. Assign yourself in Protocol > Team to fill your own assessment."
              : "Ask the owner to assign you as Reviewer 1 or 2 in Protocol > Team to fill your own assessment."}
          </p>
        ) : (
          <>
            {questions.map((question) => (
              <div key={question.key} className="rounded-md border border-border/60 bg-background/40 p-3">
                <p className="text-sm font-medium">{question.label}</p>
                <p className="mb-2 text-sm text-muted-foreground">{question.description}</p>
                <RadioGroup
                  value={mine[question.key] ?? ""}
                  onValueChange={(value) => setMine((previous) => ({ ...previous, [question.key]: value }))}
                  className="flex flex-wrap gap-3"
                >
                  {OPTIONS.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value={option} id={`mine-${question.key}-${option}`} />
                      <span>{option}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            ))}
            <div className="flex justify-end">
              <Button onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save my assessment"}
              </Button>
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Comparison</h4>
          {comparison ? <Badge variant="secondary">{comparison.agree} of {comparison.answered} agree</Badge> : null}
        </div>

        {otherHidden ? (
          <p className="text-sm text-muted-foreground">
            The other reviewer's assessment appears here once you finish yours and mark your QA step as verified.
          </p>
        ) : null}

        {first || second ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">{nameOf(1)} (R1)</th>
                  <th className="px-3 py-2 font-medium">{nameOf(2)} (R2)</th>
                  <th className="px-3 py-2 font-medium">Final</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question) => {
                  const a = first?.[question.key] ?? null;
                  const b = second?.[question.key] ?? null;
                  const differs = Boolean(a && b && a !== b);
                  return (
                    <tr key={question.key} className={differs ? "bg-warning/10" : undefined} data-differs={differs ? "true" : "false"}>
                      <td className="px-3 py-2">{question.label.split(" - ")[0]}</td>
                      <td className="px-3 py-2">
                        {a ?? "-"}
                        {a && differs ? <Button size="sm" variant="link" className="h-auto px-2 py-0" onClick={() => onUseAnswer(question.key, a)}>Use</Button> : null}
                      </td>
                      <td className="px-3 py-2">
                        {b ?? "-"}
                        {b && differs ? <Button size="sm" variant="link" className="h-auto px-2 py-0" onClick={() => onUseAnswer(question.key, b)}>Use</Button> : null}
                      </td>
                      <td className="px-3 py-2">{finalAnswers[question.key] ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t bg-muted/40 font-medium" data-testid="qa-score-row">
                <tr>
                  <td className="px-3 py-2">Score</td>
                  <td className="px-3 py-2">{first ? `${calculateQAScore(first)} / 10` : "-"}</td>
                  <td className="px-3 py-2">{second ? `${calculateQAScore(second)} / 10` : "-"}</td>
                  <td className="px-3 py-2">{calculateQAScore(finalAnswers)} / 10</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : !otherHidden ? (
          <p className="text-sm text-muted-foreground">No assessments saved yet.</p>
        ) : null}
      </section>
    </div>
  );
};

export default QaAssessmentPanel;
