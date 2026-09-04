import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDatabaseClient,
  createRepositories,
  DEMO_BASHO_ID,
  runMigrations,
  type DatabaseClient,
} from "@fantasy-sumo/db";
import { buildApp } from "../app.js";

const CRON_SECRET = "test-cron-secret";
const NOW = new Date("2026-05-11T15:30:00.000Z");

let app: FastifyInstance | undefined;
let client: DatabaseClient;
let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), "fantasy-sumo-scheduled-imports-"));
  client = createDatabaseClient(`file:${join(tmpRoot, "test.sqlite")}`);
  await runMigrations(client);
});

afterEach(async () => {
  await app?.close();
  await client.close();
  rmSync(tmpRoot, { force: true, recursive: true });
});

describe("scheduled result import route", () => {
  it("requires the configured Vercel cron bearer token", async () => {
    app = createApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/cron/import-results",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: "scheduled-import-unauthorized",
    });
  });

  it("imports the Japan-calendar basho day and safely reruns that same day", async () => {
    await seedLiveBasho("2026-05", { importedDays: [1, 2] });
    const requestedDays: number[] = [];
    app = createApp(async (url) => {
      const requestedDay = dayFromUrl(url);
      if (Number.isFinite(requestedDay)) requestedDays.push(requestedDay);
      return resultsResponse(requestedDay);
    });

    const firstResponse = await injectCron(app);

    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.json()).toMatchObject({
      status: "imported",
      bashoId: "2026-05",
      day: 3,
      japanDate: "2026-05-12",
      import: {
        source: "sumo-api-results",
        summary: {
          results: { created: 1 },
        },
      },
      schedule: {
        status: "imported",
        day: 4,
        import: {
          summary: { scheduledBouts: { created: 1 } },
        },
      },
    });
    expect(requestedDays).toEqual([3, 4]);

    const secondResponse = await injectCron(app);

    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.json()).toMatchObject({
      status: "imported",
      bashoId: "2026-05",
      day: 3,
      import: {
        summary: {
          results: { created: 0, skipped: 1 },
        },
      },
      schedule: {
        status: "imported",
        day: 4,
        import: {
          summary: { scheduledBouts: { created: 0, skipped: 1 } },
        },
      },
    });
    expect(requestedDays).toEqual([3, 4, 3, 4]);

    const repositories = createRepositories(client);
    expect(await repositories.listBoutResultsForBasho("2026-05")).toHaveLength(
      3,
    );
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 3,
    });
  });

  it("locks picks the day before day zero without fetching results and safely reruns", async () => {
    await seedLiveBasho("2026-05", {
      status: "upcoming",
      currentDay: 0,
      withTeam: true,
    });
    let fetchCalls = 0;
    app = createApp(async () => {
      fetchCalls += 1;
      return resultsResponse();
    }, new Date("2026-05-08T02:00:00.000Z"));

    const firstResponse = await injectCron(app);

    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.json()).toMatchObject({
      status: "locked",
      bashoId: "2026-05",
      day: -1,
      japanDate: "2026-05-08",
      lockedAt: "2026-05-08T02:00:00.000Z",
    });
    expect(fetchCalls).toBe(0);

    const repositories = createRepositories(client);
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "locked",
      currentDay: 0,
    });
    expect(await repositories.getFantasyTeam("team-day-zero")).toMatchObject({
      lockedAt: "2026-05-08T02:00:00.000Z",
    });

    const secondResponse = await injectCron(app);

    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.json()).toMatchObject({
      status: "skipped",
      reason: "outside-basho-window",
      bashoId: "2026-05",
    });
    expect(fetchCalls).toBe(0);
  });

  it("does not lock picks before the day preceding day zero", async () => {
    await seedLiveBasho("2026-05", { status: "upcoming", currentDay: 0 });
    let fetchCalls = 0;
    app = createApp(async () => {
      fetchCalls += 1;
      return resultsResponse();
    }, new Date("2026-05-07T02:00:00.000Z"));

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "skipped",
      reason: "outside-basho-window",
      bashoId: "2026-05",
    });
    expect(fetchCalls).toBe(0);
    expect(await createRepositories(client).getBasho("2026-05")).toMatchObject({
      status: "upcoming",
    });
  });

  it("catches up an upcoming basho on day zero", async () => {
    await seedLiveBasho("2026-05", {
      status: "upcoming",
      currentDay: 0,
      withTeam: true,
    });
    let fetchCalls = 0;
    app = createApp(async () => {
      fetchCalls += 1;
      return resultsResponse();
    }, new Date("2026-05-09T02:00:00.000Z"));

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "locked",
      bashoId: "2026-05",
      day: 0,
      japanDate: "2026-05-09",
    });
    expect(fetchCalls).toBe(0);
    expect(await createRepositories(client).getBasho("2026-05")).toMatchObject({
      status: "locked",
    });
  });

  it("imports day one for a locked basho and advances it to active", async () => {
    await seedLiveBasho("2026-05", { status: "locked", currentDay: 0 });
    app = createApp(
      async (url) => resultsResponse(dayFromUrl(url)),
      new Date("2026-05-10T02:00:00.000Z"),
    );

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "imported",
      bashoId: "2026-05",
      day: 1,
    });
    expect(await createRepositories(client).getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 1,
    });
  });

  it("backfills every missed day for a locked basho", async () => {
    await seedLiveBasho("2026-05", { status: "locked", currentDay: 0 });
    const requestedDays: number[] = [];
    app = createApp(async (url) => {
      const day = Number(String(url).split("/").at(-1));
      if (Number.isFinite(day)) requestedDays.push(day);
      return resultsResponse(day);
    }, new Date("2026-05-12T02:00:00.000Z"));

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "imported",
      bashoId: "2026-05",
      day: 3,
      importedDays: [1, 2, 3],
    });
    expect(requestedDays).toEqual([1, 2, 3, 4]);

    const repositories = createRepositories(client);
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 3,
    });
    expect(await repositories.listBoutResultsForBasho("2026-05")).toHaveLength(
      3,
    );
  });

  it("backfills days missing from stored results", async () => {
    await seedLiveBasho("2026-05", {
      status: "active",
      currentDay: 3,
      importedDays: [1, 2, 3],
    });
    const requestedDays: number[] = [];
    app = createApp(async (url) => {
      const day = Number(String(url).split("/").at(-1));
      if (Number.isFinite(day)) requestedDays.push(day);
      return resultsResponse(day);
    }, new Date("2026-05-16T02:00:00.000Z"));

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "imported",
      bashoId: "2026-05",
      day: 7,
      importedDays: [4, 5, 6, 7],
    });
    expect(requestedDays).toEqual([4, 5, 6, 7, 8]);
    expect(await createRepositories(client).getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 7,
    });
  });

  it("backfills a confirmed card whose stored results cover only part of the day", async () => {
    await seedLiveBasho("2026-05", {
      status: "active",
      currentDay: 3,
      importedDays: [1, 2, 3],
    });
    const repositories = createRepositories(client);
    await repositories.upsertRikishi({
      id: "juryo-east",
      shikona: "Juryo East",
    });
    await repositories.upsertRikishi({
      id: "juryo-west",
      shikona: "Juryo West",
    });
    await repositories.applyScheduledBoutsImport({
      publication: {
        id: "2026-05-2-partial-coverage-schedule",
        bashoId: "2026-05",
        day: 2,
        source: "test-source:complete",
        publishedAt: "2026-05-23T09:00:00.000Z",
      },
      bouts: [
        {
          id: "2026-05-2-stored-bout",
          bashoId: "2026-05",
          day: 2,
          eastRikishiId: "onosato",
          westRikishiId: "kotozakura",
          status: "scheduled",
        },
        {
          id: "2026-05-2-missing-result-bout",
          bashoId: "2026-05",
          day: 2,
          eastRikishiId: "juryo-east",
          westRikishiId: "juryo-west",
          status: "scheduled",
        },
      ],
    });
    const requestedDays: number[] = [];
    app = createApp(async (url) => {
      const day = dayFromUrl(url);
      if (Number.isFinite(day)) requestedDays.push(day);
      return resultsResponse(day);
    });

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "imported",
      day: 3,
      importedDays: [2, 3],
    });
    expect(requestedDays).toEqual([2, 3, 4]);
  });

  it("does not treat banzuke currentDay as imported results progress", async () => {
    await seedLiveBasho("2026-05", { status: "active", currentDay: 3 });
    const requestedDays: number[] = [];
    app = createApp(async (url) => {
      const day = Number(String(url).split("/").at(-1));
      if (Number.isFinite(day)) requestedDays.push(day);
      return resultsResponse(day);
    }, new Date("2026-05-12T02:00:00.000Z"));

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "imported",
      day: 3,
      importedDays: [1, 2, 3],
    });
    expect(requestedDays).toEqual([1, 2, 3, 4]);
  });

  it("imports day one for an upcoming basho created by an early banzuke import", async () => {
    await seedLiveBasho("2026-05", {
      status: "upcoming",
      currentDay: 0,
      withTeam: true,
    });
    app = createApp(
      async (url) => resultsResponse(dayFromUrl(url)),
      new Date("2026-05-10T02:00:00.000Z"),
    );

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "imported",
      bashoId: "2026-05",
      day: 1,
    });
    expect(await createRepositories(client).getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 1,
    });
    expect(
      await createRepositories(client).getFantasyTeam("team-day-zero"),
    ).toMatchObject({ lockedAt: "2026-05-10T02:00:00.000Z" });
  });

  it("completes the basho atomically with its day 15 results", async () => {
    await seedLiveBasho("2026-05", {
      currentDay: 14,
      importedDays: Array.from({ length: 14 }, (_value, index) => index + 1),
    });
    await seedPublishedSchedule("2026-05", 15, "cancelled");
    const requestedDays: number[] = [];
    app = createApp(async (url) => {
      const day = dayFromUrl(url);
      if (Number.isFinite(day)) requestedDays.push(day);
      return resultsResponse(day);
    }, new Date("2026-05-24T02:00:00.000Z"));

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "imported",
      bashoId: "2026-05",
      day: 15,
      import: {
        summary: {
          basho: { updated: 1 },
          results: { created: 1 },
        },
      },
      schedule: {
        status: "not-applicable",
        reason: "final-basho-day",
      },
    });
    expect(await createRepositories(client).getBasho("2026-05")).toMatchObject({
      status: "complete",
      currentDay: 15,
    });
    expect(requestedDays).toEqual([15]);
    const repositories = createRepositories(client);
    expect(
      await repositories.listScheduledBoutPublicationsForBasho("2026-05"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          day: 15,
          source: "sumo-api-schedule:complete",
        }),
      ]),
    );
    expect(await repositories.listScheduledBoutsForBasho("2026-05")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ day: 15, status: "scheduled" }),
      ]),
    );
  });

  it("keeps an unconfirmed partial final-day card retryable", async () => {
    await seedLiveBasho("2026-05", {
      currentDay: 14,
      importedDays: Array.from({ length: 14 }, (_value, index) => index + 1),
    });
    app = createApp(
      async () =>
        jsonResponse({
          torikumi: [
            {
              bashoId: "202605",
              day: 15,
              matchNo: 1,
              eastId: 4227,
              eastShikona: "Onosato",
              westId: 3661,
              westShikona: "Kotozakura",
              winnerId: 4227,
              winnerEn: "Onosato",
            },
          ],
        }),
      new Date("2026-05-24T02:00:00.000Z"),
    );

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "imported", day: 15 });
    const repositories = createRepositories(client);
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 14,
    });
    expect(await repositories.listBoutResultsForBasho("2026-05")).toEqual(
      expect.arrayContaining([expect.objectContaining({ day: 15 })]),
    );
    expect(
      await repositories.listScheduledBoutPublicationsForBasho("2026-05"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ day: 15, source: "sumo-api-schedule" }),
      ]),
    );
  });

  it("retries a missing final day after the basho end date", async () => {
    await seedLiveBasho("2026-05", {
      currentDay: 14,
      importedDays: Array.from({ length: 14 }, (_value, index) => index + 1),
    });
    const requestedDays: number[] = [];
    app = createApp(async (url) => {
      const day = Number(String(url).split("/").at(-1));
      if (Number.isFinite(day)) requestedDays.push(day);
      return resultsResponse(day);
    }, new Date("2026-05-25T02:00:00.000Z"));

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "imported",
      day: 15,
      importedDays: [15],
    });
    expect(requestedDays).toEqual([15]);
    const repositories = createRepositories(client);
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "complete",
      currentDay: 15,
    });
    expect(
      await repositories.listScheduledBoutPublicationsForBasho("2026-05"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bashoId: "2026-05",
          day: 15,
          source: "sumo-api-schedule:complete",
        }),
      ]),
    );
  });

  it("skips cleanly when there is no eligible live basho", async () => {
    let fetchCalls = 0;
    app = createApp(async () => {
      fetchCalls += 1;
      return resultsResponse();
    });

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "skipped",
      reason: "no-active-basho",
      japanDate: "2026-05-12",
    });
    expect(fetchCalls).toBe(0);
  });

  it("does not treat the deterministic demo basho as a live import target", async () => {
    await seedLiveBasho(DEMO_BASHO_ID, { isDemo: true });
    app = createApp();

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "skipped",
      reason: "no-active-basho",
    });
  });

  it("reports source failures as unsuccessful cron responses", async () => {
    await seedLiveBasho("2026-05");
    app = createApp(async () => new Response(null, { status: 503 }));

    const response = await injectCron(app);

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      status: "failed",
      error: "scheduled-results-import-failed",
      message: "Import source request failed with 503.",
    });
    expect(
      await createRepositories(client).listBoutResultsForBasho("2026-05"),
    ).toEqual([]);
  });

  it("imports results without attesting the card when banzuke evidence fails", async () => {
    await seedLiveBasho("2026-05", { importedDays: [1, 2] });
    app = createApp(async (url) => {
      const sourceUrl = String(url);

      return sourceUrl.includes("/banzuke/")
        ? new Response(null, { status: 503 })
        : resultsResponse(dayFromUrl(url));
    });

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "imported",
      day: 3,
      importedDays: [3],
    });
    const repositories = createRepositories(client);
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 3,
    });
    expect(await repositories.listBoutResultsForBasho("2026-05")).toHaveLength(
      3,
    );
    expect(
      await repositories.listScheduledBoutPublicationsForBasho("2026-05"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ day: 3, source: "sumo-api-schedule" }),
      ]),
    );
  });

  it("reports partial success when the following-day schedule is unavailable", async () => {
    await seedLiveBasho("2026-05", { importedDays: [1, 2] });
    app = createApp(async (url) => {
      const day = dayFromUrl(url);
      if (!Number.isFinite(day)) return resultsResponse(day);
      return day === 3 ? resultsResponse(day) : jsonResponse({ torikumi: [] });
    });

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "partial",
      bashoId: "2026-05",
      day: 3,
      import: {
        summary: { results: { created: 1 } },
      },
      schedule: {
        status: "unavailable",
        day: 4,
        message:
          "Sumo API schedule for 2026-05 day 4 is not published or unavailable.",
      },
    });

    const repositories = createRepositories(client);
    expect(await repositories.listBoutResultsForBasho("2026-05")).toHaveLength(
      3,
    );
    expect(
      await repositories.listScheduledBoutPublicationsForBasho("2026-05"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ day: 1, source: "test-source:complete" }),
        expect.objectContaining({ day: 2, source: "test-source:complete" }),
        expect.objectContaining({
          day: 3,
          source: "sumo-api-schedule:complete",
        }),
      ]),
    );
  });

  it("reports a schedule-only source failure without losing imported results", async () => {
    await seedLiveBasho("2026-05", { importedDays: [1, 2] });
    app = createApp(async (url) => {
      const day = dayFromUrl(url);
      if (!Number.isFinite(day)) return resultsResponse(day);
      return day === 3
        ? resultsResponse(day)
        : new Response(null, { status: 503 });
    });

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "partial",
      import: {
        summary: { results: { created: 1 } },
      },
      schedule: {
        status: "failed",
        day: 4,
        message: "Import source request failed with 503.",
      },
    });
    expect(
      await createRepositories(client).listBoutResultsForBasho("2026-05"),
    ).toHaveLength(3);
  });

  it("fails safely when more than one live basho is marked active", async () => {
    await seedLiveBasho("2026-05");
    await seedLiveBasho("2026-05-conflict");
    app = createApp();

    const response = await injectCron(app);

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      status: "failed",
      error: "scheduled-results-import-failed",
    });
  });
});

