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
    await seedLiveBasho("2026-05");
    let requestedUrl = "";
    app = createApp(async (url) => {
      requestedUrl = String(url);
      return resultsResponse();
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
    });
    expect(requestedUrl).toContain("/basho/202605/torikumi/Makuuchi/3");

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
    });

    const repositories = createRepositories(client);
    expect(await repositories.listBoutResultsForBasho("2026-05")).toHaveLength(
      1,
    );
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 3,
    });
  });

  it("imports day one for a locked basho and advances it to active", async () => {
    await seedLiveBasho("2026-05", { status: "locked", currentDay: 0 });
    app = createApp(
      async () => resultsResponse(1),
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

  it("imports day one for an upcoming basho created by an early banzuke import", async () => {
    await seedLiveBasho("2026-05", { status: "upcoming", currentDay: 0 });
    app = createApp(
      async () => resultsResponse(1),
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

  it("completes the basho atomically with its day 15 results", async () => {
    await seedLiveBasho("2026-05", { currentDay: 14 });
    app = createApp(
      async () => resultsResponse(15),
      new Date("2026-05-24T02:00:00.000Z"),
    );

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
    });
    expect(await createRepositories(client).getBasho("2026-05")).toMatchObject({
      status: "complete",
      currentDay: 15,
    });
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
    await seedLiveBasho(DEMO_BASHO_ID);
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
  sourceFetch: typeof fetch = async () => resultsResponse(),
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
    status?: "active" | "locked" | "upcoming";
    currentDay?: number;
  } = {},
) {
  const repositories = createRepositories(client);

  await repositories.insertBasho({
    id: bashoId,
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
}

function resultsResponse(day = 3) {
  return new Response(
    JSON.stringify({
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
    }),
    {
      headers: {
        "content-type": "application/json",
      },
    },
  );
}
