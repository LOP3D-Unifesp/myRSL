import { describe, expect, it } from "vitest";
import { QA_QUESTIONS, calculateQAScore, type QAKey } from "@/lib/qa-questions";

describe("calculateQAScore", () => {
  it("computes weighted score from answers", () => {
    const answers = {} as Record<QAKey, string | null>;
    for (const question of QA_QUESTIONS) {
      answers[question.key] = "No";
    }
    answers.qa_q1 = "Yes";
    answers.qa_q2 = "Partial";
    answers.qa_q3 = "Yes";

    expect(calculateQAScore(answers)).toBe(2.5);
  });
});
