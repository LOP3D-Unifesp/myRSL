import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createArticleMock: vi.fn(),
  updateArticleMock: vi.fn(),
  navigateMock: vi.fn(),
  paramsMock: {} as Record<string, string>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => mocks.paramsMock,
    useNavigate: () => mocks.navigateMock,
  };
});

vi.mock("@/lib/articles", async () => {
  const actual = await vi.importActual("@/lib/articles");
  return {
    ...actual,
    createArticle: mocks.createArticleMock,
    updateArticle: mocks.updateArticleMock,
    fetchArticle: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    storage: { from: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}));

import ArticleForm from "@/pages/ArticleForm";

describe("ArticleForm", () => {
  it("saves first author without overwriting authors list", async () => {
    mocks.paramsMock = {};
    mocks.createArticleMock.mockResolvedValue({ id: "article-1" });
    const { container } = render(<ArticleForm />);

    const inputs = container.querySelectorAll("input:not([type='file'])");
    const firstAuthorInput = inputs[2] as HTMLInputElement;
    fireEvent.change(firstAuthorInput, { target: { value: "Alice" } });

    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    }

    fireEvent.click(screen.getByRole("button", { name: /Save Final/i }));

    await waitFor(() => {
      expect(mocks.createArticleMock).toHaveBeenCalled();
    });

    const payload = mocks.createArticleMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.first_author).toBe("Alice");
    expect(payload.author).toBeNull();
    expect(mocks.navigateMock).toHaveBeenCalledWith("/articles");
  });

  it("navigates back to article detail after editing", async () => {
    mocks.paramsMock = { id: "article-42" };
    mocks.updateArticleMock.mockResolvedValue({ id: "article-42" });

    render(<ArticleForm />);

    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    }

    fireEvent.click(screen.getByRole("button", { name: /Save Final/i }));

    await waitFor(() => {
      expect(mocks.updateArticleMock).toHaveBeenCalled();
    });

    expect(mocks.navigateMock).toHaveBeenCalledWith("/articles/article-42");
  });
});
