import { describe, expect, it } from "vitest";
import type { BoutResult, ScheduledBout } from "./types.js";
import { getVerifiedBoutResultsThroughDay } from "./bout-result-completeness.js";

describe("getVerifiedBoutResultsThroughDay", () => {
  it("stops at the first missing or unverified day", () => {
    const scheduledBouts = [1, 2, 3].map<ScheduledBout>((day) => ({
      id: `day-${day}`,
      bashoId: "2026-09",
      day,
      eastRikishiId: "east",
      westRikishiId: "west",
      status: "scheduled",
    }));
    const boutResults = [1, 3].map<BoutResult>((day) => ({
      id: `day-${day}`,
      bashoId: "2026-09",
      day,
      winnerRikishiId: "east",
      loserRikishiId: "west",
    }));

    expect(
      getVerifiedBoutResultsThroughDay({
        boutResults,
        completeScheduleDays: new Set([1, 2, 3]),
        scheduledBouts,
        throughDay: 3,
      }),
    ).toBe(1);
  });
});