function createApp(
  sourceFetch: typeof fetch = async (url) => resultsResponse(dayFromUrl(url)),
  now = NOW,
) {
  return buildApp({
    adminImportToken: "separate-admin-import-token",
    allowUnprotectedAdminImports: false,
    cronSecret: CRON_SECRET,
    db: client,
    now: () => now,
    sourceFetch,
  });
}

function injectCron(instance: FastifyInstance) {
  return instance.inject({
    headers: {
      authorization: `Bearer ${CRON_SECRET}`,
    },
    method: "GET",
    url: "/api/cron/import-results",
  });
}

async function seedLiveBasho(
  bashoId: string,
  options: {
    isDemo?: boolean;
    status?: "active" | "locked" | "upcoming";
    currentDay?: number;
    importedDays?: number[];
    withTeam?: boolean;
  } = {},
) {
  const repositories = createRepositories(client);

  await repositories.insertBasho({
    id: bashoId,
    isDemo: options.isDemo ?? false,
    name: "May 2026",
    startDate: "2026-05-10",
    endDate: "2026-05-24",
    status: options.status ?? "active",
    currentDay: options.currentDay ?? 2,
  });
  await repositories.upsertRikishi({
    id: "onosato",
    shikona: "Onosato",
    heya: "Nishonoseki",
  });
  await repositories.upsertRikishi({
    id: "kotozakura",
    shikona: "Kotozakura",
    heya: "Sadogatake",
  });
  for (const day of options.importedDays ?? []) {
    await repositories.applyScheduledBoutsImport({
      publication: {
        id: `${bashoId}-${day}-stored-schedule`,
        bashoId,
        day,
        source: "test-source:complete",
        publishedAt: "2026-05-23T09:00:00.000Z",
      },
      bouts: [
        {
          id: `${bashoId}-${day}-stored-bout`,
          bashoId,
          day,
          eastRikishiId: "onosato",
          westRikishiId: "kotozakura",
          status: "scheduled",
        },
      ],
    });
    await repositories.upsertBoutResult({
      id: `${bashoId}-${day}-stored-result`,
      bashoId,
      day,
      winnerRikishiId: "onosato",
      loserRikishiId: "kotozakura",
    });
  }
  await repositories.upsertBanzukeEntry({
    id: `${bashoId}-onosato`,
    bashoId,
    rikishiId: "onosato",
    rank: "Yokozuna",
    rankOrder: 1,
  });
  await repositories.upsertBanzukeEntry({
    id: `${bashoId}-kotozakura`,
    bashoId,
    rikishiId: "kotozakura",
    rank: "Ozeki",
    rankOrder: 2,
  });

  if (options.withTeam === true) {
    await repositories.insertFantasyTeamWithPicksIfBashoUpcoming(
      {
        id: "team-day-zero",
        bashoId,
        displayName: "Day Zero Team",
        createdAt: "2026-05-01T12:00:00.000Z",
      },
      [
        { teamId: "team-day-zero", rikishiId: "onosato" },
        { teamId: "team-day-zero", rikishiId: "kotozakura" },
      ],
    );
  }
}

