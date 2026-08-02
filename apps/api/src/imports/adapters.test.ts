import { describe, expect, it } from "vitest";
import { mapJsaBanzukePayload, mapSumoApiTorikumiPayload } from "./adapters.js";

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
});
