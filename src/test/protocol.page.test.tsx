import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchProtocolMock: vi.fn(),
  fetchDatabasesMock: vi.fn(),
  saveProtocolMock: vi.fn(),
  saveDatabaseMock: vi.fn(),
  deleteDatabaseMock: vi.fn(),
}));

vi.mock("@/lib/protocol", () => ({
  fetchProtocol: mocks.fetchProtocolMock,
  fetchProtocolDatabases: mocks.fetchDatabasesMock,
  saveProtocol: mocks.saveProtocolMock,
  saveProtocolDatabase: mocks.saveDatabaseMock,
  deleteProtocolDatabase: mocks.deleteDatabaseMock,
}));

vi.mock("@/contexts/current-review", () => ({
  useCurrentReview: () => ({ review: { id: "review-1", name: "Test review", role: "owner" }, reviews: [], selectReview: vi.fn() }),
}));

vi.mock("@/lib/reviews", () => ({
  fetchReviewMembers: vi.fn().mockResolvedValue([]),
  addReviewMember: vi.fn(),
  removeReviewMember: vi.fn(),
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
        <Protocol />
      </AuthUserIdProvider>
    </QueryClientProvider>,
  );
}

const DATABASE = {
  id: "db-1",
  user_id: "user-1",
  name: "Scopus",
  search_string: "TITLE-ABS-KEY(prosthesis)",
  searched_at: "2026-04-01",
  results_count: 120,
  created_at: "",
  updated_at: "",
};

describe("Protocol page", () => {
  it("shows the databases summary and table", async () => {
    mocks.fetchProtocolMock.mockResolvedValue(null);
    mocks.fetchDatabasesMock.mockResolvedValue([DATABASE]);
    renderPage();

    expect(await screen.findByText("TITLE-ABS-KEY(prosthesis)")).toBeInTheDocument();
    expect(screen.getByText("Records identified")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
  });

  it("adds a criterion, flags unsaved changes and saves", async () => {
    mocks.fetchProtocolMock.mockResolvedValue(null);
    mocks.fetchDatabasesMock.mockResolvedValue([]);
    mocks.saveProtocolMock.mockResolvedValue({});
    renderPage();

    openTab("Eligibility");
    type("Add Inclusion criteria", "Upper limb prostheses");
    fireEvent.keyDown(screen.getByLabelText("Add Inclusion criteria"), { key: "Enter" });

    expect(screen.getByLabelText("Inclusion criteria 1")).toHaveValue("Upper limb prostheses");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.saveProtocolMock).toHaveBeenCalled());
    expect(mocks.saveProtocolMock.mock.calls[0][0].inclusion_criteria).toEqual(["Upper limb prostheses"]);
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Remove Inclusion criteria 1" }));
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("lists research questions with the first as main and promotes another", async () => {
    mocks.fetchProtocolMock.mockResolvedValue({
      research_questions: ["Main question", "Second question"],
      period_from: null,
      period_to: null,
      languages: [],
      extraction_notes: null,
      inclusion_criteria: [],
      exclusion_criteria: [],
    });
    mocks.fetchDatabasesMock.mockResolvedValue([]);
    renderPage();

    openTab("Scope");
    expect(await screen.findByLabelText("Research questions 1")).toHaveValue("Main question");
    expect(screen.getByText("Main")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Make Research questions 2 the main one" }));
    expect(screen.getByLabelText("Research questions 1")).toHaveValue("Second question");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("blocks saving when the period start is after the end", async () => {
    mocks.fetchProtocolMock.mockResolvedValue(null);
    mocks.fetchDatabasesMock.mockResolvedValue([]);
    renderPage();

    openTab("Scope");
    type("Period from (year)", "2024");
    type("Period to (year)", "2020");

    expect(screen.getByRole("alert")).toHaveTextContent("Period start must not be after the end.");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("validates the database name in the dialog", async () => {
    mocks.fetchProtocolMock.mockResolvedValue(null);
    mocks.fetchDatabasesMock.mockResolvedValue([DATABASE]);
    renderPage();

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
