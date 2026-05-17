import { describe, expect, it } from "vitest";
import { calculateLeaderboard } from "./leaderboard.js";
import type { BoutResult, FantasyPick, FantasyTeam } from "./types.js";

const teams: FantasyTeam[] = [
  {
    id: "team-b",
    bashoId: "2026-05",
    displayName: "Beta",
  },
  {
    id: "team-a",
    bashoId: "2026-05",
    displayName: "Alpha",
  },
  {
    id: "team-c",
    bashoId: "2026-05",
    displayName: "Gamma",
  },
];

const picks: FantasyPick[] = [
  {
    teamId: "team-a",
    rikishiId: "onosato",
  },
  {
    teamId: "team-b",
    rikishiId: "kotozakura",
  },
  {
    teamId: "team-c",
    rikishiId: "hoshoryu",
  },
];

const results: BoutResult[] = [
  {
    id: "bout-1",
    bashoId: "2026-05",
    day: 1,
    winnerRikishiId: "onosato",
    loserRikishiId: "kotozakura",
  },
  {
    id: "bout-2",
    bashoId: "2026-05",
    day: 2,
    winnerRikishiId: "onosato",
    loserRikishiId: "hoshoryu",
  },
  {
    id: "bout-3",
    bashoId: "2026-05",
    day: 3,
    winnerRikishiId: "kotozakura",
    loserRikishiId: "hoshoryu",
  },
];

describe("calculateLeaderboard", () => {
  it("orders multiple teams by score descending", () => {
    expect(
      calculateLeaderboard(teams, picks, results).map((entry) => ({
        teamId: entry.teamId,
        score: entry.score,
        rank: entry.rank,
      })),
    ).toEqual([
      {
        teamId: "team-a",
        score: 2,
        rank: 1,
      },
      {
        teamId: "team-b",
        score: 1,
        rank: 2,
      },
      {
        teamId: "team-c",
        score: 0,
        rank: 3,
      },
    ]);
  });

  it("orders tied teams deterministically by display name, then team id", () => {
    const tiedTeams: FantasyTeam[] = [
      {
        id: "team-c",
        bashoId: "2026-05",
        displayName: "Same",
      },
      {
        id: "team-a",
        bashoId: "2026-05",
        displayName: "Same",
      },
      {
        id: "team-b",
        bashoId: "2026-05",
        displayName: "Another",
      },
    ];

    expect(
      calculateLeaderboard(tiedTeams, [], []).map((entry) => ({
        teamId: entry.teamId,
        displayName: entry.displayName,
        score: entry.score,
      })),
    ).toEqual([
      {
        teamId: "team-b",
        displayName: "Another",
        score: 0,
      },
      {
        teamId: "team-a",
        displayName: "Same",
        score: 0,
      },
      {
        teamId: "team-c",
        displayName: "Same",
        score: 0,
      },
    ]);
  });
});
