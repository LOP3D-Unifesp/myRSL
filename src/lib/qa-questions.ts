export const QA_QUESTIONS = [
  { key: "qa_q1", label: "Q1 – Objective and Relevance", description: "Does the study clearly state its objective and relevance to the field?" },
  { key: "qa_q2", label: "Q2 – Technical Reproducibility", description: "Is the technical design described with sufficient detail for reproducibility?" },
  { key: "qa_q3", label: "Q3 – Acquisition and Processing", description: "Are data acquisition and processing methods clearly described?" },
  { key: "qa_q4", label: "Q4 – Metrics and Results", description: "Are outcome metrics and results clearly reported?" },
  { key: "qa_q5", label: "Q5 – Discussion and Limitations", description: "Does the study adequately discuss findings and limitations?" },
  { key: "qa_q6", label: "Q6 – Target Population", description: "Is the target population clearly defined and appropriate?" },
  { key: "qa_q7", label: "Q7 – Sensor and Cost", description: "Are sensor choices and cost considerations discussed?" },
  { key: "qa_q8", label: "Q8 – Muscle Physiology", description: "Are muscle physiology aspects appropriately addressed?" },
  { key: "qa_q9", label: "Q9 – Scalability and Growth", description: "Are scalability and growth accommodation strategies discussed?" },
  { key: "qa_q10", label: "Q10 – Mitigation of Challenges", description: "Are technical challenges identified and mitigations proposed?" },
] as const;

export type QAKey = typeof QA_QUESTIONS[number]["key"];

export function calculateQAScore(answers: Record<QAKey, string | null>): number {
  let score = 0;
  for (const q of QA_QUESTIONS) {
    const val = answers[q.key];
    if (val === "Yes") score += 1;
    else if (val === "Partial") score += 0.5;
  }
  return score;
}
