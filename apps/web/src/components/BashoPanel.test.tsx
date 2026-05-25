import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BashoPanel } from "./BashoPanel";
import type { Basho } from "../types";

const basho: Basho = {
  id: "2026-05",
  name: "May 2026 Sample Basho",
  startDate: "2026-05-10",
  endDate: "2026-05-24",
  status: "active",
  teamSize: 2,
};

describe("BashoPanel", () => {
  it("shows basho dates and pick progress", () => {
    render(<BashoPanel basho={basho} selectedCount={1} />);

    expect(
      screen.getByRole("heading", { name: "May 2026 Sample Basho" }),
    ).toBeInTheDocument();
    expect(screen.getByText("10 May to 24 May")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 selected")).toBeInTheDocument();
    expect(screen.getByText("1 pick left")).toBeInTheDocument();
  });

  it("shows when the team is full", () => {
    render(<BashoPanel basho={basho} selectedCount={2} />);

    expect(screen.getByText("Team full")).toBeInTheDocument();
  });
});
