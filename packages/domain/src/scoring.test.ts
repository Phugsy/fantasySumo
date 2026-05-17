import { describe, expect, it } from "vitest";
import {
  calculateRikishiScore,
  calculateTeamScore,
  countPickedRikishiWins,
} from "./scoring.js";
import type { BoutResult, FantasyPick, FantasyTeam } from "./types.js";

const team: FantasyTeam = {
  id: "team-a",
  bashoId: "2026-05",
  displayName: "Team A",
};

const results: BoutResult[] = [
  {
    id: "bout-1",
    bashoId: "2026-05",
    day: 1,
    winnerRikishiId: "kotozakura",
    loserRikishiId: "hoshoryu",
  },
  {
    id: "bout-2",
    bashoId: "2026-05",
    day: 2,
    winnerRikishiId: "hoshoryu",
    loserRikishiId: "kotozakura",
  },
  {
    id: "bout-3",
    bashoId: "2026-05",
    day: 3,
    winnerRikishiId: "onosato",
    loserRikishiId: "kotozakura",
  },
];

describe("countPickedRikishiWins", () => {
  it("scores one point for a single rikishi win", () => {
    expect(countPickedRikishiWins("onosato", results)).toBe(1);
  });

  it("scores zero for losses", () => {
    expect(countPickedRikishiWins("kirishima", results)).toBe(0);
  });

  it("does not score an absent winner as a win", () => {
    expect(
      countPickedRikishiWins("onosato", [
        {
          id: "bout-absent",
          bashoId: "2026-05",
          day: 4,
          winnerRikishiId: "onosato",
          loserRikishiId: "kotozakura",
          winnerAbsent: true,
        },
      ]),
    ).toBe(0);
  });
});

describe("calculateRikishiScore", () => {
  it("returns wins and score for a picked rikishi", () => {
    expect(calculateRikishiScore("kotozakura", results)).toEqual({
      rikishiId: "kotozakura",
      wins: 1,
      score: 1,
    });
  });

  it("can score a rikishi through a specific basho day", () => {
    expect(
      calculateRikishiScore("onosato", results, {
        throughDay: 2,
      }),
    ).toEqual({
      rikishiId: "onosato",
      wins: 0,
      score: 0,
    });
  });
});

describe("calculateTeamScore", () => {
  it("scores a team as the sum of picked rikishi wins", () => {
    const picks: FantasyPick[] = [
      {
        teamId: team.id,
        rikishiId: "kotozakura",
      },
      {
        teamId: team.id,
        rikishiId: "onosato",
      },
    ];

    expect(calculateTeamScore(team, picks, results)).toMatchObject({
      teamId: team.id,
      displayName: team.displayName,
      score: 2,
      rikishiScores: [
        {
          rikishiId: "kotozakura",
          wins: 1,
          score: 1,
        },
        {
          rikishiId: "onosato",
          wins: 1,
          score: 1,
        },
      ],
    });
  });

  it("ignores picks belonging to other teams", () => {
    const picks: FantasyPick[] = [
      {
        teamId: team.id,
        rikishiId: "kotozakura",
      },
      {
        teamId: "team-b",
        rikishiId: "onosato",
      },
    ];

    expect(calculateTeamScore(team, picks, results).score).toBe(1);
  });

  it("can score a team through a specific basho day", () => {
    const picks: FantasyPick[] = [
      {
        teamId: team.id,
        rikishiId: "kotozakura",
      },
      {
        teamId: team.id,
        rikishiId: "onosato",
      },
    ];

    expect(
      calculateTeamScore(team, picks, results, {
        throughDay: 2,
      }).score,
    ).toBe(1);
  });
});
