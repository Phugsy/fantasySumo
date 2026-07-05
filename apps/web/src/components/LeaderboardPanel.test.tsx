import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeaderboardPanel } from "./LeaderboardPanel";
import type { Basho, LeaderboardEntry, RankedRikishi } from "../types";

const basho: Basho = {
  id: "2026-05",
  name: "Demo May Basho",
  startDate: "2026-05-10",
  endDate: "2026-05-24",
  status: "active",
  currentDay: 4,
  teamSize: 2,
};

const rikishi: RankedRikishi[] = [
  {
    id: "onosato",
    shikona: "Onosato",
    heya: "Nishonoseki",
    rank: "Ozeki",
    rankOrder: 1,
  },
  {
    id: "kirishima",
    shikona: "Kirishima",
    heya: "Oitekaze",
    rank: "Komusubi",
    rankOrder: 4,
  },
];

const leaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    teamId: "team-east",
    displayName: "East Side",
    score: 2,
    rikishiScores: [
      {
        rikishiId: "onosato",
        wins: 1,
        score: 1,
      },
      {
        rikishiId: "kirishima",
        wins: 1,
        score: 1,
      },
    ],
  },
];

describe("LeaderboardPanel", () => {
  it("shows expanded rikishi score details for the selected team", () => {
    render(
      <LeaderboardPanel
        basho={basho}
        createdTeam={null}
        errorMessage={null}
        expandedTeamId="team-east"
        leaderboard={leaderboard}
        loadState="ready"
        onToggleTeam={vi.fn()}
        rikishi={rikishi}
        totalDays={15}
      />,
    );

    expect(
      screen.getByText("Demo May Basho - Day 4 of 15"),
    ).toBeInTheDocument();
    expect(screen.getByText("Status: Scoring in progress")).toBeInTheDocument();
    expect(screen.getByText("East Side")).toBeInTheDocument();
    expect(screen.getByText("Onosato")).toBeInTheDocument();
    expect(screen.getByText("Kirishima")).toBeInTheDocument();
    expect(screen.getAllByText("1 win")).toHaveLength(2);
  });

  it("requests expansion changes when a team row is clicked", () => {
    const onToggleTeam = vi.fn();

    render(
      <LeaderboardPanel
        basho={basho}
        createdTeam={null}
        errorMessage={null}
        expandedTeamId={null}
        leaderboard={leaderboard}
        loadState="ready"
        onToggleTeam={onToggleTeam}
        rikishi={rikishi}
        totalDays={15}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /East Side/ }));

    expect(onToggleTeam).toHaveBeenCalledWith("team-east");
  });

  it("shows a loading state before leaderboard data settles", () => {
    render(
      <LeaderboardPanel
        basho={basho}
        createdTeam={null}
        errorMessage={null}
        expandedTeamId={null}
        leaderboard={[]}
        loadState="loading"
        onToggleTeam={vi.fn()}
        rikishi={rikishi}
        totalDays={15}
      />,
    );

    expect(screen.getByText("Loading leaderboard...")).toBeInTheDocument();
    expect(
      screen.queryByText("No teams have joined this basho yet."),
    ).not.toBeInTheDocument();
  });

  it("shows locked pre-scoring context when teams exist but day one is unscored", () => {
    render(
      <LeaderboardPanel
        basho={{ ...basho, status: "locked", currentDay: 0 }}
        createdTeam={null}
        errorMessage={null}
        expandedTeamId={null}
        leaderboard={[{ ...leaderboard[0]!, score: 0 }]}
        loadState="ready"
        onToggleTeam={vi.fn()}
        rikishi={rikishi}
        totalDays={15}
      />,
    );

    expect(
      screen.getByText("Demo May Basho - Picks locked, starts soon"),
    ).toBeInTheDocument();
    expect(screen.getByText("Status: Picks locked")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Picks are locked. Day 1 results have not been scored yet.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("East Side")).toBeInTheDocument();
  });

  it("shows final leaderboard wording for a complete basho", () => {
    render(
      <LeaderboardPanel
        basho={{ ...basho, status: "complete", currentDay: 15 }}
        createdTeam={null}
        errorMessage={null}
        expandedTeamId={null}
        leaderboard={leaderboard}
        loadState="ready"
        onToggleTeam={vi.fn()}
        rikishi={rikishi}
        totalDays={15}
      />,
    );

    expect(
      screen.getByText("Demo May Basho - Complete, final leaderboard"),
    ).toBeInTheDocument();
    expect(screen.getByText("Status: Final scores")).toBeInTheDocument();
  });
});
