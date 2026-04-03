import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const fixture = [
  {
    id: "draft-1",
    is_draft: true,
    created_at: "2026-03-03T10:00:00.000Z",
    author: "Alice",
    first_author: "Alice",
    year: 2025,
    study_id: "S-100",
    prosthesis_name: "Adaptive Hand",
    title: "Draft title",
    country: "Brazil",
    verify_peer1: false,
    verify_peer2: false,
    verify_qa3: false,
    verify_qa4: false,
  },
  {
    id: "pending-1",
    is_draft: false,
    created_at: "2026-03-02T10:00:00.000Z",
    author: "Bob",
    first_author: "Bob",
    year: 2024,
    study_id: "S-101",
    prosthesis_name: "Sensory Limb",
    title: "Pending title",
    country: "USA",
    verify_peer1: true,
    verify_peer2: false,
    verify_qa3: true,
    verify_qa4: false,
  },
  {
    id: "verified-1",
    is_draft: false,
    created_at: "2026-03-01T10:00:00.000Z",
    author: "Carol",
    first_author: "Carol",
    year: 2023,
    study_id: "S-102",
    prosthesis_name: "Neuro Arm",
    title: "Verified title",
    country: "Canada",
    verify_peer1: true,
    verify_peer2: true,
    verify_qa3: true,
    verify_qa4: true,
  },
  {
    id: "geo-1",
    is_draft: false,
    created_at: "2026-02-28T10:00:00.000Z",
    author: "Dora",
    first_author: "Dora",
    year: 2022,
    study_id: "S-103",
    prosthesis_name: "Geo Limb",
    title: "Geography title",
    country: "Malaysia; Saudi Arabia",
    verify_peer1: true,
    verify_peer2: true,
    verify_qa3: true,
    verify_qa4: true,
  },
];

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: fixture, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/lib/articles", async () => {
  const actual = await vi.importActual("@/lib/articles");
  return {
    ...actual,
    fetchArticleSummaries: vi.fn(),
    syncCurrentUserDoiMetadata: vi.fn(),
  };
});

import Dashboard from "@/pages/Dashboard";

describe("Dashboard", () => {
  it("renders sections in operational order and exposes KPI links", () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    const snapshotHeading = screen.getByRole("heading", { name: "Snapshot" });
    const queueHeading = screen.getByRole("heading", { name: "Work Queue" });
    const recentHeading = screen.getByRole("heading", { name: "Recent Activity" });

    const snapshotSection = snapshotHeading.closest("section");
    const queueSection = queueHeading.closest("section");
    const recentSection = recentHeading.closest("section");

    expect(snapshotSection?.compareDocumentPosition(queueSection as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(queueSection?.compareDocumentPosition(recentSection as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const totalCard = screen.getByRole("link", { name: /Total Articles/i });
    const peer1Card = screen.getByRole("link", { name: /Peer 1/i });
    const peer2Card = screen.getByRole("link", { name: /Peer 2/i });
    const pendingCard = screen.getByRole("link", { name: /Pending Verification/i });

    expect(totalCard).toHaveAttribute("href", "/articles");
    expect(peer1Card).toHaveAttribute("href", "/verifications?filters=verify_peer1");
    expect(peer2Card).toHaveAttribute("href", "/verifications?filters=verify_peer2");
    expect(pendingCard).toHaveAttribute("href", "/verifications");

    expect(within(peer1Card).getByText("3")).toBeInTheDocument();
    expect(within(peer2Card).getByText("2")).toBeInTheDocument();

    expect(totalCard.compareDocumentPosition(peer1Card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(peer1Card.compareDocumentPosition(peer2Card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(peer2Card.compareDocumentPosition(pendingCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("prioritizes draft and pending actions before verified items in queue", () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    const queueSection = screen.getByRole("heading", { name: "Work Queue" }).closest("section");
    if (!queueSection) throw new Error("Work Queue section not found");

    const actionLinks = within(queueSection).getAllByRole("link");
    const actionLabels = actionLinks.map((item) => item.textContent ?? "");

    expect(actionLabels.some((label) => label.includes("Continue"))).toBe(true);
    expect(actionLabels.some((label) => label.includes("Review"))).toBe(true);
    expect(actionLabels.some((label) => label.includes("Open"))).toBe(true);

    const continueIndex = actionLabels.findIndex((label) => label.includes("Continue"));
    const reviewIndex = actionLabels.findIndex((label) => label.includes("Review"));
    const openIndex = actionLabels.findIndex((label) => label.includes("Open"));

    expect(continueIndex).toBeLessThan(reviewIndex);
    expect(reviewIndex).toBeLessThan(openIndex);
  });
});
