import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("shows signed-in navigation and session actions", () => {
    render(
      <MemoryRouter initialEntries={["/stable"]}>
        <AppHeader
          onSignOut={vi.fn()}
          sessionState="ready"
          showTeam
          user={{ id: "player", displayName: "East Stand" }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Fantasy Sumo")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My stable" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Team picks" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });
});
