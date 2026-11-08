import { describe, expect, it } from "vitest";
import { deriveFantasyFinish } from "./fantasy-finish.js";
import type { Basho, LeaderboardEntry } from "./types.js";

const basho: Basho = {
  id: "2026-09",
  name: "September",
  isDemo: false,
  status: "complete",
  startDate: "2026-09-13",
  endDate: "2026-09-27",
  currentDay: 15,
};
const rows = (scores: number[]): LeaderboardEntry[] =>
  scores.map((score, index) => ({
    rank: index + 1,
    teamId: `team-${index}`,
    displayName: `Stable ${index}`,
    score,
    rikishiScores: [],
    scoreHistory: [],
  }));
const finish = (
  scores: number[],
  patch: Partial<Parameters<typeof deriveFantasyFinish>[0]> = {},
) =>
  deriveFantasyFinish({
    basho,
    leaderboard: rows(scores),
    verifiedThroughDay: 15,
    totalDays: 15,
    finalInputsReady: true,
    ...patch,
  });

describe("verified shared fantasy titles", () => {
  it("shares first without awarding runner-up, regardless of display positions", () => {
    expect(finish([40, 40, 37])).toMatchObject({
      status: "confirmed",
      yusho: [{ teamId: "team-0" }, { teamId: "team-1" }],
      junYusho: [],
    });
  });
  it("shares second and awards one title per recipient", () => {
    expect(finish([40, 37, 37])).toMatchObject({
      status: "confirmed",
      yusho: [{ teamId: "team-0" }],
      junYusho: [{ teamId: "team-1" }, { teamId: "team-2" }],
    });
  });
  it("uses score rather than input order or alphabetical identity", () => {
    expect(finish([12, 40, 37])).toMatchObject({
      status: "confirmed",
      yusho: [{ teamId: "team-1" }],
      junYusho: [{ teamId: "team-2" }],
    });
    expect(finish([0, 0])).toMatchObject({
      status: "confirmed",
      yusho: [{ score: 0 }, { score: 0 }],
      junYusho: [],
    });
  });
  it.each([{ scores: [] }, { scores: [40] }])(
    "requires at least two entrants: $scores",
    ({ scores }) => {
      expect(finish(scores)).toEqual({
        status: "ineligible",
        reason: "too-few-entrants",
      });
    },
  );
  it("does not award from premature closure, missing prizes or unsettled jokers", () => {
    expect(finish([40, 37], { verifiedThroughDay: 14 })).toEqual({
      status: "pending",
      reason: "results-pending",
    });
    expect(finish([40, 37], { finalInputsReady: false })).toEqual({
      status: "pending",
      reason: "scoring-pending",
    });
    expect(finish([40, 37], { totalDays: undefined })).toEqual({
      status: "pending",
      reason: "results-pending",
    });
  });
  it.each(["upcoming", "locked", "active"] as const)(
    "never announces an unfinished %s basho",
    (status) => {
      expect(finish([40, 37], { basho: { ...basho, status } })).toEqual({
        status: "pending",
        reason: "not-complete",
      });
    },
  );
  it("keeps demo honours out of live recognition", () => {
    expect(finish([40, 37], { basho: { ...basho, isDemo: true } })).toEqual({
      status: "ineligible",
      reason: "demo",
    });
  });
  it("derives corrections without retaining or duplicating prior titles", () => {
    expect(finish([10, 9])).toMatchObject({ yusho: [{ teamId: "team-0" }] });
    expect(finish([10, 11])).toMatchObject({
      yusho: [{ teamId: "team-1" }],
      junYusho: [{ teamId: "team-0" }],
    });
    expect(finish([10, 11])).toEqual(finish([10, 11]));
  });
});
