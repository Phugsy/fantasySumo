import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeaderboardPanel } from "./LeaderboardPanel";
import type { Basho, LeaderboardEntry, RankedRikishi } from "../types";

const basho: Basho = {
  id: "2026-05",
  isDemo: false,
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
    latestDayScore: {
      day: 4,
      score: 1,
    },
    scoreHistory: [
      {
        day: 3,
        dailyScore: 1,
        cumulativeScore: 1,
        rikishiScores: [
          { rikishiId: "onosato", outcome: "win", score: 1 },
          { rikishiId: "kirishima", outcome: "loss", score: 0 },
        ],
      },
      {
        day: 4,
        dailyScore: 1,
        cumulativeScore: 2,
        rikishiScores: [
          { rikishiId: "onosato", outcome: "loss", score: 0 },
          { rikishiId: "kirishima", outcome: "win", score: 1 },
        ],
      },
    ],
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
    expect(screen.getAllByText("East Side").length).toBeGreaterThan(0);
    expect(screen.getByText("Onosato")).toBeInTheDocument();
    expect(screen.getByText("Kirishima")).toBeInTheDocument();
    expect(screen.getAllByText("1 win")).toHaveLength(2);
    const leaderboardList =
      document.querySelector<HTMLElement>(".leaderboard-list");
    expect(leaderboardList).not.toBeNull();
    const leaderboardSummary = within(leaderboardList!).getByRole("button", {
      name: /East Side/,
    });
    expect(within(leaderboardSummary).getByText("Day 4")).toBeInTheDocument();
    expect(
      within(leaderboardSummary).getByText("+1", {
        selector: ".daily-score-badge",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Recent form: day 3 \+1/)).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Recent results for Onosato: day 3 Win, day 4 Loss",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Day-by-day score history" }),
    ).not.toBeInTheDocument();
    const progressChart = screen.getByRole("region", {
      name: "Score progress",
    });

    expect(
      leaderboardList!.compareDocumentPosition(progressChart) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Onosato/ }));

    expect(
      screen.getByRole("region", { name: "Onosato result history" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Day 3: Win, +1 point")).toBeInTheDocument();
    expect(screen.getByLabelText("Day 4: Loss, 0 points")).toBeInTheDocument();
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

    fireEvent.click(
      within(screen.getByRole("list")).getByRole("button", {
        name: /East Side/,
      }),
    );

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
        leaderboard={[
          {
            ...leaderboard[0]!,
            score: 0,
            latestDayScore: undefined,
            scoreHistory: [],
          },
        ]}
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

  it("limits compact team and rikishi form to the five latest results", () => {
    const sixDays = Array.from({ length: 6 }, (_, index) => ({
      day: index + 1,
      dailyScore: 1,
      cumulativeScore: index + 1,
      rikishiScores: [
        { rikishiId: "onosato", outcome: "win" as const, score: 1 },
        { rikishiId: "kirishima", outcome: "loss" as const, score: 0 },
      ],
    }));

    render(
      <LeaderboardPanel
        basho={{ ...basho, currentDay: 6 }}
        createdTeam={null}
        errorMessage={null}
        expandedTeamId="team-east"
        leaderboard={[
          {
            ...leaderboard[0]!,
            latestDayScore: { day: 6, score: 1 },
            score: 6,
            scoreHistory: sixDays,
          },
        ]}
        loadState="ready"
        onToggleTeam={vi.fn()}
        rikishi={rikishi}
        totalDays={15}
      />,
    );

    expect(
      screen.getByLabelText(
        "Recent form: day 2 +1, day 3 +1, day 4 +1, day 5 +1, day 6 +1",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Recent results for Onosato: day 2 Win, day 3 Win, day 4 Win, day 5 Win, day 6 Win",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Onosato/ }));

    expect(screen.getByLabelText("Day 1: Win, +1 point")).toBeInTheDocument();
    expect(screen.getByLabelText("Day 6: Win, +1 point")).toBeInTheDocument();
  });
});
