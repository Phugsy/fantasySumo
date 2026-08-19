import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("shows contextual team-building copy", () => {
    render(<PageHeader activeView="team" />);

    expect(
      screen.getByRole("heading", { name: "Build your basho team" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Current basho")).toBeInTheDocument();
    expect(screen.getByText(/Choose your rikishi/)).toBeInTheDocument();
  });

  it("shows contextual public-home copy", () => {
    render(<PageHeader activeView="home" />);

    expect(
      screen.getByRole("heading", { name: "Follow the leaderboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Current basho")).toBeInTheDocument();
  });
});
