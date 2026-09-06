import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
  type DatabaseClient,
} from "@fantasy-sumo/db";
import { buildApp } from "../app.js";

let app: FastifyInstance;
let client: DatabaseClient;
let tmpRoot: string;
let fusenDays: number[];

beforeEach(async () => {
  fusenDays = [];
  tmpRoot = mkdtempSync(join(tmpdir(), "fantasy-sumo-admin-imports-"));
  client = createDatabaseClient(`file:${join(tmpRoot, "test.sqlite")}`);
  await runMigrations(client);
  app = buildApp({
    allowUnprotectedAdminImports: true,
    db: client,
    sourceFetch: async (url) => {
      const sourceUrl = String(url);

      if (sourceUrl.includes("EnHonbashoBanzuke")) {
        return jsonResponse({
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
              banzuke_name: "Ozeki",
              rikishi_id: 4227,
              shikona: "Onosato",
              heya_name: "Nishonoseki",
            },
            {
              banzuke_id: 2,
              banzuke_name: "Ozeki",
              rikishi_id: 3661,
              shikona: "Kotozakura",
              heya_name: "Sadogatake",
            },
          ],
        });
      }

      if (sourceUrl.includes("/banzuke/")) {
        return sumoApiBanzukeResponse(fusenDays);
      }

      const day = Number(sourceUrl.split("/").at(-1));

      return jsonResponse({
        ...(day === 15 ? { yusho: [{ type: "Makuuchi" }] } : {}),
        torikumi: [
          {
            id: "202605-1-1-4227-3661",
            bashoId: "202605",
            day,
            matchNo: 1,
            eastId: 4227,
            eastShikona: "Onosato",
            westId: 3661,
            westShikona: "Kotozakura",
            kimarite: fusenDays.includes(day) ? "fusen" : "oshidashi",
            winnerId: 4227,
            winnerEn: "Onosato",
          },
        ],
      });
    },
  });
});

afterEach(async () => {
  await app.close();
  await client.close();
  rmSync(tmpRoot, { force: true, recursive: true });
});

