import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("shows the wordmark and primary navigation", () => {
    const onChange = vi.fn();

    render(<AppHeader activeView="selection" onChange={onChange} />);

    expect(screen.getByLabelText("Fantasy Sumo")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My stable" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.click(screen.getByRole("button", { name: "Leaderboard" }));

    expect(onChange).toHaveBeenCalledWith("leaderboard");
  });
});
