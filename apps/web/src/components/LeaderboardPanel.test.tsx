import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeaderboardPanel } from "./LeaderboardPanel";
import type { LeaderboardEntry, RankedRikishi } from "../types";

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
        createdTeam={null}
        errorMessage={null}
        expandedTeamId="team-east"
        leaderboard={leaderboard}
        loadState="ready"
        onToggleTeam={vi.fn()}
        rikishi={rikishi}
      />,
    );

    expect(screen.getByText("East Side")).toBeInTheDocument();
    expect(screen.getByText("Onosato")).toBeInTheDocument();
    expect(screen.getByText("Kirishima")).toBeInTheDocument();
    expect(screen.getAllByText("1 win")).toHaveLength(2);
  });

  it("requests expansion changes when a team row is clicked", () => {
    const onToggleTeam = vi.fn();

    render(
      <LeaderboardPanel
        createdTeam={null}
        errorMessage={null}
        expandedTeamId={null}
        leaderboard={leaderboard}
        loadState="ready"
        onToggleTeam={onToggleTeam}
        rikishi={rikishi}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /East Side/ }));

    expect(onToggleTeam).toHaveBeenCalledWith("team-east");
  });

  it("shows a loading state before leaderboard data settles", () => {
    render(
      <LeaderboardPanel
        createdTeam={null}
        errorMessage={null}
        expandedTeamId={null}
        leaderboard={[]}
        loadState="loading"
        onToggleTeam={vi.fn()}
        rikishi={rikishi}
      />,
    );

    expect(screen.getByText("Loading leaderboard...")).toBeInTheDocument();
    expect(
      screen.queryByText("No teams have joined this basho yet."),
    ).not.toBeInTheDocument();
  });
});
