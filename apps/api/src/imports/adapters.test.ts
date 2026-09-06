import { describe, expect, it } from "vitest";
import { deriveRikishiTournamentNotes } from "@fantasy-sumo/domain";
import {
  fetchSumoApiDailyImport,
  mapJsaBanzukePayload,
  mapSumoApiSchedulePayload,
  mapSumoApiTorikumiPayload,
} from "./adapters.js";

describe("source import adapters", () => {
  it("maps JSA banzuke payloads into local import commands", () => {
    const command = mapJsaBanzukePayload({
      basho_name: "May Grand Sumo Tournament",
      BashoInfo: {
        start_date: "2026-05-10",
        end_date: "2026-05-24",
        today: "2026-05-12",
        BattleNow: 1,
        year_eng: "2026",
      },
      BanzukeTable: [
        {
          banzuke_id: 1,
          banzuke_name: "Yokozuna",
          rikishi_id: 3842,
          shikona: "Hoshoryu",
          heya_name: "Tatsunami",
        },
        {
          banzuke_id: 2,
          banzuke_name: "Ozeki",
          rikishi_id: 4227,
          shikona: "Onosato",
          heya_name: "Nishonoseki",
        },
        {
          banzuke_id: 0,
          banzuke_name: "",
          rikishi_id: "",
          shikona: "",
          heya_name: "",
        },
      ],
    });

    expect(command).toMatchObject({
      source: "jsa-banzuke",
      basho: {
        id: "2026-05",
        name: "2026 May Grand Sumo Tournament",
        status: "active",
        currentDay: 3,
      },
      rikishi: [
        {
          id: "hoshoryu",
          shikona: "Hoshoryu",
          heya: "Tatsunami",
        },
        {
          id: "onosato",
          shikona: "Onosato",
          heya: "Nishonoseki",
        },
      ],
      banzukeEntries: [
        {
          id: "2026-05-hoshoryu",
          rikishiId: "hoshoryu",
          rank: "Yokozuna",
          rankOrder: 1,
        },
        {
          id: "2026-05-onosato",
          rikishiId: "onosato",
          rank: "Ozeki",
          rankOrder: 2,
        },
      ],
    });
  });

  it("locks imported basho once the start date has arrived before active scoring", () => {
    const command = mapJsaBanzukePayload({
      basho_name: "May Grand Sumo Tournament",
      BashoInfo: {
        start_date: "2026-05-10",
        end_date: "2026-05-24",
        today: "2026-05-10",
        BattleNow: 0,
        year_eng: "2026",
      },
      BanzukeTable: [
        {
          banzuke_id: 1,
          banzuke_name: "Yokozuna",
          rikishi_id: 3842,
          shikona: "Hoshoryu",
          heya_name: "Tatsunami",
        },
      ],
    });

    expect(command.basho).toMatchObject({
      status: "locked",
      currentDay: 1,
    });
  });

  it("maps Sumo API torikumi payloads into local result commands", () => {
    const command = mapSumoApiTorikumiPayload(
      {
        torikumi: [
          {
            id: "202605-1-1-4227-3661",
            bashoId: "202605",
            day: 1,
            matchNo: 1,
            eastId: 4227,
            eastShikona: "Onosato",
            westId: 3661,
            westShikona: "Kotozakura",
            kimarite: "oshidashi",
            winnerId: 4227,
            winnerEn: "Onosato",
          },
        ],
      },
      {
        bashoId: "2026-05",
        day: 1,
      },
    );

    expect(command).toEqual({
      source: "sumo-api-results",
      bashoId: "2026-05",
      rikishi: [
        {
          id: "onosato",
          shikona: "Onosato",
        },
        {
          id: "kotozakura",
          shikona: "Kotozakura",
        },
      ],
      results: [
        {
          id: "2026-05-day-1-match-1",
          bashoId: "2026-05",
          day: 1,
          winnerRikishiId: "onosato",
          loserRikishiId: "kotozakura",
          kimarite: "oshidashi",
        },
      ],
    });
  });

  it("uses winnerEn when numeric winner ids are missing", () => {
    const command = mapSumoApiTorikumiPayload(
      {
        torikumi: [
          {
            bashoId: "202605",
            day: 1,
            matchNo: 1,
            eastShikona: "Onosato",
            westShikona: "Kotozakura",
            kimarite: "oshidashi",
            winnerEn: "Kotozakura",
          },
        ],
      },
      {
        bashoId: "2026-05",
        day: 1,
      },
    );

    expect(command.results[0]).toMatchObject({
      winnerRikishiId: "kotozakura",
      loserRikishiId: "onosato",
    });
  });

  it("preserves a fusen loss as an absence and does not derive a gold star", () => {
    const command = mapSumoApiTorikumiPayload(
      {
        torikumi: [
          {
            bashoId: "202605",
            day: 3,
            matchNo: 1,
            eastId: 28,
            eastShikona: "Ura",
            westId: 8850,
            westShikona: "Onosato",
            kimarite: "fusen",
            winnerId: 28,
            winnerEn: "Ura",
          },
        ],
      },
      { bashoId: "2026-05", day: 3 },
    );

    expect(command.results[0]).toMatchObject({
      winnerRikishiId: "ura",
      loserRikishiId: "onosato",
      kimarite: "fusen",
      loserAbsent: true,
    });
    expect(
      deriveRikishiTournamentNotes({
        banzukeEntries: [
          {
            id: "2026-05-ura",
            bashoId: "2026-05",
            rikishiId: "ura",
            rank: "Maegashira #1",
            rankOrder: 1,
          },
          {
            id: "2026-05-onosato",
            bashoId: "2026-05",
            rikishiId: "onosato",
            rank: "Yokozuna West",
            rankOrder: 2,
          },
        ],
        boutResults: command.results,
        rikishiId: "ura",
        scheduledBouts: [],
      }).achievements,
    ).toEqual([]);
  });

  it("maps a future torikumi without inventing a result", () => {
    const command = mapSumoApiSchedulePayload(
      {
        torikumi: [
          {
            bashoId: "202605",
            day: 4,
            matchNo: 2,
            eastShikona: "Onosato",
            westShikona: "Kotozakura",
          },
        ],
      },
      { bashoId: "2026-05", day: 4 },
    );

    expect(command).toEqual({
      source: "sumo-api-schedule",
      bashoId: "2026-05",
      day: 4,
      rikishi: [
        { id: "onosato", shikona: "Onosato" },
        { id: "kotozakura", shikona: "Kotozakura" },
      ],
      bouts: [
        {
          id: "2026-05-day-4-match-2",
          bashoId: "2026-05",
          day: 4,
          eastRikishiId: "onosato",
          westRikishiId: "kotozakura",
          status: "scheduled",
        },
      ],
    });
    expect(JSON.stringify(command)).not.toContain("winner");
  });

  it("requires banzuke record coverage before attesting a resolved card", () => {
    const completeDay14Banzuke = {
      east: [
        {
          rikishiID: 4227,
          shikonaEn: "Onosato",
          record: Array.from({ length: 14 }, () => ({ result: "win" })),
        },
      ],
      west: [
        {
          rikishiID: 3661,
          shikonaEn: "Kotozakura",
          record: Array.from({ length: 14 }, () => ({ result: "loss" })),
        },
      ],
    };
    const resolvedEarlierDay = mapSumoApiSchedulePayload(
      {
        torikumi: [
          {
            bashoId: "202605",
            day: 14,
            eastShikona: "Onosato",
            westShikona: "Kotozakura",
            winnerEn: "Onosato",
          },
        ],
      },
      {
        bashoId: "2026-05",
        day: 14,
        expectedRikishiIds: ["onosato", "kotozakura"],
      },
      completeDay14Banzuke,
    );
    const contradictoryEarlierDay = mapSumoApiSchedulePayload(
      {
        torikumi: [
          {
            bashoId: "202605",
            day: 14,
            eastShikona: "Onosato",
            westShikona: "Kotozakura",
            winnerEn: "Kotozakura",
          },
        ],
      },
      {
        bashoId: "2026-05",
        day: 14,
        expectedRikishiIds: ["onosato", "kotozakura"],
      },
      completeDay14Banzuke,
    );
    const mutuallyTruncatedEarlierDay = mapSumoApiSchedulePayload(
      {
        torikumi: [
          {
            bashoId: "202605",
            day: 14,
            eastShikona: "Onosato",
            westShikona: "Kotozakura",
            winnerEn: "Onosato",
          },
        ],
      },
      {
        bashoId: "2026-05",
        day: 14,
        expectedRikishiIds: ["onosato", "kotozakura", "hoshoryu"],
      },
      completeDay14Banzuke,
    );
    const truncatedEarlierDay = mapSumoApiSchedulePayload(
      {
        torikumi: [
          {
            bashoId: "202605",
            day: 14,
            eastShikona: "Onosato",
            westShikona: "Kotozakura",
            winnerEn: "Onosato",
          },
        ],
      },
      {
        bashoId: "2026-05",
        day: 14,
        expectedRikishiIds: ["onosato", "kotozakura", "hoshoryu"],
      },
      {
        ...completeDay14Banzuke,
        east: [
          ...completeDay14Banzuke.east,
          {
            rikishiID: 99,
            shikonaEn: "Hoshoryu",
            record: Array.from({ length: 14 }, () => ({ result: "win" })),
          },
        ],
      },
    );
    const incomplete = mapSumoApiSchedulePayload(
      {
        torikumi: [
          {
            bashoId: "202605",
            day: 15,
            eastShikona: "Onosato",
            westShikona: "Kotozakura",
            winnerEn: "Onosato",
          },
        ],
      },
      {
        bashoId: "2026-05",
        day: 15,
        expectedRikishiIds: ["onosato", "kotozakura"],
      },
      {
        east: [
          {
            shikonaEn: "Onosato",
            record: Array.from({ length: 15 }, () => ({ result: "win" })),
          },
        ],
        west: [
          {
            shikonaEn: "Kotozakura",
            record: Array.from({ length: 15 }, () => ({ result: "loss" })),
          },
        ],
      },
    );
    const complete = mapSumoApiSchedulePayload(
      {
        torikumi: [
          {
            bashoId: "202605",
            day: 15,
            eastShikona: "Onosato",
            westShikona: "Kotozakura",
            winnerEn: "Onosato",
          },
        ],
        yusho: [{ type: "Makuuchi" }],
      },
      {
        bashoId: "2026-05",
        day: 15,
        expectedRikishiIds: ["onosato", "kotozakura"],
      },
      {
        east: [
          {
            shikonaEn: "Onosato",
            record: Array.from({ length: 15 }, () => ({ result: "win" })),
          },
        ],
        west: [
          {
            shikonaEn: "Kotozakura",
            record: Array.from({ length: 15 }, () => ({ result: "loss" })),
          },
        ],
      },
    );
    const mismatchedTarget = mapSumoApiSchedulePayload(
      {
        torikumi: [
          {
            bashoId: "202605",
            day: 14,
            eastShikona: "Onosato",
            westShikona: "Kotozakura",
            winnerEn: "Onosato",
          },
        ],
      },
      {
        bashoId: "2026-05",
        day: 14,
        division: "Makuuchi",
        expectedRikishiIds: ["onosato", "kotozakura"],
      },
      {
        ...completeDay14Banzuke,
        bashoId: "202607",
        division: "Juryo",
      },
    );

    expect(resolvedEarlierDay.isComplete).toBe(true);
    expect(contradictoryEarlierDay.isComplete).toBeUndefined();
    expect(mutuallyTruncatedEarlierDay.isComplete).toBeUndefined();
    expect(truncatedEarlierDay.isComplete).toBeUndefined();
    expect(incomplete.isComplete).toBeUndefined();
    expect(complete.isComplete).toBe(true);
    expect(mismatchedTarget.isComplete).toBeUndefined();
  });

  it.each(["oshidashi", "fusen"])(
    "maps the current %s schedule and results from one torikumi response",
    async (kimarite) => {
      const requestedUrls: string[] = [];
      const torikumiPayload = {
        torikumi: [
          {
            bashoId: "202605",
            day: 4,
            eastId: 4227,
            eastShikona: "Onosato",
            westId: 3661,
            westShikona: "Kotozakura",
            winnerId: 4227,
            winnerEn: "Onosato",
            kimarite,
          },
        ],
      };

      const commands = await fetchSumoApiDailyImport(
        async (url) => {
          requestedUrls.push(String(url));
          return new Response(
            JSON.stringify(
              String(url).includes("/banzuke/")
                ? {
                    east: [
                      {
                        rikishiID: 4227,
                        shikonaEn: "Onosato",
                        record: Array.from({ length: 4 }, () => ({
                          result: kimarite === "fusen" ? "fusen win" : "win",
                        })),
                      },
                    ],
                    west: [
                      {
                        rikishiID: 3661,
                        shikonaEn: "Kotozakura",
                        record: Array.from({ length: 4 }, () => ({
                          result: kimarite === "fusen" ? "fusen loss" : "loss",
                        })),
                      },
                    ],
                  }
                : torikumiPayload,
            ),
          );
        },
        {
          bashoId: "2026-05",
          day: 4,
          expectedRikishiIds: ["onosato", "kotozakura"],
        },
      );

      expect(
        requestedUrls.filter((url) => url.includes("/torikumi/")),
      ).toHaveLength(1);
      expect(commands.scheduleCommand.bouts[0]).toMatchObject({
        eastRikishiId: "onosato",
        westRikishiId: "kotozakura",
      });
      expect(commands.resultsCommand.results[0]).toMatchObject({
        winnerRikishiId: "onosato",
        loserRikishiId: "kotozakura",
      });
      expect(commands.scheduleCommand.isComplete).toBe(true);
      expect(commands.resultsCommand.results[0]?.loserAbsent).toBe(
        kimarite === "fusen" ? true : undefined,
      );
    },
  );

  it.each([
    ["fusen win", "fusen loss", "fusen", true],
    [" FUSEN WIN ", " FUSEN LOSS ", " FUSEN ", true],
    ["win", "loss", "fusen", true],
    ["fusen loss", "fusen win", "fusen", false],
    ["fusen win", "fusen loss", "oshidashi", false],
    ["fusen win", "fusen loss", undefined, false],
    ["fusen win", "absent", "fusen", false],
    ["fusen win", "unknown", "fusen", false],
    ["fusen win", "", "fusen", false],
  ])(
    "attests records %s / %s with kimarite %s: %s",
    (winnerRecord, loserRecord, kimarite, expectedComplete) => {
      const command = mapSumoApiSchedulePayload(
        {
          torikumi: [
            {
              eastShikona: "Wakanosho",
              westShikona: "Kinbozan",
              winnerEn: "Kinbozan",
              kimarite,
            },
          ],
        },
        {
          bashoId: "2026-07",
          day: 7,
          expectedRikishiIds: ["wakanosho", "kinbozan"],
        },
        {
          east: [
            {
              shikonaEn: "Wakanosho",
              record: Array.from({ length: 7 }, () => ({
                result: loserRecord,
              })),
            },
          ],
          west: [
            {
              shikonaEn: "Kinbozan",
              record: Array.from({ length: 7 }, () => ({
                result: winnerRecord,
              })),
            },
          ],
        },
      );
      expect(command.isComplete).toBe(expectedComplete ? true : undefined);
    },
  );

  it("maps torikumi as unattested when banzuke fetching fails", async () => {
    const commands = await fetchSumoApiDailyImport(
      async (url) =>
        String(url).includes("/banzuke/")
          ? new Response(null, { status: 503 })
          : new Response(
              JSON.stringify({
                torikumi: [
                  {
                    bashoId: "202605",
                    day: 4,
                    eastShikona: "Onosato",
                    westShikona: "Kotozakura",
                    winnerEn: "Onosato",
                  },
                ],
              }),
            ),
      {
        bashoId: "2026-05",
        day: 4,
        expectedRikishiIds: ["onosato", "kotozakura"],
      },
    );

    expect(commands.scheduleCommand.isComplete).toBeUndefined();
    expect(commands.resultsCommand.results).toHaveLength(1);
  });

  it("maps torikumi as unattested when the banzuke payload is malformed", async () => {
    const commands = await fetchSumoApiDailyImport(
      async (url) =>
        new Response(
          String(url).includes("/banzuke/")
            ? "null"
            : JSON.stringify({
                torikumi: [
                  {
                    bashoId: "202605",
                    day: 4,
                    eastShikona: "Onosato",
                    westShikona: "Kotozakura",
                    winnerEn: "Onosato",
                  },
                ],
              }),
        ),
      {
        bashoId: "2026-05",
        day: 4,
        expectedRikishiIds: ["onosato", "kotozakura"],
      },
    );

    expect(commands.scheduleCommand.isComplete).toBeUndefined();
    expect(commands.resultsCommand.results).toHaveLength(1);
  });

  it("rejects an empty source schedule instead of claiming it was published", () => {
    expect(() =>
      mapSumoApiSchedulePayload(
        { torikumi: [] },
        { bashoId: "2026-05", day: 5 },
      ),
    ).toThrow(
      "Sumo API schedule for 2026-05 day 5 is not published or unavailable.",
    );
  });
});
