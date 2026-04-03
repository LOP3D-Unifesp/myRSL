import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getSessionMock: vi.fn(),
  refreshSessionMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
    auth: {
      getSession: mocks.getSessionMock,
      refreshSession: mocks.refreshSessionMock,
    },
  },
}));

import { syncCurrentUserDoiMetadata } from "@/lib/articles";

describe("syncCurrentUserDoiMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetchMock);

    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: "token-123",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      error: null,
    });
    mocks.refreshSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: "token-456",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      error: null,
    });
  });

  it("calls edge function and normalizes full payload", async () => {
    mocks.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
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
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const result = await syncCurrentUserDoiMetadata({
      articleIds: ["a1", "a2"],
      includeAbstract: true,
      limit: 200,
    });

    expect(mocks.fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = mocks.fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual(expect.objectContaining({
      Authorization: "Bearer token-123",
    }));
    expect(result.summary.updated_safe).toBe(1);
    expect(result.conflictQueue).toHaveLength(1);
    expect(result.conflicts_count).toBe(2);
  });

  it("normalizes legacy payload shape without summary", async () => {
    mocks.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        processed: 3,
        updated: 2,
        unchanged: 1,
        missing_source: 0,
        failed: 0,
        conflict_articles: 0,
        conflict_fields: 0,
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const result = await syncCurrentUserDoiMetadata();

    expect(result.summary.processed).toBe(3);
    expect(result.summary.updated_safe).toBe(2);
    expect(result.updated).toBe(2);
    expect(result.conflictQueue).toHaveLength(0);
  });

  it("throws controlled error when edge function returns error", async () => {
    mocks.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(syncCurrentUserDoiMetadata()).rejects.toThrow("Rate limit exceeded, please try again later.");
  });

  it("throws friendly error on 401 unauthorized from edge function", async () => {
    mocks.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid JWT" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(syncCurrentUserDoiMetadata()).rejects.toThrow(
      "Your session is invalid or expired. Please sign in again and retry DOI sync.",
    );
  });

  it("refreshes token when current session is near expiration", async () => {
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: "old-token",
          expires_at: Math.floor(Date.now() / 1000) + 5,
        },
      },
      error: null,
    });
    mocks.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        summary: {
          processed: 0,
          updated_safe: 0,
          unchanged: 0,
          missing_source: 0,
          failed: 0,
          conflict_articles: 0,
          conflict_fields: 0,
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    await syncCurrentUserDoiMetadata();

    expect(mocks.refreshSessionMock).toHaveBeenCalledTimes(1);
    const [, init] = mocks.fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual(expect.objectContaining({
      Authorization: "Bearer token-456",
    }));
  });
});
