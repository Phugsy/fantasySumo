import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LeaderboardEntry } from "../types";
import { TournamentProgressChart } from "./TournamentProgressChart";

const leaderboard: LeaderboardEntry[] = [
  createEntry({
    teamId: "team-east",
    displayName: "East Side",
    dailyScores: [1, 1],
  }),
  createEntry({
    teamId: "team-west",
    displayName: "West Side",
    dailyScores: [1, 0],
    rank: 2,
  }),
];

describe("TournamentProgressChart", () => {
  it("shows cumulative progress, the latest day, and inspectable points", () => {
    render(
      <TournamentProgressChart
        currentTeamId="team-west"
        leaderboard={leaderboard}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Score progress" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Latest: Day 2")).toBeInTheDocument();
    expect(
      screen.getByRole("group", {
        name: /^Cumulative fantasy score progress/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "#2 West Side, your team" }),
    ).toHaveAttribute("aria-pressed", "true");

    const westDayOne = screen.getByRole("button", {
      name: "#2 West Side, day 1: +1 that day, 1 cumulative points",
    });
    fireEvent.focus(westDayOne);
    expect(
      westDayOne.querySelector(".chart-point-focus-ring"),
    ).toBeInTheDocument();

    const detail = screen.getByText("#2 West Side", {
      selector: ".progress-chart-detail strong",
    }).parentElement;
    expect(detail).not.toBeNull();
    expect(within(detail!).getByText("Your team")).toBeInTheDocument();
    expect(within(detail!).getByText("Day 1")).toBeInTheDocument();
    expect(detail).toHaveTextContent("+1 that day");
    expect(
      within(detail!).getByText("+1", {
        selector: ".daily-score-badge",
      }),
    ).toBeInTheDocument();
    expect(within(detail!).getByText("1 cumulative pts")).toBeInTheDocument();
  });

  it("filters overlapping teams and restores every series", () => {
    render(<TournamentProgressChart leaderboard={leaderboard} />);

    const eastFilter = screen.getByRole("button", { name: "#1 East Side" });
    const westFilter = screen.getByRole("button", { name: "#2 West Side" });
    expect(westFilter.querySelector(".series-swatch line")).toHaveAttribute(
      "stroke-dasharray",
      "3 4",
    );
    fireEvent.click(eastFilter);

    expect(eastFilter).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("button", {
        name: "#1 East Side, day 1: +1 that day, 1 cumulative points",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(westFilter);
    expect(
      screen.getByText("Choose at least one team above to show its progress."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(eastFilter).toHaveAttribute("aria-pressed", "true");
    expect(westFilter).toHaveAttribute("aria-pressed", "true");
  });

  it("provides a directly readable score-history table", () => {
    render(<TournamentProgressChart leaderboard={leaderboard} />);

    fireEvent.click(screen.getByText("View score history table"));

    const table = screen.getByRole("table", {
      name: "Daily and cumulative fantasy points",
    });
    expect(
      within(table).getByRole("columnheader", { name: "Day 1" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("rowheader", { name: "#1 East Side" }),
    ).toBeInTheDocument();
    expect(within(table).getByText("+1 / 2")).toBeInTheDocument();
  });

  it("uses ranks to disambiguate duplicate team names", () => {
    render(
      <TournamentProgressChart
        leaderboard={leaderboard.map((entry) => ({
          ...entry,
          displayName: "Shared Stable",
        }))}
      />,
    );

    expect(
      screen.getByRole("button", { name: "#1 Shared Stable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "#2 Shared Stable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "#2 Shared Stable, day 1: +1 that day, 1 cumulative points",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("View score history table"));
    expect(
      screen.getByRole("rowheader", { name: "#1 Shared Stable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: "#2 Shared Stable" }),
    ).toBeInTheDocument();
  });

  it("uses one tab stop and arrow keys to navigate chart points", () => {
    render(<TournamentProgressChart leaderboard={leaderboard} />);

    const eastDayTwo = screen.getByRole("button", {
      name: "#1 East Side, day 2: +1 that day, 2 cumulative points",
    });
    const westDayOne = screen.getByRole("button", {
      name: "#2 West Side, day 1: +1 that day, 1 cumulative points",
    });

    expect(eastDayTwo).toHaveAttribute("tabindex", "0");
    expect(westDayOne).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(eastDayTwo, { key: "ArrowRight" });

    expect(westDayOne).toHaveFocus();
    expect(eastDayTwo).toHaveAttribute("tabindex", "-1");
    expect(westDayOne).toHaveAttribute("tabindex", "0");
  });

  it("keeps series styles distinct after the color palette repeats", () => {
    const sevenTeams = Array.from({ length: 7 }, (_, index) =>
      createEntry({
        teamId: `team-${index + 1}`,
        displayName: `Stable ${index + 1}`,
        dailyScores: [1, 1],
        rank: index + 1,
      }),
    );
    const { container } = render(
      <TournamentProgressChart leaderboard={sevenTeams} />,
    );
    const swatches = Array.from(
      container.querySelectorAll<SVGLineElement>(".series-swatch line"),
    );
    const signatures = swatches.map(
      (swatch) =>
        `${swatch.getAttribute("stroke")}|${swatch.getAttribute("stroke-dasharray") ?? "solid"}`,
    );

    expect(swatches).toHaveLength(7);
    expect(new Set(signatures).size).toBe(7);
    expect(swatches[0]).toHaveAttribute(
      "stroke",
      swatches[6]?.getAttribute("stroke"),
    );
    expect(swatches[0]?.getAttribute("stroke-dasharray")).not.toBe(
      swatches[6]?.getAttribute("stroke-dasharray"),
    );
  });

  it("shows empty and single-day guidance", () => {
    const { rerender } = render(
      <TournamentProgressChart
        leaderboard={[{ ...leaderboard[0]!, scoreHistory: [] }]}
      />,
    );

    expect(
      screen.getByText(
        "No scored days yet. Progress will appear after the first results.",
      ),
    ).toBeInTheDocument();

    rerender(
      <TournamentProgressChart
        leaderboard={[
          createEntry({
            teamId: "team-east",
            displayName: "East Side",
            dailyScores: [1],
          }),
        ]}
      />,
    );

    expect(screen.getByText("Latest: Day 1")).toBeInTheDocument();
    expect(
      screen.getByText(
        "One day scored so far. Lines will form as more results arrive.",
      ),
    ).toBeInTheDocument();
  });
});

function createEntry({
  dailyScores,
  displayName,
  rank = 1,
  teamId,
}: {
  dailyScores: number[];
  displayName: string;
  rank?: number;
  teamId: string;
}): LeaderboardEntry {
  let cumulativeScore = 0;
  const scoreHistory = dailyScores.map((dailyScore, index) => {
    cumulativeScore += dailyScore;
    return {
      day: index + 1,
      dailyScore,
      cumulativeScore,
      rikishiScores: [],
    };
  });

  return {
    rank,
    teamId,
    displayName,
    score: cumulativeScore,
    latestDayScore: {
      day: dailyScores.length,
      score: dailyScores.at(-1) ?? 0,
    },
    scoreHistory,
    rikishiScores: [],
  };
}
