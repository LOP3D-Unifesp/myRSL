import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VerificationToggles from "@/components/article/VerificationToggles";

const values = { verify_peer1: true, verify_peer2: true, verify_qa3: false, verify_qa4: true };

describe("VerificationToggles", () => {
  it("shows who verified each completed step and when", () => {
    render(
      <VerificationToggles
        values={values}
        onToggle={vi.fn()}
        names={new Map([["u1", "Gabi"]])}
        stamps={{
          verify_peer1: { by: "u1", at: "2026-04-10T12:00:00.000Z" },
          verify_peer2: { by: "gone", at: null },
          verify_qa4: { by: null, at: null },
        }}
      />,
    );

    expect(screen.getByTestId("stamp-verify_peer1")).toHaveTextContent("Gabi · Apr 10, 2026");
    expect(screen.getByTestId("stamp-verify_peer2")).toHaveTextContent("A former member");
    expect(screen.getByTestId("stamp-verify_qa4")).toHaveTextContent("Author not recorded");
    expect(screen.queryByTestId("stamp-verify_qa3")).not.toBeInTheDocument();
  });

  it("still toggles a step", () => {
    const onToggle = vi.fn();
    render(<VerificationToggles values={values} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: "QA P1" }));
    expect(onToggle).toHaveBeenCalledWith("verify_qa3");
  });
});
