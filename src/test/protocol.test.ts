import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { deriveSourceDatabaseFromStudyId, protocolDatabaseWriteSchema } from "@/lib/protocol";

describe("deriveSourceDatabaseFromStudyId", () => {
  it("maps known study_id prefixes to database names", () => {
    expect(deriveSourceDatabaseFromStudyId("SCOPUS_22 / Jiang et al., 2017")).toBe("Scopus");
    expect(deriveSourceDatabaseFromStudyId("IEEE_3")).toBe("IEEE");
    expect(deriveSourceDatabaseFromStudyId("ACM_2 / Tabor et al. (2017)")).toBe("ACM");
    expect(deriveSourceDatabaseFromStudyId("PUBMED_1 / Battraw et al., 2024")).toBe("PubMed");
  });

  it("returns null for unknown or missing prefixes", () => {
    expect(deriveSourceDatabaseFromStudyId("S-1")).toBeNull();
    expect(deriveSourceDatabaseFromStudyId(null)).toBeNull();
  });
});

describe("protocolDatabaseWriteSchema", () => {
  it("requires a name and trims it", () => {
    expect(protocolDatabaseWriteSchema.parse({ name: "  Scopus " }).name).toBe("Scopus");
    expect(() => protocolDatabaseWriteSchema.parse({ name: "   " })).toThrow();
  });
});
