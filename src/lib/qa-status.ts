export const QA_STATUSES = ["not_assessed", "awaiting_second", "needs_consensus", "consensus"] as const;
export type QaConsensusStatus = (typeof QA_STATUSES)[number];

export const QA_STATUS_LABELS: Record<QaConsensusStatus, string> = {
  not_assessed: "No QA yet",
  awaiting_second: "Awaiting 2nd QA",
  needs_consensus: "Needs consensus",
  consensus: "QA consensus",
};

export function isQaStatus(value: string | null | undefined): value is QaConsensusStatus {
  return (QA_STATUSES as readonly string[]).includes(value ?? "");
}

export function qaStatusOf(value: string | null | undefined): QaConsensusStatus {
  return isQaStatus(value) ? value : "not_assessed";
}

// Tones understood by StatusBadge.
export type QaStatusTone = "success" | "warning" | "draft";

export function qaStatusTone(status: QaConsensusStatus): QaStatusTone {
  if (status === "consensus") return "success";
  if (status === "needs_consensus") return "warning";
  return "draft";
}
