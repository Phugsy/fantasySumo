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

let app: FastifyInstance | undefined;
let client: DatabaseClient;
let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), "fantasy-sumo-pick-lock-"));
  client = createDatabaseClient(`file:${join(tmpRoot, "test.sqlite")}`);
  await runMigrations(client);
});

afterEach(async () => {
  await app?.close();
  await client.close();
  rmSync(tmpRoot, { force: true, recursive: true });
});

describe("scheduled pick lock route", () => {
  it("requires the configured Vercel cron bearer token", async () => {
    app = createApp(new Date("2026-05-08T15:00:00.000Z"));

    const response = await app.inject({
      method: "GET",
      url: "/api/cron/lock-picks",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: "scheduled-pick-lock-unauthorized",
    });
  });

  it("skips before the Japan-calendar lock date", async () => {
    await seedBasho("2026-05");
    app = createApp(new Date("2026-05-08T14:59:59.000Z"));

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "skipped",
      reason: "no-basho-due",
      japanDate: "2026-05-08",
    });
    expect(await createRepositories(client).getBasho("2026-05")).toMatchObject({
      status: "upcoming",
    });
  });

  it("locks the basho and existing teams at the start of the day before", async () => {
    await seedBasho("2026-05", true);
    const now = new Date("2026-05-08T15:00:00.000Z");
    app = createApp(now);

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "locked",
      bashoId: "2026-05",
      japanDate: "2026-05-09",
      lockedAt: now.toISOString(),
    });

    const repositories = createRepositories(client);
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "locked",
    });
    expect(await repositories.getFantasyTeam("team-2026-05")).toMatchObject({
      lockedAt: now.toISOString(),
    });

    const rerun = await injectCron(app);

    expect(rerun.statusCode).toBe(200);
    expect(rerun.json()).toMatchObject({
      status: "skipped",
      reason: "no-basho-due",
    });
  });

  it("catches up a still-upcoming basho on day one", async () => {
    await seedBasho("2026-05");
    app = createApp(new Date("2026-05-10T00:00:00.000Z"));

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "locked",
      bashoId: "2026-05",
      japanDate: "2026-05-10",
    });
  });

  it("does not lock deterministic demo data", async () => {
    await seedBasho(DEMO_BASHO_ID);
    app = createApp(new Date("2026-05-08T15:00:00.000Z"));

    const response = await injectCron(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "skipped",
      reason: "no-basho-due",
    });
    expect(
      await createRepositories(client).getBasho(DEMO_BASHO_ID),
    ).toMatchObject({ status: "upcoming" });
  });

  it("fails safely when more than one upcoming basho is due", async () => {
    await seedBasho("2026-05");
    await seedBasho("2026-05-conflict");
    app = createApp(new Date("2026-05-08T15:00:00.000Z"));

    const response = await injectCron(app);

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      status: "failed",
      error: "scheduled-pick-lock-failed",
    });
    expect(await createRepositories(client).getBasho("2026-05")).toMatchObject({
      status: "upcoming",
    });
  });
});

function createApp(now: Date) {
  return buildApp({
    cronSecret: CRON_SECRET,
    db: client,
    now: () => now,
  });
}

function injectCron(instance: FastifyInstance) {
  return instance.inject({
    headers: { authorization: `Bearer ${CRON_SECRET}` },
    method: "GET",
    url: "/api/cron/lock-picks",
  });
}

async function seedBasho(bashoId: string, withTeam = false) {
  const repositories = createRepositories(client);

  await repositories.insertBasho({
    id: bashoId,
    name: "May 2026",
    startDate: "2026-05-10",
    endDate: "2026-05-24",
    status: "upcoming",
    currentDay: 0,
  });

  if (withTeam) {
    await repositories.insertFantasyTeam({
      id: `team-${bashoId}`,
      bashoId,
      displayName: "Existing Team",
      createdAt: "2026-05-01T00:00:00.000Z",
    });
  }
}
