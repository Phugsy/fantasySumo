import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RikishiTournamentBadges } from "./RikishiTournamentBadges";

describe("RikishiTournamentBadges", () => {
  it("shows concise status and achievement badges without metadata", () => {
    render(
      <RikishiTournamentBadges
        shikona="Ura"
        notes={{
          statuses: [
            { type: "withdrawn", effectiveDay: 9, provenance: "source" },
          ],
          achievements: [{ type: "gold-star", day: 3, provenance: "derived" }],
        }}
      />,
    );

    expect(
      screen.getByLabelText("Ura tournament status and achievements"),
    ).toBeInTheDocument();
    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
    expect(screen.getByText("Gold star")).toBeInTheDocument();
    expect(screen.queryByText(/derived/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/source report/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/day 3/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Ura/)).not.toBeInTheDocument();
  });

  it("renders no badge when no facts are available", () => {
    const { container } = render(<RikishiTournamentBadges shikona="Ura" />);

    expect(container).toBeEmptyDOMElement();
  });
});
