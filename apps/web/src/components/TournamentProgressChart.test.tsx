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
      screen.getByRole("button", { name: "West Side, your team" }),
    ).toHaveAttribute("aria-pressed", "true");

    const westDayOne = screen.getByRole("button", {
      name: "West Side, day 1: +1 that day, 1 cumulative points",
    });
    fireEvent.focus(westDayOne);

    const detail = screen.getByText("West Side", {
      selector: ".progress-chart-detail strong",
    }).parentElement;
    expect(detail).not.toBeNull();
    expect(within(detail!).getByText("Your team")).toBeInTheDocument();
    expect(within(detail!).getByText("Day 1")).toBeInTheDocument();
    expect(within(detail!).getByText("+1 that day")).toBeInTheDocument();
    expect(within(detail!).getByText("1 cumulative pts")).toBeInTheDocument();
  });

  it("filters overlapping teams and restores every series", () => {
    render(<TournamentProgressChart leaderboard={leaderboard} />);

    const eastFilter = screen.getByRole("button", { name: "East Side" });
    const westFilter = screen.getByRole("button", { name: "West Side" });
    fireEvent.click(eastFilter);

    expect(eastFilter).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("button", {
        name: "East Side, day 1: +1 that day, 1 cumulative points",
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
      within(table).getByRole("rowheader", { name: "East Side" }),
    ).toBeInTheDocument();
    expect(within(table).getByText("+1 / 2")).toBeInTheDocument();
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
  teamId,
}: {
  dailyScores: number[];
  displayName: string;
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
    rank: 1,
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