describe("admin import routes", () => {
  it("requires a token when unprotected imports are disabled", async () => {
    await app.close();
    app = buildApp({
      adminImportToken: "test-import-token",
      allowUnprotectedAdminImports: false,
      db: client,
      sourceFetch: async () => jsonResponse({}),
    });

    const unauthorizedResponse = await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke?dryRun=true",
      payload: {},
    });

    expect(unauthorizedResponse.statusCode).toBe(403);

    const unauthorizedResultsResponse = await app.inject({
      method: "POST",
      url: "/api/admin/basho/2026-05/import-results",
      payload: { day: 4 },
    });

    expect(unauthorizedResultsResponse.statusCode).toBe(403);

    const unauthorizedScheduleResponse = await app.inject({
      method: "POST",
      url: "/api/admin/basho/2026-05/import-schedule",
      payload: { day: 2 },
    });

    expect(unauthorizedScheduleResponse.statusCode).toBe(403);

    const authorizedResponse = await app.inject({
      headers: {
        "x-admin-import-token": "test-import-token",
      },
      method: "POST",
      url: "/api/admin/import-banzuke?dryRun=true",
      payload: {},
    });

    expect(authorizedResponse.statusCode).not.toBe(403);
  });

  it("dry-runs and applies source-backed banzuke imports", async () => {
    const dryRunResponse = await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke?dryRun=true",
      payload: {
        confirmedSourceBashoId: "2026-05",
        expectedBashoId: "2026-05",
      },
    });

    expect(dryRunResponse.statusCode).toBe(200);
    expect(dryRunResponse.json()).toMatchObject({
      dryRun: true,
      source: "jsa-banzuke",
      targetBashoId: "2026-05",
      summary: {
        basho: { created: 1 },
        rikishi: { created: 2 },
      },
    });

    const applyResponse = await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke",
      payload: {
        confirmedSourceBashoId: "2026-05",
        expectedBashoId: "2026-05",
      },
    });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.json()).toMatchObject({
      targetBasho: {
        id: "2026-05",
        name: "2026 May Grand Sumo Tournament",
        status: "active",
      },
      targetBashoId: "2026-05",
    });

    const rikishiResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/rikishi",
    });

    expect(rikishiResponse.statusCode).toBe(200);
    expect(rikishiResponse.json().rikishi).toHaveLength(2);
  });

  it("discovers a new source basho but requires its exact target to be confirmed before applying", async () => {
    const dryRunResponse = await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke?dryRun=true",
      payload: { expectedBashoId: "2026-07" },
    });

    expect(dryRunResponse.statusCode).toBe(200);
    expect(dryRunResponse.json()).toMatchObject({
      dryRun: true,
      targetBashoId: "2026-05",
    });
    expect(
      await createRepositories(client).getBasho("2026-05"),
    ).toBeUndefined();

    const missingConfirmationResponse = await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke",
      payload: {},
    });

    expect(missingConfirmationResponse.statusCode).toBe(409);
    expect(missingConfirmationResponse.json()).toMatchObject({
      error: "basho-target-mismatch",
      sourceBashoId: "2026-05",
    });
    expect(
      await createRepositories(client).getBasho("2026-05"),
    ).toBeUndefined();

    const unconfirmedResponse = await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke",
      payload: { expectedBashoId: "2026-07" },
    });

    expect(unconfirmedResponse.statusCode).toBe(409);
    expect(unconfirmedResponse.json()).toMatchObject({
      error: "basho-target-mismatch",
      expectedBashoId: "2026-07",
      sourceBashoId: "2026-05",
    });
    expect(
      await createRepositories(client).getBasho("2026-05"),
    ).toBeUndefined();

    const staleConfirmationResponse = await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke",
      payload: {
        confirmedSourceBashoId: "2026-03",
        expectedBashoId: "2026-07",
      },
    });

    expect(staleConfirmationResponse.statusCode).toBe(409);
    expect(staleConfirmationResponse.json()).toMatchObject({
      confirmedSourceBashoId: "2026-03",
      error: "basho-target-mismatch",
      sourceBashoId: "2026-05",
    });
    expect(
      await createRepositories(client).getBasho("2026-05"),
    ).toBeUndefined();

    const confirmedResponse = await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke",
      payload: {
        confirmedSourceBashoId: "2026-05",
        expectedBashoId: "2026-07",
      },
    });

    expect(confirmedResponse.statusCode).toBe(200);
    expect(confirmedResponse.json()).toMatchObject({
      dryRun: false,
      targetBashoId: "2026-05",
    });
    expect(await createRepositories(client).getBasho("2026-05")).toBeDefined();
  });

  it("imports source-backed daily results", async () => {
    await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke",
      payload: { confirmedSourceBashoId: "2026-05" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/basho/2026-05/import-results",
      payload: {
        day: 1,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "complete",
      source: "sumo-api-results",
      summary: {
        results: { created: 1 },
      },
      schedule: {
        status: "imported",
        day: 2,
        import: {
          summary: { scheduledBouts: { created: 1 } },
        },
      },
    });

    const leaderboardResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/leaderboard",
    });
    expect(leaderboardResponse.statusCode).toBe(200);
  });

  it("backfills forfeit days and exposes verified previous-basho records", async () => {
    fusenDays = [7, 14];
    await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke",
      payload: { confirmedSourceBashoId: "2026-05" },
    });
    const repositories = createRepositories(client);

    for (let day = 1; day <= 15; day++) {
      const dryRun = await app.inject({
        method: "POST",
        url: "/api/admin/basho/2026-05/import-results?dryRun=true",
        payload: { day },
      });
      expect(dryRun.statusCode, `day ${day} dry run`).toBe(200);
      expect(
        await repositories.listBoutResultsForBasho("2026-05"),
      ).toHaveLength(day - 1);

      const applied = await app.inject({
        method: "POST",
        url: "/api/admin/basho/2026-05/import-results",
        payload: { day },
      });
      expect(applied.statusCode, `day ${day} import`).toBe(200);
    }

    const results = await repositories.listBoutResultsForBasho("2026-05");
    expect(results).toHaveLength(15);
    expect(
      results
        .filter((result) => result.loserAbsent)
        .map((result) => result.day),
    ).toEqual(fusenDays);
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "complete",
      currentDay: 15,
    });

    const retry = await app.inject({
      method: "POST",
      url: "/api/admin/basho/2026-05/import-results",
      payload: { day: 7 },
    });
    expect(retry.statusCode).toBe(200);
    expect(await repositories.listBoutResultsForBasho("2026-05")).toEqual(
      results,
    );
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "complete",
      currentDay: 15,
    });

    await repositories.upsertBasho({
      id: "2026-07",
      isDemo: false,
      name: "July Basho",
      startDate: "2026-07-12",
      endDate: "2026-07-26",
      status: "upcoming",
      currentDay: 0,
    });
    for (const entry of await repositories.listBanzukeEntriesForBasho(
      "2026-05",
    )) {
      await repositories.upsertBanzukeEntry({
        ...entry,
        id: `2026-07-${entry.rikishiId}`,
        bashoId: "2026-07",
      });
    }
    const picks = await app.inject({
      method: "GET",
      url: "/api/basho/2026-07/rikishi",
    });
    expect(picks.statusCode).toBe(200);
    expect(picks.json().rikishi).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "onosato",
          previousBashoRecord: expect.objectContaining({
            status: "available",
            wins: 15,
            losses: 0,
            absences: 0,
          }),
        }),
        expect.objectContaining({
          id: "kotozakura",
          previousBashoRecord: expect.objectContaining({
            status: "available",
            wins: 0,
            losses: 13,
            absences: 2,
          }),
        }),
      ]),
    );
  });

  it("blocks final-day data when earlier result days are missing", async () => {
    await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke",
      payload: { confirmedSourceBashoId: "2026-05" },
    });

    const dryRunResponse = await app.inject({
      method: "POST",
      url: "/api/admin/basho/2026-05/import-results?dryRun=true",
      payload: { day: 15 },
    });

    expect(dryRunResponse.statusCode).toBe(400);
    expect(dryRunResponse.json()).toMatchObject({
      error: "invalid-import",
    });

    const repositories = createRepositories(client);
    expect(
      await repositories.listScheduledBoutPublicationsForBasho("2026-05"),
    ).toEqual([]);
    expect(await repositories.listBoutResultsForBasho("2026-05")).toEqual([]);
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 3,
    });

    const applyResponse = await app.inject({
      method: "POST",
      url: "/api/admin/basho/2026-05/import-results",
      payload: { day: 15 },
    });

    expect(applyResponse.statusCode).toBe(400);
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 3,
    });
    expect(
      await repositories.listScheduledBoutPublicationsForBasho("2026-05"),
    ).toEqual([]);
    expect(await repositories.listBoutResultsForBasho("2026-05")).toEqual([]);
  });

  it("keeps the existing final schedule when snapshot fetching fails", async () => {
    await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke",
      payload: { confirmedSourceBashoId: "2026-05" },
    });
    const repositories = createRepositories(client);
    await repositories.applyScheduledBoutsImport({
      publication: {
        id: "2026-05-day-15-schedule",
        bashoId: "2026-05",
        day: 15,
        source: "existing-schedule",
        publishedAt: "2026-05-23T08:00:00.000Z",
      },
      bouts: [
        {
          id: "existing-day-15-bout",
          bashoId: "2026-05",
          day: 15,
          eastRikishiId: "onosato",
          westRikishiId: "kotozakura",
          status: "cancelled",
        },
      ],
    });

    await app.close();
    app = buildApp({
      allowUnprotectedAdminImports: true,
      db: client,
      sourceFetch: async (url) => {
        return String(url).includes("/banzuke/")
          ? sumoApiBanzukeResponse()
          : new Response(null, { status: 503 });
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/basho/2026-05/import-results",
      payload: { day: 15 },
    });

    expect(response.statusCode).toBe(502);
    expect(
      await repositories.listScheduledBoutPublicationsForBasho("2026-05"),
    ).toEqual([expect.objectContaining({ source: "existing-schedule" })]);
    expect(await repositories.listScheduledBoutsForBasho("2026-05")).toEqual([
      expect.objectContaining({
        id: "existing-day-15-bout",
        status: "cancelled",
      }),
    ]);
    expect(await repositories.listBoutResultsForBasho("2026-05")).toEqual([]);
  });

  it("keeps imported results and reports partial success when the next schedule is unavailable", async () => {
    await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke",
      payload: { confirmedSourceBashoId: "2026-05" },
    });

    await app.close();
    app = buildApp({
      allowUnprotectedAdminImports: true,
      db: client,
      sourceFetch: async (url) => {
        const sourceUrl = String(url);

        if (sourceUrl.includes("/banzuke/")) {
          return sumoApiBanzukeResponse();
        }

        const day = Number(sourceUrl.split("/").at(-1));

        return day === 1
          ? jsonResponse({
              torikumi: [
                {
                  bashoId: "202605",
                  day: 1,
                  matchNo: 1,
                  eastId: 4227,
                  eastShikona: "Onosato",
                  westId: 3661,
                  westShikona: "Kotozakura",
                  winnerId: 4227,
                },
              ],
            })
          : jsonResponse({ torikumi: [] });
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/basho/2026-05/import-results",
      payload: { day: 1 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "partial",
      summary: { results: { created: 1 } },
      schedule: {
        status: "unavailable",
        day: 2,
        message:
          "Sumo API schedule for 2026-05 day 2 is not published or unavailable.",
      },
    });

    const repositories = createRepositories(client);
    expect(await repositories.listBoutResultsForBasho("2026-05")).toHaveLength(
      1,
    );
    expect(
      await repositories.listScheduledBoutPublicationsForBasho("2026-05"),
    ).toEqual([
      expect.objectContaining({
        day: 1,
        source: "sumo-api-schedule:complete",
      }),
    ]);
  });

  it("imports future schedules without creating scored results", async () => {
    await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke",
      payload: { confirmedSourceBashoId: "2026-05" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/basho/2026-05/import-schedule",
      payload: { day: 4 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      source: "sumo-api-schedule",
      summary: { scheduledBouts: { created: 1 } },
    });

    const scheduleResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/schedule",
    });
    expect(scheduleResponse.json()).toMatchObject({
      publishedDays: [4],
      bouts: [
        {
          day: 4,
          east: { shikona: "Onosato", rank: "Ozeki" },
          west: { shikona: "Kotozakura", rank: "Ozeki" },
          status: "scheduled",
        },
      ],
    });

    const leaderboardResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/leaderboard",
    });
    expect(
      leaderboardResponse
        .json()
        .leaderboard.every((entry: { score: number }) => entry.score === 0),
    ).toBe(true);
  });

  it("keeps an existing schedule when the source returns no card", async () => {
    await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke",
      payload: { confirmedSourceBashoId: "2026-05" },
    });
    await app.inject({
      method: "POST",
      url: "/api/admin/basho/2026-05/import-schedule",
      payload: { day: 4 },
    });

    await app.close();
    app = buildApp({
      allowUnprotectedAdminImports: true,
      db: client,
      sourceFetch: async () => jsonResponse({ torikumi: [] }),
    });

    const emptyImportResponse = await app.inject({
      method: "POST",
      url: "/api/admin/basho/2026-05/import-schedule",
      payload: { day: 4 },
    });

    expect(emptyImportResponse.statusCode).toBe(502);
    expect(emptyImportResponse.json()).toMatchObject({
      error: "source-import-failed",
      message:
        "Sumo API schedule for 2026-05 day 4 is not published or unavailable.",
    });

    const scheduleResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/schedule",
    });
    expect(scheduleResponse.json()).toMatchObject({
      publishedDays: [4],
      bouts: [
        {
          day: 4,
          east: { shikona: "Onosato" },
          west: { shikona: "Kotozakura" },
        },
      ],
    });
  });
});

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
    },
  });
}

function sumoApiBanzukeResponse(fusenDays: readonly number[] = []) {
  return jsonResponse({
    east: [
      {
        rikishiID: 4227,
        shikonaEn: "Onosato",
        record: Array.from({ length: 15 }, (_, index) => ({
          result: fusenDays.includes(index + 1) ? "fusen win" : "win",
        })),
      },
    ],
    west: [
      {
        rikishiID: 3661,
        shikonaEn: "Kotozakura",
        record: Array.from({ length: 15 }, (_, index) => ({
          result: fusenDays.includes(index + 1) ? "fusen loss" : "loss",
        })),
      },
    ],
  });
}
