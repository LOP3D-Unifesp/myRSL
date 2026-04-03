import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  eqMock: vi.fn(),
  selectMock: vi.fn(),
  singleMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: mocks.getUserMock,
    },
    from: mocks.fromMock,
  },
}));

import { createArticle, updateArticle } from "@/lib/articles";

describe("articles integration with supabase client", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    mocks.singleMock.mockResolvedValue({ data: { id: "article-1" }, error: null });
    mocks.selectMock.mockReturnValue({ single: mocks.singleMock });
    mocks.eqMock.mockReturnValue({ select: mocks.selectMock, single: mocks.singleMock });
    mocks.insertMock.mockReturnValue({ select: mocks.selectMock });
    mocks.updateMock.mockReturnValue({ eq: mocks.eqMock, select: mocks.selectMock });

    mocks.fromMock.mockReturnValue({
      insert: mocks.insertMock,
      update: mocks.updateMock,
    });
  });

  it("persists first_author on create", async () => {
    await createArticle({ first_author: "Alice", title: "Paper" });

    expect(mocks.insertMock).toHaveBeenCalledTimes(1);
    const payload = mocks.insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.first_author).toBe("Alice");
    expect(payload.author).toBeUndefined();
    expect(payload.user_id).toBe("user-1");
  });

  it("validates payload on update before calling supabase", async () => {
    await expect(updateArticle("article-1", { year: 3001 })).rejects.toThrow();
    expect(mocks.updateMock).not.toHaveBeenCalled();
  });
});
