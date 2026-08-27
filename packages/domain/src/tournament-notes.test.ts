import { describe, expect, it } from "vitest";
import type { BanzukeEntry, BoutResult, ScheduledBout } from "./types.js";
import { deriveRikishiTournamentNotes } from "./tournament-notes.js";

const bashoId = "2026-05";
const banzukeEntries: BanzukeEntry[] = [
  {
    id: `${bashoId}-ura`,
    bashoId,
    rikishiId: "ura",
    rank: "Maegashira #1",
    rankOrder: 1,
  },
  {
    id: `${bashoId}-onosato`,
    bashoId,
    rikishiId: "onosato",
    rank: "Yokozuna East",
    rankOrder: 2,
  },
];

describe("deriveRikishiTournamentNotes", () => {
  it("keeps source-reported withdrawal separate from dated achievements", () => {
    const scheduledBouts: ScheduledBout[] = [
      {
        id: "day-9",
        bashoId,
        day: 9,
        eastRikishiId: "ura",
        westRikishiId: "onosato",
        status: "cancelled",
        withdrawnRikishiId: "ura",
      },
    ];
    const boutResults = makeRecord("ura", 8, 0);

    expect(
      deriveRikishiTournamentNotes({
        banzukeEntries,
        bashoStatus: "complete",
        boutResults,
        rikishiId: "ura",
        scheduledBouts,
        throughDay: 15,
      }),
    ).toEqual({
      statuses: [{ type: "withdrawn", effectiveDay: 9, provenance: "source" }],
      achievements: [{ type: "kachi-koshi", day: 8, provenance: "derived" }],
    });
  });

  it("derives a return only from a later recorded non-absence", () => {
    const scheduledBouts: ScheduledBout[] = [
      {
        id: "day-4",
        bashoId,
        day: 4,
        eastRikishiId: "ura",
        westRikishiId: "onosato",
        status: "cancelled",
        withdrawnRikishiId: "ura",
      },
    ];
    const boutResults: BoutResult[] = [
      result(5, "onosato", "ura", { loserAbsent: true }),
      result(6, "ura", "other"),
    ];

    expect(
      deriveRikishiTournamentNotes({
        banzukeEntries,
        boutResults,
        rikishiId: "ura",
        scheduledBouts,
      }).statuses,
    ).toEqual([{ type: "returned", effectiveDay: 6, provenance: "derived" }]);
  });

  it("dates make-koshi on the eighth recorded loss", () => {
    expect(
      deriveRikishiTournamentNotes({
        banzukeEntries,
        boutResults: makeRecord("ura", 0, 9),
        rikishiId: "ura",
        scheduledBouts: [],
      }).achievements,
    ).toEqual([{ type: "make-koshi", day: 8, provenance: "derived" }]);
  });

  it("settles an incomplete withdrawn record as make-koshi when the basho completes", () => {
    expect(
      deriveRikishiTournamentNotes({
        banzukeEntries,
        bashoStatus: "complete",
        boutResults: [
          ...makeRecord("ura", 7, 3),
          result(15, "onosato", "other"),
        ],
        rikishiId: "ura",
        scheduledBouts: [
          {
            id: "day-11-withdrawal",
            bashoId,
            day: 11,
            eastRikishiId: "ura",
            westRikishiId: "onosato",
            status: "cancelled",
            withdrawnRikishiId: "ura",
          },
          scheduledBout(15, "onosato", "other"),
        ],
        throughDay: 15,
      }),
    ).toEqual({
      statuses: [{ type: "withdrawn", effectiveDay: 11, provenance: "source" }],
      achievements: [{ type: "make-koshi", day: 15, provenance: "derived" }],
    });
  });

  it("does not settle a record when a basho is closed before day 15", () => {
    expect(
      deriveRikishiTournamentNotes({
        banzukeEntries,
        bashoStatus: "complete",
        boutResults: makeRecord("ura", 1, 1),
        rikishiId: "ura",
        scheduledBouts: [],
        throughDay: 2,
      }).achievements,
    ).toEqual([]);
  });

  it("does not settle a record without an imported final-day result", () => {
    expect(
      deriveRikishiTournamentNotes({
        banzukeEntries,
        bashoStatus: "complete",
        boutResults: makeRecord("ura", 7, 3),
        rikishiId: "ura",
        scheduledBouts: [],
        throughDay: 15,
      }).achievements,
    ).toEqual([]);
  });

  it("does not settle a record from a partial final-day result import", () => {
    expect(
      deriveRikishiTournamentNotes({
        banzukeEntries,
        bashoStatus: "complete",
        boutResults: [
          ...makeRecord("ura", 7, 3),
          result(15, "onosato", "other"),
        ],
        rikishiId: "ura",
        scheduledBouts: [
          scheduledBout(15, "onosato", "other"),
          scheduledBout(15, "ura", "remaining-opponent"),
        ],
        throughDay: 15,
      }).achievements,
    ).toEqual([]);
  });

  it("derives a gold star only from a recorded maegashira win over a yokozuna", () => {
    const qualifying = deriveRikishiTournamentNotes({
      banzukeEntries,
      boutResults: [result(3, "ura", "onosato")],
      rikishiId: "ura",
      scheduledBouts: [],
    });
    const defaultWin = deriveRikishiTournamentNotes({
      banzukeEntries,
      boutResults: [result(3, "ura", "onosato", { loserAbsent: true })],
      rikishiId: "ura",
      scheduledBouts: [],
    });
    const storedFusenWin = deriveRikishiTournamentNotes({
      banzukeEntries,
      boutResults: [result(3, "ura", "onosato", { kimarite: "fusen" })],
      rikishiId: "ura",
      scheduledBouts: [],
    });

    expect(qualifying.achievements).toEqual([
      { type: "gold-star", day: 3, provenance: "derived" },
    ]);
    expect(defaultWin.achievements).toEqual([]);
    expect(storedFusenWin.achievements).toEqual([]);
  });

  it("returns no notes when the required facts are missing", () => {
    expect(
      deriveRikishiTournamentNotes({
        banzukeEntries: [],
        boutResults: [],
        rikishiId: "unknown",
        scheduledBouts: [],
      }),
    ).toEqual({ statuses: [], achievements: [] });
  });
});

function makeRecord(
  rikishiId: string,
  wins: number,
  losses: number,
): BoutResult[] {
  return [
    ...Array.from({ length: wins }, (_, index) =>
      result(index + 1, rikishiId, `opponent-${index + 1}`),
    ),
    ...Array.from({ length: losses }, (_, index) =>
      result(wins + index + 1, `opponent-${wins + index + 1}`, rikishiId),
    ),
  ];
}

function result(
  day: number,
  winnerRikishiId: string,
  loserRikishiId: string,
  details: Pick<BoutResult, "kimarite" | "winnerAbsent" | "loserAbsent"> = {},
): BoutResult {
  return {
    id: `day-${day}-${winnerRikishiId}-${loserRikishiId}`,
    bashoId,
    day,
    winnerRikishiId,
    loserRikishiId,
    ...details,
  };
}

function scheduledBout(
  day: number,
  eastRikishiId: string,
  westRikishiId: string,
): ScheduledBout {
  return {
    id: `day-${day}-${eastRikishiId}-${westRikishiId}-schedule`,
    bashoId,
    day,
    eastRikishiId,
    westRikishiId,
    status: "scheduled",
  };
}
