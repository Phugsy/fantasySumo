import { describe, expect, it } from "vitest";
import {
  calculateRikishiScore,
  calculateTeamScoreHistory,
  calculateTeamScore,
} from "./scoring.js";
import type { BanzukeEntry, BoutResult, ScoringOptions } from "./types.js";

const results: BoutResult[] = Array.from({ length: 9 }, (_, index) => ({
  id: `bout-${index}`,
  bashoId: "test",
  day: index + 1,
  winnerRikishiId: "m",
  loserRikishiId: index === 0 ? "y" : "o",
}));
const banzukeEntries: BanzukeEntry[] = [
  {
    id: "rank-m",
    bashoId: "test",
    rikishiId: "m",
    rank: "Maegashira 1 East",
    rankOrder: 3,
  },
  {
    id: "rank-y",
    bashoId: "test",
    rikishiId: "y",
    rank: "Yokozuna",
    rankOrder: 1,
  },
];
const options: ScoringOptions = {
  scoringMode: "achievements-v1",
  banzukeEntries,
  specialPrizes: [
    { rikishiId: "m", type: "technique" },
    { rikishiId: "m", type: "fighting-spirit" },
  ],
};

describe("versioned scoring modes", () => {
  it("includes final prize scoring in history even without a final-day bout", () => {
    const team = { id: "team", bashoId: "test", displayName: "Test" };
    const picks = [{ teamId: "team", rikishiId: "m" }];
    const history = calculateTeamScoreHistory(team, picks, results, options);
    expect(history.at(-1)).toMatchObject({
      day: 15,
      dailyScore: 2,
      cumulativeScore: 16,
    });
    expect(history.at(-1)?.cumulativeScore).toBe(
      calculateTeamScore(team, picks, results, options).score,
    );
  });

  it("separates wins and every bonus and stacks one point per distinct prize", () => {
    expect(calculateRikishiScore("m", results, options)).toEqual({
      rikishiId: "m",
      wins: 9,
      score: 16,
      breakdown: {
        wins: 9,
        kinboshi: 2,
        kachiKoshi: 3,
        outstandingPerformance: 0,
        fightingSpirit: 1,
        technique: 1,
      },
    });
    expect(
      calculateRikishiScore("m", results, {
        ...options,
        scoringMode: "wins-v0",
      }),
    ).toMatchObject({ score: 9, breakdown: { kinboshi: 2, technique: 1 } });
    expect(calculateRikishiScore("m", results)).toEqual({
      rikishiId: "m",
      wins: 9,
      score: 9,
    });
  });
  it("applies the milestone on the eighth win and awards only on day 15", () => {
    expect(
      calculateRikishiScore("m", results, { ...options, throughDay: 7 }).score,
    ).toBe(9);
    expect(
      calculateRikishiScore("m", results, { ...options, throughDay: 8 }).score,
    ).toBe(13);
    const withFinalDay = [
      ...results,
      {
        id: "loss",
        bashoId: "test",
        day: 15,
        winnerRikishiId: "o",
        loserRikishiId: "m",
      },
    ];
    const team = { id: "team", bashoId: "test", displayName: "Test" };
    const picks = [{ teamId: "team", rikishiId: "m" }];
    const history = calculateTeamScoreHistory(
      team,
      picks,
      withFinalDay,
      options,
    );
    expect(history.find((entry) => entry.day === 8)?.dailyScore).toBe(4);
    expect(history.at(-1)).toMatchObject({
      day: 15,
      dailyScore: 2,
      cumulativeScore: 16,
      rikishiScores: [{ outcome: "loss", score: 2 }],
    });
    expect(history.at(-1)?.cumulativeScore).toBe(
      calculateTeamScore(team, picks, withFinalDay, options).score,
    );
  });
  it("counts default wins towards eight wins but never as a kinboshi", () => {
    for (const change of [{ loserAbsent: true }, { kimarite: " FUSEN " }]) {
      expect(
        calculateRikishiScore(
          "m",
          [{ ...results[0]!, ...change }, ...results.slice(1)],
          options,
        ),
      ).toMatchObject({ wins: 9, breakdown: { kinboshi: 0, kachiKoshi: 3 } });
    }
    expect(
      calculateRikishiScore(
        "m",
        [{ ...results[0]!, winnerAbsent: true }],
        options,
      ),
    ).toMatchObject({ wins: 0, breakdown: { kinboshi: 0 } });
  });
  it("does not invent missing ranks or prizes and reverses corrected achievements", () => {
    expect(
      calculateRikishiScore("m", results, { scoringMode: "achievements-v1" }),
    ).toMatchObject({ score: 12, breakdown: { kinboshi: 0, technique: 0 } });
    const corrected = results.slice(2);
    expect(
      calculateRikishiScore("m", corrected, { ...options, specialPrizes: [] }),
    ).toMatchObject({
      wins: 7,
      score: 7,
      breakdown: { kinboshi: 0, kachiKoshi: 0 },
    });
    expect(
      calculateRikishiScore("m", results, {
        ...options,
        specialPrizes: [...options.specialPrizes!, ...options.specialPrizes!],
      }).score,
    ).toBe(16);
  });
});