async function seedPublishedSchedule(
  bashoId: string,
  day: number,
  status: "scheduled" | "cancelled" = "scheduled",
) {
  await createRepositories(client).applyScheduledBoutsImport({
    publication: {
      id: `${bashoId}-day-${day}-schedule`,
      bashoId,
      day,
      source: "test-source",
      publishedAt: "2026-05-23T09:00:00.000Z",
    },
    bouts: [
      {
        id: `${bashoId}-day-${day}-match-1`,
        bashoId,
        day,
        eastRikishiId: "onosato",
        westRikishiId: "kotozakura",
        status,
      },
    ],
  });
}

function resultsResponse(day = 3) {
  if (!Number.isFinite(day)) {
    return jsonResponse({
      east: [
        {
          rikishiID: 4227,
          shikonaEn: "Onosato",
          record: Array.from({ length: 15 }, () => ({ result: "win" })),
        },
      ],
      west: [
        {
          rikishiID: 3661,
          shikonaEn: "Kotozakura",
          record: Array.from({ length: 15 }, () => ({ result: "loss" })),
        },
      ],
    });
  }

  return jsonResponse({
    ...(day === 15 ? { yusho: [{ type: "Makuuchi" }] } : {}),
    torikumi: [
      {
        id: `202605-${day}-1-4227-3661`,
        bashoId: "202605",
        day,
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
  });
}

function dayFromUrl(url: string | URL | Request) {
  return Number(String(url).split("/").at(-1));
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
    },
  });
}
