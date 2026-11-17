import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchRecordsMock: vi.fn(),
  fetchCriteriaMock: vi.fn(),
  saveDecisionMock: vi.fn(),
  createArticleMock: vi.fn(),
  linkMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

vi.mock("@/lib/screening", async () => {
  const actual = await vi.importActual<typeof import("@/lib/screening")>("@/lib/screening");
  return {
    ...actual,
    fetchScreeningRecords: mocks.fetchRecordsMock,
    saveScreeningDecision: mocks.saveDecisionMock,
    linkRecordToArticle: mocks.linkMock,
  };
});

vi.mock("@/lib/protocol", async () => {
  const actual = await vi.importActual<typeof import("@/lib/protocol")>("@/lib/protocol");
  return { ...actual, fetchProtocolCriteria: mocks.fetchCriteriaMock };
});

vi.mock("@/lib/articles", async () => {
  const actual = await vi.importActual<typeof import("@/lib/articles")>("@/lib/articles");
  return { ...actual, createArticle: mocks.createArticleMock, fetchArticleSummaries: vi.fn().mockResolvedValue([{ study_id: "SCOPUS_4 / x" }]) };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Screening from "@/pages/Screening";
import { AuthUserIdProvider } from "@/contexts/auth-user-id";

const record = (overrides: Record<string, unknown>) => ({
  id: "r1", review_id: "rev", source_database: "Scopus", title: "Record", authors: "A", journal: "J", year: 2020,
  doi: "10.1/x", url: null, abstract: "Abstract", keywords: null, document_type: null, status: "unclassified",
  criterion_code: null, comments: null, screened_by: null, screened_at: null, article_id: null, created_at: "", updated_at: "",
  ...overrides,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthUserIdProvider userId="user-1">
        <MemoryRouter>
          <Screening />
        </MemoryRouter>
      </AuthUserIdProvider>
    </QueryClientProvider>,
  );
}

describe("Screening page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchCriteriaMock.mockResolvedValue([
      { id: "c1", review_id: "rev", kind: "exclusion", code: "EC1", text: "Does not involve EMG", position: 0 },
    ]);
    mocks.fetchRecordsMock.mockResolvedValue([
      record({ id: "r1", title: "First accepted", status: "accepted" }),
      record({ id: "r2", title: "Second rejected", status: "rejected", criterion_code: "EC1", source_database: "IEEE" }),
      record({ id: "r3", title: "Third duplicate", status: "duplicate" }),
    ]);
  });

  it("shows counts and filters by status", async () => {
    renderPage();
    expect(await screen.findByText("First accepted")).toBeInTheDocument();
    expect(screen.getByText("Second rejected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Rejected/ }));
    expect(screen.queryByText("First accepted")).not.toBeInTheDocument();
    expect(screen.getByText("Second rejected")).toBeInTheDocument();
  });

  it("saves a decision with the chosen status", async () => {
    mocks.saveDecisionMock.mockResolvedValue({});
    renderPage();
    const row = (await screen.findByText("Third duplicate")).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Decide" }));

    fireEvent.change(await screen.findByLabelText("Comments"), { target: { value: "same as r1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save decision" }));

    await waitFor(() => expect(mocks.saveDecisionMock).toHaveBeenCalled());
    expect(mocks.saveDecisionMock).toHaveBeenCalledWith("r3", { status: "duplicate", criterion_code: null, comments: "same as r1" });
  });

  it("creates an article from an accepted record with the next study id", async () => {
    mocks.createArticleMock.mockResolvedValue({ id: "article-9" });
    mocks.linkMock.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Create article from First accepted" }));
    await waitFor(() => expect(mocks.createArticleMock).toHaveBeenCalled());
    expect(mocks.createArticleMock.mock.calls[0][0]).toMatchObject({
      title: "First accepted",
      doi: "10.1/x",
      source_database: "Scopus",
      study_id: "SCOPUS_5",
      is_draft: true,
    });
    await waitFor(() => expect(mocks.linkMock).toHaveBeenCalledWith("r1", "article-9"));
  });
});
