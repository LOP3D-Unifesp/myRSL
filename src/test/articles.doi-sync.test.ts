import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  fromMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mocks.invokeMock,
    },
    from: mocks.fromMock,
    auth: {
      getUser: mocks.getUserMock,
    },
  },
}));

import { syncCurrentUserDoiMetadata } from "@/lib/articles";

describe("syncCurrentUserDoiMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls edge function and normalizes full payload", async () => {
    mocks.invokeMock.mockResolvedValue({
      data: {
        summary: {
          processed: 2,
          updated_safe: 1,
          unchanged: 1,
          missing_source: 0,
          failed: 0,
          conflict_articles: 1,
          conflict_fields: 2,
        },
        conflictQueue: [
          {
            articleId: "a1",
            studyId: "S-1",
            doiCurrent: "10.x/current",
            doiSuggested: "10.x/new",
            titleCurrent: "Old title",
            current: {
              doi: "10.x/current",
              title: "Old title",
              year: 2020,
              author: "A",
              first_author: "A",
              last_author: "B",
              abstract: null,
            },
            suggested: {
              doi: "10.x/new",
              title: "New title",
              year: 2021,
              author: "A; B",
              first_author: "A",
              last_author: "B",
              abstract: "Abs",
            },
            fields: [
              { field: "title", currentValue: "Old title", suggestedValue: "New title" },
              { field: "year", currentValue: "2020", suggestedValue: "2021" },
            ],
          },
        ],
        conflicts_count: 2,
        conflicts: [
          { articleId: "a1", field: "title", currentValue: "Old title", suggestedValue: "New title" },
          { articleId: "a1", field: "year", currentValue: "2020", suggestedValue: "2021" },
        ],
      },
      error: null,
    });

    const result = await syncCurrentUserDoiMetadata({
      articleIds: ["a1", "a2"],
      includeAbstract: true,
      limit: 200,
    });

    expect(mocks.invokeMock).toHaveBeenCalledWith("sync-dois", {
      body: {
        articleIds: ["a1", "a2"],
        includeAbstract: true,
        limit: 200,
      },
    });
    expect(result.summary.updated_safe).toBe(1);
    expect(result.conflictQueue).toHaveLength(1);
    expect(result.conflicts_count).toBe(2);
  });

  it("normalizes legacy payload shape without summary", async () => {
    mocks.invokeMock.mockResolvedValue({
      data: {
        processed: 3,
        updated: 2,
        unchanged: 1,
        missing_source: 0,
        failed: 0,
        conflict_articles: 0,
        conflict_fields: 0,
      },
      error: null,
    });

    const result = await syncCurrentUserDoiMetadata();

    expect(result.summary.processed).toBe(3);
    expect(result.summary.updated_safe).toBe(2);
    expect(result.updated).toBe(2);
    expect(result.conflictQueue).toHaveLength(0);
  });

  it("throws controlled error when edge function returns error", async () => {
    mocks.invokeMock.mockResolvedValue({
      data: null,
      error: { message: "Rate limit exceeded, please try again later." },
    });

    await expect(syncCurrentUserDoiMetadata()).rejects.toThrow("Rate limit exceeded, please try again later.");
  });
});
