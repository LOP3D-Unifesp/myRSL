import { describe, expect, it } from "vitest";
import { QA_STATUSES, QA_STATUS_LABELS, qaStatusOf, qaStatusTone } from "@/lib/qa-status";

describe("QA consensus status", () => {
  it("has a label for every status and falls back to not assessed", () => {
    for (const status of QA_STATUSES) expect(QA_STATUS_LABELS[status]).toBeTruthy();
    expect(qaStatusOf("needs_consensus")).toBe("needs_consensus");
    expect(qaStatusOf("something else")).toBe("not_assessed");
    expect(qaStatusOf(null)).toBe("not_assessed");
  });

  it("highlights the statuses that need attention", () => {
    expect(qaStatusTone("consensus")).toBe("success");
    expect(qaStatusTone("needs_consensus")).toBe("warning");
    expect(qaStatusTone("awaiting_second")).toBe("draft");
  });
});
