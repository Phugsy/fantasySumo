import { describe, expect, it } from "vitest";
import {
  calculateRikishiScore,
  calculateTeamScore,
  calculateTeamScoreHistory,
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

describe("calculateTeamScoreHistory", () => {
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

  it("groups daily contributions and cumulative scores by basho day", () => {
    expect(calculateTeamScoreHistory(team, picks, results)).toEqual([
      {
        day: 1,
        dailyScore: 1,
        cumulativeScore: 1,
        rikishiScores: [
          { rikishiId: "kotozakura", outcome: "win", score: 1 },
          { rikishiId: "onosato", outcome: "no-result", score: 0 },
        ],
      },
      {
        day: 2,
        dailyScore: 0,
        cumulativeScore: 1,
        rikishiScores: [
          { rikishiId: "kotozakura", outcome: "loss", score: 0 },
          { rikishiId: "onosato", outcome: "no-result", score: 0 },
        ],
      },
      {
        day: 3,
        dailyScore: 1,
        cumulativeScore: 2,
        rikishiScores: [
          { rikishiId: "kotozakura", outcome: "loss", score: 0 },
          { rikishiId: "onosato", outcome: "win", score: 1 },
        ],
      },
    ]);
  });

  it("returns only scored days through the requested boundary", () => {
    expect(
      calculateTeamScoreHistory(team, picks, results, { throughDay: 2 }),
    ).toHaveLength(2);
    expect(
      calculateTeamScoreHistory(team, picks, [], { throughDay: 2 }),
    ).toEqual([]);
  });

  it("does not invent history entries for days with no stored results", () => {
    expect(calculateTeamScoreHistory(team, picks, [results[2]!])).toEqual([
      {
        day: 3,
        dailyScore: 1,
        cumulativeScore: 1,
        rikishiScores: [
          { rikishiId: "kotozakura", outcome: "loss", score: 0 },
          { rikishiId: "onosato", outcome: "win", score: 1 },
        ],
      },
    ]);
  });

  it("does not award points for an absence", () => {
    expect(
      calculateTeamScoreHistory(team, picks, [
        {
          id: "bout-absent",
          bashoId: team.bashoId,
          day: 1,
          winnerRikishiId: "onosato",
          loserRikishiId: "kotozakura",
          winnerAbsent: true,
        },
      ]),
    ).toEqual([
      {
        day: 1,
        dailyScore: 0,
        cumulativeScore: 0,
        rikishiScores: [
          { rikishiId: "kotozakura", outcome: "loss", score: 0 },
          { rikishiId: "onosato", outcome: "absent", score: 0 },
        ],
      },
    ]);
  });

  it("keeps daily history aligned when a rikishi has multiple stored wins", () => {
    const duplicateDayResults: BoutResult[] = [
      results[0]!,
      {
        id: "bout-1-rematch",
        bashoId: team.bashoId,
        day: 1,
        winnerRikishiId: "kotozakura",
        loserRikishiId: "onosato",
      },
    ];
    const history = calculateTeamScoreHistory(team, picks, duplicateDayResults);

    expect(history[0]).toMatchObject({
      dailyScore: 2,
      cumulativeScore: 2,
      rikishiScores: [
        { rikishiId: "kotozakura", outcome: "win", score: 2 },
        { rikishiId: "onosato", outcome: "loss", score: 0 },
      ],
    });
    expect(history.at(-1)?.cumulativeScore).toBe(
      calculateTeamScore(team, picks, duplicateDayResults).score,
    );
  });
});
