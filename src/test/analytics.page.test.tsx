import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const fixture = [
  {
    id: "a-1",
    author: "Alice",
    year: 2024,
    country: "Brazil",
    control_strategy: [],
    study_design: "RCT",
    amputation_level: [],
    primary_research_question: "Question A",
    statistical_tests_performed: "Yes",
    has_pediatric_participants: "No",
    sensors: ["EMG"],
    feedback_modalities: ["Vibration"],
  },
  {
    id: "a-2",
    author: "Bob",
    year: 2023,
    country: "Malaysia; Saudi Arabia",
    control_strategy: [],
    study_design: "Case study",
    amputation_level: [],
    primary_research_question: "Question B",
    statistical_tests_performed: "No",
    has_pediatric_participants: "Yes",
    sensors: [],
    feedback_modalities: [],
  },
  {
    id: "a-3",
    author: "Carol",
    year: 2022,
    country: "Atlantis",
    control_strategy: [],
    study_design: "Review",
    amputation_level: [],
    primary_research_question: "Question C",
    statistical_tests_performed: "No",
    has_pediatric_participants: "No",
    sensors: [],
    feedback_modalities: [],
  },
];

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: fixture, isLoading: false }),
}));

vi.mock("@/lib/articles", async () => {
  const actual = await vi.importActual("@/lib/articles");
  return {
    ...actual,
    fetchArticles: vi.fn(),
  };
});

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

vi.mock("@/components/CrossAnalysis", () => ({
  default: () => <div>Cross Analysis Mock</div>,
}));

vi.mock("react-svg-worldmap", () => ({
  WorldMap: ({ data }: { data: Array<{ country: string; value: number }> }) => (
    <div data-testid="world-map">map-points:{data.length}</div>
  ),
  regions: [
    { name: "Brazil", code: "BR" },
    { name: "Malaysia", code: "MY" },
    { name: "Saudi Arabia", code: "SA" },
  ],
}));

import Analytics from "@/pages/Analytics";

describe("Analytics", () => {
  beforeEach(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("shows reordered sections and interactive KPI shortcuts", async () => {
    render(
      <MemoryRouter>
        <Analytics />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Global Snapshot" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Explore the Dataset" })).toBeInTheDocument();
    expect(screen.getByLabelText("Filter analytics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cross-Analysis" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jump to Countries" })).toBeInTheDocument();
    const countriesCard = screen.getByRole("button", { name: "Jump to Countries" });
    expect(within(countriesCard).getByText("4")).toBeInTheDocument();

    const cross = screen.getByRole("button", { name: "Cross-Analysis" });
    const overview = screen.getByRole("button", { name: "Overview" });
    const geography = screen.getByRole("button", { name: "Geography" });
    const pediatric = screen.getByRole("button", { name: "Pediatric" });
    const methodology = screen.getByRole("button", { name: "Methodology" });
    const participants = screen.getByRole("button", { name: "Participants and Technology" });

    expect(cross.compareDocumentPosition(overview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(overview.compareDocumentPosition(geography) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(geography.compareDocumentPosition(pediatric) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pediatric.compareDocumentPosition(methodology) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(methodology.compareDocumentPosition(participants) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.getByText("Top Countries")).toBeInTheDocument();
    expect(screen.getByText("Pediatric Participation")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Jump to Studies" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cross-Analysis" })).toHaveAttribute("aria-expanded", "true");
      expect(document.getElementById("analytics-target-cross")).toHaveAttribute("data-highlighted", "true");
    });

    fireEvent.click(screen.getByRole("button", { name: "Jump to Countries" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Geography" })).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("All Countries")).toBeInTheDocument();
      expect(document.getElementById("analytics-target-geography")).toHaveAttribute("data-highlighted", "true");
      expect(screen.getByTestId("world-map")).toHaveTextContent("map-points:3");
      expect(screen.getByText(/Not mapped on map \(1 countries\)/i)).toBeInTheDocument();
      expect(screen.getByText("Malaysia")).toBeInTheDocument();
      expect(screen.getByText("Saudi Arabia")).toBeInTheDocument();
      expect(screen.getByText("Atlantis")).toBeInTheDocument();
    });

    expect(screen.queryByText("Geography Deep Dive")).not.toBeInTheDocument();
    expect(screen.getByText("Country Distribution")).toBeInTheDocument();
    expect(screen.queryByText("Studies by Country (World Map)")).not.toBeInTheDocument();

    expect(screen.getByTestId("world-map").parentElement).toHaveClass("min-h-[420px]");

    fireEvent.click(screen.getByRole("button", { name: "Jump to Pediatric Studies" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pediatric" })).toHaveAttribute("aria-expanded", "true");
      expect(document.getElementById("analytics-target-pediatric")).toHaveAttribute("data-highlighted", "true");
      expect(screen.getByText(/Includes distribution and top primary questions among pediatric studies/i)).toBeInTheDocument();
    });
  });
});
