import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import CrossAnalysis from "@/components/CrossAnalysis";

describe("CrossAnalysis component", () => {
  it("defaults to Author grouping and uses concise header copy", () => {
    const articles = [
      {
        id: "article-1",
        title: "Study One",
        author: "Alice; Bob",
        first_author: "Alice",
        last_author: "Zed",
        country: "Brazil",
        study_design: "RCT",
      },
    ];

    render(
      <MemoryRouter>
        <CrossAnalysis articles={articles as any} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Group and compare articles by key dimensions.")).toBeInTheDocument();
    expect(screen.queryByText("Cross-Analysis")).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: /^Author$/i })).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Zed")).not.toBeInTheDocument();
  });
});
