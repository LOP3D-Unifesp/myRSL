import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { protocolKeys } from "@/lib/article-query-keys";
import { RESEARCH_QUESTIONS } from "@/lib/constants";
import { QA_QUESTIONS } from "@/lib/qa-questions";
import { fetchProtocolQaItems, fetchProtocolQuestions } from "@/lib/protocol";
import { useAuthUserId } from "@/contexts/auth-user-id";

export type QaQuestionView = { key: (typeof QA_QUESTIONS)[number]["key"]; label: string; description: string };

// Questions are stored as "<code> – <label>" on articles (e.g. "Q2 – Technology and Design").
export function formatResearchQuestion(question: { code: string; label: string }): string {
  return `${question.code} – ${question.label}`;
}

export function useResearchQuestionOptions(): string[] {
  const userId = useAuthUserId();
  const { data } = useQuery({
    queryKey: [...protocolKeys.protocol(userId), "questions"],
    queryFn: fetchProtocolQuestions,
    enabled: Boolean(userId),
  });
  return useMemo(() => (Array.isArray(data) && data.length > 0 ? data.map(formatResearchQuestion) : RESEARCH_QUESTIONS), [data]);
}

// The checklist wording comes from the protocol; the built-in text is the fallback.
export function useQaQuestions(): QaQuestionView[] {
  const userId = useAuthUserId();
  const { data } = useQuery({
    queryKey: [...protocolKeys.protocol(userId), "qa-items"],
    queryFn: fetchProtocolQaItems,
    enabled: Boolean(userId),
  });
  return useMemo(
    () =>
      QA_QUESTIONS.map((question) => {
        const override = Array.isArray(data) ? data.find((item) => item.slot === question.key) : undefined;
        return {
          key: question.key,
          label: override?.label ?? question.label,
          description: override?.description ?? question.description,
        };
      }),
    [data],
  );
}
