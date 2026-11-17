import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchProtocolMock: vi.fn(),
  fetchCriteriaMock: vi.fn(),
  fetchQuestionsMock: vi.fn(),
  fetchQaMock: vi.fn(),
  fetchDatabasesMock: vi.fn(),
  saveProtocolMock: vi.fn(),
  saveListsMock: vi.fn(),
  saveDatabaseMock: vi.fn(),
  deleteDatabaseMock: vi.fn(),
}));

vi.mock("@/lib/protocol", async () => {
  const actual = await vi.importActual<typeof import("@/lib/protocol")>("@/lib/protocol");
  return {
    ...actual,
    fetchProtocol: mocks.fetchProtocolMock,
    fetchProtocolCriteria: mocks.fetchCriteriaMock,
    fetchProtocolQuestions: mocks.fetchQuestionsMock,
    fetchProtocolQaItems: mocks.fetchQaMock,
    fetchProtocolDatabases: mocks.fetchDatabasesMock,
    saveProtocol: mocks.saveProtocolMock,
    saveProtocolLists: mocks.saveListsMock,
    saveProtocolDatabase: mocks.saveDatabaseMock,
    deleteProtocolDatabase: mocks.deleteDatabaseMock,
  };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

vi.mock("@/contexts/current-review", () => ({
  reviewsQueryKey: () => ["reviews"],
  useCurrentReview: () => ({ review: { id: "review-1", name: "Test review", role: "owner" }, reviews: [], selectReview: vi.fn() }),
}));

vi.mock("@/lib/reviews", () => ({
  fetchReviewMembers: vi.fn().mockResolvedValue([]),
  addReviewMember: vi.fn(),
  removeReviewMember: vi.fn(),
  renameReview: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Protocol from "@/pages/Protocol";
import { AuthUserIdProvider } from "@/contexts/auth-user-id";

const openTab = (name: string) => {
  const tab = screen.getByRole("tab", { name });
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
};

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthUserIdProvider userId="user-1">
        <MemoryRouter>
          <Protocol />
        </MemoryRouter>
      </AuthUserIdProvider>
    </QueryClientProvider>,
  );
}

function givenEmptyProtocol(databases: unknown[] = []) {
  mocks.fetchProtocolMock.mockResolvedValue(null);
  mocks.fetchCriteriaMock.mockResolvedValue([]);
  mocks.fetchQuestionsMock.mockResolvedValue([]);
  mocks.fetchQaMock.mockResolvedValue([]);
  mocks.fetchDatabasesMock.mockResolvedValue(databases);
  mocks.saveProtocolMock.mockResolvedValue({});
  mocks.saveListsMock.mockResolvedValue(undefined);
}

const DATABASE = {
  id: "db-1",
  review_id: "review-1",
  user_id: "user-1",
  name: "Scopus",
  url: null,
  search_string: "TITLE-ABS-KEY(prosthesis)",
  searched_at: "2026-04-01",
  results_count: 120,
  created_at: "",
  updated_at: "",
};

describe("Protocol page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the databases summary and table", async () => {
    givenEmptyProtocol([DATABASE]);
    renderPage();

    expect(await screen.findByText("Records identified")).toBeInTheDocument();
    await screen.findByRole("tab", { name: "Overview" });
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
    openTab("Databases");
    expect(await screen.findByText("TITLE-ABS-KEY(prosthesis)")).toBeInTheDocument();
  });

  it("adds a criterion with its code, flags unsaved changes and saves", async () => {
    givenEmptyProtocol();
    renderPage();
    await screen.findByRole("tab", { name: "Overview" });

    openTab("Eligibility");
    type("Add Inclusion criteria", "Upper limb prostheses");
    fireEvent.keyDown(screen.getByLabelText("Add Inclusion criteria"), { key: "Enter" });

    expect(screen.getByLabelText("Inclusion criteria 1")).toHaveValue("Upper limb prostheses");
    expect(screen.getByText("IC1")).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.saveListsMock).toHaveBeenCalled());
    expect(mocks.saveListsMock.mock.calls[0][0].criteria).toEqual([{ kind: "inclusion", code: "IC1", text: "Upper limb prostheses" }]);
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Remove Inclusion criteria 1" }));
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("saves the overview fields, PICOC and keywords", async () => {
    givenEmptyProtocol();
    renderPage();
    await screen.findByRole("tab", { name: "Overview" });

    type("Title", "Pediatric prostheses");
    fireEvent.change(screen.getByLabelText("Population"), { target: { value: "Children with limb absence" } });
    fireEvent.click(screen.getByRole("button", { name: "Add keyword" }));
    type("Keyword 1", "pediatric");
    type("Synonyms of keyword 1", "child, children");

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.saveProtocolMock).toHaveBeenCalled());
    const saved = mocks.saveProtocolMock.mock.calls[0][0];
    expect(saved.title).toBe("Pediatric prostheses");
    expect(saved.picoc.population).toBe("Children with limb absence");
    expect(saved.keywords).toEqual([{ term: "pediatric", synonyms: ["child", "children"] }]);
  });

  it("blocks saving when the period start is after the end", async () => {
    givenEmptyProtocol();
    renderPage();
    await screen.findByRole("tab", { name: "Overview" });

    type("Period from (year)", "2024");
    type("Period to (year)", "2020");

    expect(screen.getByRole("alert")).toHaveTextContent("Period start must not be after the end.");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("shows the default research questions and lets another one become the main", async () => {
    givenEmptyProtocol();
    renderPage();
    await screen.findByRole("tab", { name: "Overview" });

    openTab("Questions");
    expect(document.querySelector<HTMLInputElement>("#rq-label-1")?.value).toBe("Technology and Design");
    expect(screen.getByText("Main")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Make main" })[0]);
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add question" }));
    expect(document.querySelector<HTMLInputElement>("#rq-code-6")?.value).toBe("Q7");
  });

  it("lists the ten QA slots and saves edited wording", async () => {
    givenEmptyProtocol();
    renderPage();
    await screen.findByRole("tab", { name: "Overview" });

    openTab("Quality");
    expect(screen.getAllByText(/^Item \d+$/)).toHaveLength(10);

    fireEvent.change(document.querySelector("#qa-label-qa_q1") as HTMLInputElement, { target: { value: "Is the objective clearly stated?" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.saveListsMock).toHaveBeenCalled());
    expect(mocks.saveListsMock.mock.calls[0][0].qa[0]).toMatchObject({ slot: "qa_q1", label: "Is the objective clearly stated?" });
    expect(mocks.saveListsMock.mock.calls[0][0].qa).toHaveLength(10);
  });

  it("validates the database name in the dialog", async () => {
    givenEmptyProtocol([DATABASE]);
    renderPage();
    await screen.findByRole("tab", { name: "Overview" });

    openTab("Databases");
    fireEvent.click(await screen.findByRole("button", { name: "Edit Scopus" }));
    type("Database", "");
    expect(screen.getByRole("button", { name: "Save database" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Add database" })[0]);
    type("Database", "scopus");
    expect(screen.getByRole("alert")).toHaveTextContent("already exists");
    expect(screen.getByRole("button", { name: "Save database" })).toBeDisabled();
  });
});
