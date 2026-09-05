import { describe, expect, it } from "vitest";
import type { BanzukeEntry, Basho, BoutResult } from "./types.js";
import {
  derivePreviousBashoRecord,
  findPreviousCompletedBasho,
} from "./previous-basho-record.js";

const targetBasho: Basho = {
  id: "2026-05",
  isDemo: false,
  name: "May 2026 Basho",
  startDate: "2026-05-10",
  endDate: "2026-05-24",
  status: "upcoming",
};

const previousBasho: Basho = {
  id: "2026-03",
  isDemo: false,
  name: "March 2026 Basho",
  startDate: "2026-03-08",
  endDate: "2026-03-22",
  status: "complete",
  currentDay: 15,
};

const banzukeEntries: BanzukeEntry[] = [
  {
    id: "2026-03-onosato",
    bashoId: previousBasho.id,
    rikishiId: "onosato",
    rank: "Ozeki",
    rankOrder: 1,
  },
];

describe("findPreviousCompletedBasho", () => {
  it("chooses the nearest earlier completed basho in the same data mode", () => {
    expect(
      findPreviousCompletedBasho(targetBasho, [
        {
          ...previousBasho,
          id: "2026-01",
          name: "January 2026 Basho",
          startDate: "2026-01-11",
          endDate: "2026-01-25",
        },
        { ...previousBasho, isDemo: true },
        previousBasho,
        { ...previousBasho, id: "2026-04", status: "active" },
        targetBasho,
      ]),
    ).toEqual(previousBasho);
  });

  it("ignores overlapping, malformed, and future bashos", () => {
    expect(
      findPreviousCompletedBasho(targetBasho, [
        { ...previousBasho, id: "overlap", endDate: targetBasho.startDate },
        { ...previousBasho, id: "malformed", endDate: "not-a-date" },
        {
          ...previousBasho,
          id: "future",
          startDate: "2026-07-12",
          endDate: "2026-07-26",
        },
      ]),
    ).toBeUndefined();
  });
});

describe("derivePreviousBashoRecord", () => {
  it("derives wins, losses, and trailing absences from a completed basho", () => {
    const results: BoutResult[] = [
      result(1, "onosato", "hoshoryu"),
      result(2, "kirishima", "onosato"),
      {
        ...result(3, "kotozakura", "onosato"),
        loserAbsent: true,
      },
    ];

    expect(
      derivePreviousBashoRecord({
        basho: previousBasho,
        banzukeEntries,
        boutResults: results,
        rikishiId: "onosato",
        totalDays: 5,
      }),
    ).toEqual({
      bashoId: "2026-03",
      bashoName: "March 2026 Basho",
      startDate: "2026-03-08",
      rank: "Ozeki",
      wins: 1,
      losses: 1,
      absences: 3,
    });
  });

  it("returns no record when the rikishi was not on that banzuke", () => {
    expect(
      derivePreviousBashoRecord({
        basho: previousBasho,
        banzukeEntries,
        boutResults: [],
        rikishiId: "tobizaru",
        totalDays: 15,
      }),
    ).toBeUndefined();
  });

  it("rejects incomplete bashos and ambiguous multiple appearances", () => {
    expect(
      derivePreviousBashoRecord({
        basho: { ...previousBasho, status: "active" },
        banzukeEntries,
        boutResults: [],
        rikishiId: "onosato",
        totalDays: 15,
      }),
    ).toBeUndefined();
    expect(
      derivePreviousBashoRecord({
        basho: previousBasho,
        banzukeEntries,
        boutResults: [
          result(15, "onosato", "hoshoryu"),
          result(15, "onosato", "kirishima"),
        ],
        rikishiId: "onosato",
        totalDays: 15,
      }),
    ).toBeUndefined();
  });
});

function result(
  day: number,
  winnerRikishiId: string,
  loserRikishiId: string,
): BoutResult {
  return {
    id: `2026-03-${day}-${winnerRikishiId}-${loserRikishiId}`,
    bashoId: previousBasho.id,
    day,
    winnerRikishiId,
    loserRikishiId,
  };
}
