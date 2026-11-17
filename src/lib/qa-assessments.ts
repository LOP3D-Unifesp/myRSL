import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { calculateQAScore, QA_QUESTIONS, type QAKey } from "@/lib/qa-questions";

export type QaAssessment = Database["public"]["Tables"]["article_qa_assessments"]["Row"];
export type QaAnswers = Record<QAKey, string | null>;
export type ReviewerSlot = 1 | 2;

export function emptyAnswers(): QaAnswers {
  return Object.fromEntries(QA_QUESTIONS.map((question) => [question.key, null])) as QaAnswers;
}

export function answersOf(source: Partial<Record<QAKey, string | null>> | null | undefined): QaAnswers {
  const answers = emptyAnswers();
  for (const question of QA_QUESTIONS) answers[question.key] = source?.[question.key] ?? null;
  return answers;
}

// Rows the current user may read: their own and, once their QA step is verified, the other reviewer's.
export async function fetchQaAssessments(articleId: string): Promise<QaAssessment[]> {
  const { data, error } = await supabase.from("article_qa_assessments").select("*").eq("article_id", articleId);
  if (error) throw error;
  return data ?? [];
}

export async function saveQaAssessment(articleId: string, slot: ReviewerSlot, answers: QaAnswers): Promise<void> {
  const { error } = await supabase.from("article_qa_assessments").upsert(
    { article_id: articleId, reviewer_slot: slot, ...answers, qa_score: calculateQAScore(answers) },
    { onConflict: "article_id,reviewer_slot" },
  );
  if (error) throw error;
}

export type QaComparison = { answered: number; agree: number; differing: QAKey[] };

// Items both reviewers answered, and how many of them match.
export function compareAnswers(first: QaAnswers, second: QaAnswers): QaComparison {
  let answered = 0;
  let agree = 0;
  const differing: QAKey[] = [];
  for (const question of QA_QUESTIONS) {
    const a = first[question.key];
    const b = second[question.key];
    if (!a || !b) continue;
    answered += 1;
    if (a === b) agree += 1;
    else differing.push(question.key);
  }
  return { answered, agree, differing };
}
