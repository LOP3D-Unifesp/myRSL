import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mocks.invokeMock,
    },
  },
}));

import PdfChatPanel from "@/components/PdfChatPanel";

describe("PdfChatPanel", () => {
  it("sends articleId in chat-with-pdf payload", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      value: vi.fn(),
      writable: true,
    });
    mocks.invokeMock.mockResolvedValue({
      data: { reply: "ok" },
      error: null,
    });

    render(<PdfChatPanel articleId="article-123" articleTitle="Paper A" />);

    fireEvent.change(screen.getByPlaceholderText(/Ask about this paper/i), {
      target: { value: "What is the main outcome?" },
    });
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mocks.invokeMock).toHaveBeenCalledWith("chat-with-pdf", expect.objectContaining({
        body: expect.objectContaining({
          articleId: "article-123",
          articleTitle: "Paper A",
          messages: [expect.objectContaining({ role: "user", content: "What is the main outcome?" })],
        }),
      }));
    });
  });
});
