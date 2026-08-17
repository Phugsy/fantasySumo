import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ViewSwitch } from "./ViewSwitch";

describe("ViewSwitch", () => {
  it("marks the active view and emits view changes", () => {
    const onChange = vi.fn();

    render(<ViewSwitch activeView="selection" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "My stable" })).toHaveClass(
      "active",
    );
    expect(screen.getByRole("button", { name: "Leaderboard" })).not.toHaveClass(
      "active",
    );

    fireEvent.click(screen.getByRole("button", { name: "Leaderboard" }));

    expect(onChange).toHaveBeenCalledWith("leaderboard");
  });

  it("disables view changes while requested", () => {
    const onChange = vi.fn();

    render(<ViewSwitch activeView="selection" disabled onChange={onChange} />);

    expect(screen.getByRole("button", { name: "My stable" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Leaderboard" })).toBeDisabled();
  });

  it("shows admin navigation only when the server-authorized session allows it", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ViewSwitch activeView="stable" onChange={onChange} />,
    );

    expect(screen.queryByRole("button", { name: "Admin" })).toBeNull();

    rerender(<ViewSwitch activeView="admin" onChange={onChange} showAdmin />);
    fireEvent.click(screen.getByRole("button", { name: "Admin" }));

    expect(onChange).toHaveBeenCalledWith("admin");
    expect(screen.getByRole("button", { name: "Admin" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
