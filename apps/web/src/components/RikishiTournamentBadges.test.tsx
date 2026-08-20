import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RikishiTournamentBadges } from "./RikishiTournamentBadges";

describe("RikishiTournamentBadges", () => {
  it("shows readable status, achievement, date, and provenance labels", () => {
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
    expect(screen.getByText("Day 9 · source report")).toBeInTheDocument();
    expect(screen.getByText("Gold star")).toBeInTheDocument();
    expect(screen.getByText("Day 3 · derived")).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Ura is withdrawn from day 9; reported by the published tournament data.",
      ),
    ).toBeInTheDocument();
  });

  it("renders no badge when no facts are available", () => {
    const { container } = render(<RikishiTournamentBadges shikona="Ura" />);

    expect(container).toBeEmptyDOMElement();
  });
});
