import { describe, it, expect } from "vitest";
import {
  jokerDeadline,
  jokerWindow,
  resolveJoker,
  type JokerAllocation,
  type JokerFacts,
} from "./jokers.js";
import {
  calculateTeamScore,
  calculateTeamScoreHistory,
  calculateRikishiScore,
} from "./scoring.js";
import type { Basho, BoutResult, ScoringOptions } from "./types.js";
const basho: Basho = {
  id: "b",
  name: "B",
  isDemo: true,
  startDate: "2026-05-10",
  endDate: "2026-05-24",
  status: "active",
};
const selection: JokerAllocation = {
  teamId: "t",
  day: 1,
  rikishiId: "m",
  opponentId: "y",
  boutId: "bout",
  revision: 1,
  selectedAt: "2026-05-10T02:00:00.000Z",
  state: "reserved",
};
const facts: JokerFacts = {
  basho,
  bouts: [
    {
      id: "bout",
      bashoId: "b",
      day: 1,
      eastRikishiId: "m",
      westRikishiId: "y",
      status: "scheduled",
    },
  ],
  publications: [
    {
      id: "p",
      bashoId: "b",
      day: 1,
      publishedAt: "2026-05-09T08:00:00.000Z",
      source: "demo:complete",
    },
  ],
  results: [],
};
describe("joker window and resolution", () => {
  it("uses Japan calendar dates and a strict noon cutoff across month boundaries", () => {
    expect(jokerDeadline("2026-01-25", 15)).toBe("2026-02-08T03:00:00.000Z");
    expect(jokerWindow(facts, 1, "2026-05-10T02:59:59.999Z")).toBe("open");
    expect(jokerWindow(facts, 1, "2026-05-10T03:00:00.000Z")).toBe("closed");
    expect(
      jokerWindow(
        { ...facts, publications: [] },
        1,
        "2026-05-10T02:00:00.000Z",
      ),
    ).toBe("unavailable");
    expect(
      jokerWindow(
        { ...facts, publications: [] },
        1,
        "2026-05-10T04:00:00.000Z",
      ),
    ).toBe("closed");
  });
  it("keeps missing and changed matchups pending; refunds only attested exact cancellations or fusen", () => {
    const now = "2026-05-10T04:00:00.000Z";
    expect(resolveJoker(selection, facts, now)).toBe("locked");
    expect(
      resolveJoker(
        selection,
        {
          ...facts,
          bouts: [
            { ...facts.bouts[0]!, westRikishiId: "x", status: "cancelled" },
          ],
        },
        now,
      ),
    ).toBe("locked");
    expect(
      resolveJoker(
        selection,
        { ...facts, bouts: [{ ...facts.bouts[0]!, status: "cancelled" }] },
        now,
      ),
    ).toBe("refunded");
    const result: BoutResult = {
      id: "r",
      bashoId: "b",
      day: 1,
      winnerRikishiId: "y",
      loserRikishiId: "m",
    };
    expect(resolveJoker(selection, { ...facts, results: [result] }, now)).toBe(
      "consumed",
    );
    expect(
      resolveJoker(
        selection,
        { ...facts, results: [{ ...result, kimarite: "fusen" }] },
        now,
      ),
    ).toBe("refunded");
    expect(
      resolveJoker(
        selection,
        { ...facts, publications: [], results: [result] },
        now,
      ),
    ).toBe("locked");
  });
  it("doubles only the selected team win+kinboshi, keeps kachi-koshi unchanged, and bounds history", () => {
    const results: BoutResult[] = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      bashoId: "b",
      day: i + 1,
      winnerRikishiId: "m",
      loserRikishiId: i === 7 ? "y" : "x",
    }));
    const team = { id: "t", bashoId: "b", displayName: "T" };
    const picks = [{ teamId: "t", rikishiId: "m" }];
    const options: ScoringOptions = {
      scoringMode: "achievements-v1",
      throughDay: 8,
      banzukeEntries: [
        {
          id: "m",
          bashoId: "b",
          rikishiId: "m",
          rank: "Maegashira 1",
          rankOrder: 2,
        },
        {
          id: "y",
          bashoId: "b",
          rikishiId: "y",
          rank: "Yokozuna",
          rankOrder: 1,
        },
      ],
      jokerSelections: [{ ...selection, day: 8 }],
    };
    expect(calculateTeamScore(team, picks, results, options).score).toBe(16);
    expect(
      calculateTeamScoreHistory(team, picks, results, options).at(-1),
    ).toMatchObject({ day: 8, dailyScore: 9, cumulativeScore: 16 });
    expect(calculateRikishiScore("m", results, options).score).toBe(13);
    expect(
      calculateTeamScore(
        { ...team, id: "other" },
        [{ teamId: "other", rikishiId: "m" }],
        results,
        options,
      ).score,
    ).toBe(13);
    expect(
      calculateTeamScore(team, picks, results, { ...options, throughDay: 7 })
        .score,
    ).toBe(7);
    expect(
      calculateTeamScore(team, picks, results, {
        ...options,
        scoringMode: "wins-v0",
      }).score,
    ).toBe(9);
    expect(
      calculateTeamScore(
        team,
        picks,
        results.map((r) => (r.day === 8 ? { ...r, kimarite: "fusen" } : r)),
        options,
      ).score,
    ).toBe(11);
  });
});
