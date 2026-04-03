export type VerificationKey = "verify_peer1" | "verify_peer2" | "verify_qa3" | "verify_qa4";

export type VerificationStage = {
  key: VerificationKey;
  label: string;
  badgeLabel: string;
};

export const VERIFICATION_STAGES: VerificationStage[] = [
  { key: "verify_qa3", label: "QA P1", badgeLabel: "QA P1" },
  { key: "verify_peer1", label: "Peer 1", badgeLabel: "P1" },
  { key: "verify_qa4", label: "QA P2", badgeLabel: "QA P2" },
  { key: "verify_peer2", label: "Peer 2", badgeLabel: "P2" },
];

export const VERIFICATION_KEYS = VERIFICATION_STAGES.map((stage) => stage.key);

export function isVerificationKey(value: string): value is VerificationKey {
  return VERIFICATION_KEYS.includes(value as VerificationKey);
}

export function parseVerificationFilters(raw: string | null): Set<VerificationKey> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter((item): item is VerificationKey => isVerificationKey(item)),
  );
}

export function serializeVerificationFilters(filters: Set<VerificationKey>): string {
  return VERIFICATION_KEYS
    .filter((key) => filters.has(key))
    .join(",");
}

export function countCompletedVerifications(values: Partial<Record<VerificationKey, boolean | null | undefined>>): number {
  return VERIFICATION_KEYS.filter((key) => Boolean(values[key])).length;
}

export function isFullyVerified(values: Partial<Record<VerificationKey, boolean | null | undefined>>): boolean {
  return VERIFICATION_KEYS.every((key) => Boolean(values[key]));
}

export function verificationLabelFor(key: VerificationKey): string {
  return VERIFICATION_STAGES.find((stage) => stage.key === key)?.label ?? key;
}
