import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { buildPrismaCounts, suggestStudyId } from "@/lib/screening";
import { mapParsifalRows, matchCriterionCode, normalizeDoi, normalizeSource } from "@/lib/screening-import";

const CRITERIA = [
  { code: "IC1", text: "Reports on technologies for prosthetic control." },
  { code: "EC1", text: "Does not involve EMG-based prosthetic control." },
  { code: "EC2", text: "Not related to upper limb prostheses." },
];

describe("Parsifal import mapping", () => {
  it("normalizes DOIs and source names", () => {
    expect(normalizeDoi("https://doi.org/10.1000/ABC")).toBe("10.1000/abc");
    expect(normalizeDoi("  ")).toBeNull();
    expect(normalizeSource("IEEE Digital Library")).toBe("IEEE");
    expect(normalizeSource("ACM Digital Library")).toBe("ACM");
    expect(normalizeSource("Web of Science")).toBe("Web of Science");
  });

  it("matches a criterion by its text regardless of spacing and case", () => {
    expect(matchCriterionCode("does not involve  EMG-based prosthetic control.", CRITERIA)).toBe("EC1");
    expect(matchCriterionCode("Something else", CRITERIA)).toBeNull();
    expect(matchCriterionCode("", CRITERIA)).toBeNull();
  });

  it("maps status, source, criterion and skips rows without title or DOI", () => {
    const { rows, invalid, unmatchedCriteria } = mapParsifalRows(
      [
        { title: "A", doi: "10.1/a", source: "Scopus", status: "Accepted", selection_criteria: CRITERIA[0].text, year: 2020 },
        { title: "B", source: "PubMed", status: "Duplicated" },
        { title: "C", doi: "10.1/c", source: "ACM Digital Library", status: "Rejected", selection_criteria: "A criterion that is not in the protocol", comments: " note " },
        { author: "nobody", status: "Rejected" },
      ],
      CRITERIA,
    );

    expect(rows.map((row) => row.record.status)).toEqual(["accepted", "duplicate", "rejected"]);
    expect(rows[0].record).toMatchObject({ source_database: "Scopus", criterion_code: "IC1", year: 2020, doi: "10.1/a" });
    expect(rows[2].record).toMatchObject({ source_database: "ACM", criterion_code: null, comments: "note" });
    expect(unmatchedCriteria).toEqual(["A criterion that is not in the protocol"]);
    expect(invalid).toEqual([{ rowNumber: 5, reason: "Row has neither a title nor a DOI." }]);
  });
});

describe("buildPrismaCounts", () => {
  it("counts the flow and the exclusion reasons", () => {
    const counts = buildPrismaCounts(
      [
        { status: "accepted", source_database: "Scopus", criterion_code: "IC1", article_id: "a1" },
        { status: "accepted", source_database: "Scopus", criterion_code: null, article_id: null },
        { status: "rejected", source_database: "IEEE", criterion_code: "EC1", article_id: null },
        { status: "rejected", source_database: "IEEE", criterion_code: "EC1", article_id: null },
        { status: "rejected", source_database: "ACM", criterion_code: "EC2", article_id: null },
        { status: "rejected", source_database: "ACM", criterion_code: null, article_id: null },
        { status: "duplicate", source_database: "PubMed", criterion_code: null, article_id: null },
        { status: "unclassified", source_database: null, criterion_code: null, article_id: null },
      ],
      CRITERIA,
    );

    expect(counts).toMatchObject({ identified: 8, duplicates: 1, screened: 7, excluded: 4, included: 2, extracted: 1, unclassified: 1 });
    expect(counts.bySource.find((item) => item.source === "Not specified")?.count).toBe(1);
    expect(counts.excludedByCriterion[0]).toEqual({ code: "EC1", text: CRITERIA[1].text, count: 2 });
    expect(counts.excludedByCriterion.some((item) => item.text === "No criterion recorded")).toBe(true);
  });
});

describe("suggestStudyId", () => {
  it("continues the numbering for a source", () => {
    const existing = ["SCOPUS_22 / Jiang et al., 2017", "SCOPUS_3", "IEEE_9 / x", null];
    expect(suggestStudyId("Scopus", existing)).toBe("SCOPUS_23");
    expect(suggestStudyId("IEEE", existing)).toBe("IEEE_10");
    expect(suggestStudyId("ACM", existing)).toBe("ACM_1");
    expect(suggestStudyId("Web of Science", existing)).toBe("WEBOFSCI_1");
  });
});
