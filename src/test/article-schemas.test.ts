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
});
