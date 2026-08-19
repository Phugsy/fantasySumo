import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ViewSwitch } from "./ViewSwitch";

describe("ViewSwitch", () => {
  it("shows signed-out public navigation", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ViewSwitch sessionState="ready" user={null} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Log in / Join" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My stable" })).toBeNull();
  });

  it("does not expose private navigation before session resolution", () => {
    render(
      <MemoryRouter>
        <ViewSwitch sessionState="loading" user={null} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Checking session...")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log in / Join" })).toBeNull();
    expect(screen.queryByRole("link", { name: "My stable" })).toBeNull();
  });

  it("shows admin navigation only when the server-authorized session allows it", () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/admin"]}>
        <ViewSwitch
          sessionState="ready"
          user={{ id: "player", displayName: "Player" }}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();

    rerender(
      <MemoryRouter initialEntries={["/admin"]}>
        <ViewSwitch
          sessionState="ready"
          showAdmin
          user={{ id: "admin", displayName: "Admin" }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
