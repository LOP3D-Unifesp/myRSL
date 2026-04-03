import { describe, expect, it } from "vitest";
import { sanitizeExtractedArticle, sanitizeArticleWriteInput } from "@/lib/article-schemas";

describe("article schema sanitizers", () => {
  it("rejects invalid year in write payload", () => {
    expect(() => sanitizeArticleWriteInput({ year: 3000 })).toThrowError();
  });

  it("keeps only known extracted fields", () => {
    const extracted = sanitizeExtractedArticle({
      title: "Paper title",
      unknown_field: "ignored",
    });
    expect(extracted.title).toBe("Paper title");
    expect((extracted as Record<string, unknown>).unknown_field).toBeUndefined();
  });

  it("accepts dof up to 2000 chars and rejects above limit", () => {
    const validDof = "d".repeat(2000);
    const invalidDof = "d".repeat(2001);

    expect(() => sanitizeArticleWriteInput({ dof: validDof })).not.toThrow();
    expect(() => sanitizeArticleWriteInput({ dof: invalidDof })).toThrowError();
  });

  it("accepts technical_challenges up to 10000 chars and rejects above limit", () => {
    const validChallenges = "c".repeat(10000);
    const invalidChallenges = "c".repeat(10001);

    expect(() => sanitizeArticleWriteInput({ technical_challenges: validChallenges })).not.toThrow();
    expect(() => sanitizeArticleWriteInput({ technical_challenges: invalidChallenges })).toThrowError();
  });
});
