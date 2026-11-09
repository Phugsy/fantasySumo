import { expect, it } from "vitest";
import { compareScoringMode } from "./scoring-view";
import type { LeaderboardEntry } from "./types";

it("reweights official v2 totals, categories and history without changing the server entries", () => {
  const breakdown = {
    wins: 8,
    kinboshi: 3,
    kachiKoshi: 1,
    outstandingPerformance: 0,
    fightingSpirit: 3,
    technique: 0,
    joker: 1,
    jokerKinboshi: 3,
  };
  const entries: LeaderboardEntry[] = [
    {
      rank: 1,
      teamId: "t",
      displayName: "T",
      score: 19,
      latestDayScore: { day: 15, score: 19 },
      breakdown,
      rikishiScores: [{ rikishiId: "m", wins: 8, score: 19, breakdown }],
      scoreHistory: [
        {
          day: 15,
          dailyScore: 19,
          cumulativeScore: 19,
          rikishiScores: [
            { rikishiId: "m", outcome: "win", score: 19, breakdown },
          ],
        },
      ],
    },
  ];
  const original = structuredClone(entries);
  const legacy = compareScoringMode(
    entries,
    "achievements-v1",
    "achievements-v2",
  );
  expect(legacy[0]).toMatchObject({
    score: 17,
    breakdown: {
      kinboshi: 2,
      kachiKoshi: 3,
      fightingSpirit: 1,
      jokerKinboshi: 2,
    },
    scoreHistory: [{ dailyScore: 17, cumulativeScore: 17 }],
  });
  const wins = compareScoringMode(entries, "wins-v0", "achievements-v2");
  expect(wins[0]).toMatchObject({
    score: 9,
    scoreHistory: [{ dailyScore: 9, cumulativeScore: 9 }],
  });
  expect(
    compareScoringMode(legacy, "achievements-v2", "achievements-v1"),
  ).toEqual(entries);
  expect(entries).toEqual(original);
});
