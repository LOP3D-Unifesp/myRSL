export const QA_QUESTIONS = [
  {
    key: "qa_q1",
    label: "Q1 - Objective, Scope, and Justification",
    description: "Defines objective, scope, and engineering justification.",
  },
  {
    key: "qa_q2",
    label: "Q2 - Reproducible Configuration and Protocol",
    description: "Configuration, tasks/protocol, duration/sessions, and conditions are detailed enough to replicate.",
  },
  {
    key: "qa_q3",
    label: "Q3 - Data Collection and Processing Pipeline",
    description: "What was collected, how, instruments, frequency/duration, and processing pipeline are clearly described.",
  },
  {
    key: "qa_q4",
    label: "Q4 - Metrics and Statistical Analysis",
    description: "Operational metrics are defined and statistical analysis is applied to results.",
  },
  {
    key: "qa_q5",
    label: "Q5 - Variability and Limitations",
    description: "Discusses variability, bias, sample size, generalization, and technical limitations.",
  },
  {
    key: "qa_q6",
    label: "Q6 - Pediatric Population Definition",
    description: "Pediatric population is clearly characterized by age range or clinical context.",
  },
  {
    key: "qa_q7",
    label: "Q7 - Sensor and Hardware Specification",
    description: "Sensor type/model, architecture, sampling/filtering, and commercial availability are specified.",
  },
  {
    key: "qa_q8",
    label: "Q8 - Pediatric Physiology Considerations",
    description: "Design considers strength, fatigue, motor variability, weaker sEMG, or neuromuscular maturation.",
  },
  {
    key: "qa_q9",
    label: "Q9 - Growth Accommodation Strategy",
    description: "Provides and validates a technical solution for growth adaptation (parametric/modular/adjustable fitting).",
  },
  {
    key: "qa_q10",
    label: "Q10 - Challenge-Solution Validation",
    description: "Proposes and validates with data a solution to a specific technical challenge.",
  },
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
