import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";

const fixture = [
  {
    id: "a-1",
    title: "Paper 1",
    author: "Alice",
    year: 2024,
    country: "Brazil",
    verify_peer1: false,
    verify_peer2: true,
    verify_qa3: false,
    verify_qa4: true,
    qa_score: 8.5,
  },
  {
    id: "a-2",
    title: "Paper 2",
    author: "Bob",
    year: 2023,
    country: "USA",
    verify_peer1: false,
    verify_peer2: true,
    verify_qa3: false,
    verify_qa4: false,
    qa_score: 7,
  },
];

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: fixture }),
}));

import Verifications from "@/pages/Verifications";

const SearchAndStateProbe = () => {
  const location = useLocation();
  return (
    <>
      <div data-testid="search">{location.search}</div>
      <div data-testid="state">{JSON.stringify(location.state)}</div>
    </>
  );
};

describe("Verifications", () => {
  it("loads filter selection from URL and keeps list filtered", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/verifications",
          element: (
            <>
              <Verifications />
              <SearchAndStateProbe />
            </>
          ),
        },
      ],
      { initialEntries: ["/verifications?filters=verify_peer2,verify_qa4"] },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByRole("checkbox", { name: /Peer 2/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /QA P2/i })).toBeChecked();
    expect(screen.getByText("1 article(s) found")).toBeInTheDocument();
  });

  it("updates URL when toggling filters and passes return state on article click", async () => {
    Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 420 });

    const router = createMemoryRouter(
      [
        {
          path: "/verifications",
          element: (
            <>
              <Verifications />
              <SearchAndStateProbe />
            </>
          ),
        },
        {
          path: "/articles/:id",
          element: <SearchAndStateProbe />,
        },
      ],
      { initialEntries: ["/verifications?filters=verify_peer2,verify_qa4"] },
    );

    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /QA P2/i }));

    await waitFor(() => {
      expect(screen.getByTestId("search")).toHaveTextContent("?filters=verify_peer2");
    });
    expect(screen.getByText("2 article(s) found")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Paper 1/i }));

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent("\"from\":\"/verifications?filters=verify_peer2\"");
      expect(screen.getByTestId("state")).toHaveTextContent("\"scrollY\":420");
    });
  });
});
