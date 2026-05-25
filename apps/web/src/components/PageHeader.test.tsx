import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("shows the app title and team-building prompt", () => {
    render(<PageHeader />);

    expect(
      screen.getByRole("heading", { name: "Build your basho team" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Fantasy Sumo")).toBeInTheDocument();
    expect(screen.getByText(/Pick rikishi/)).toBeInTheDocument();
  });
});
