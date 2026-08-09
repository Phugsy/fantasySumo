import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEMO_FINAL_DAY,
  createDatabaseClient,
  createRepositories,
  runMigrations,
  seedDatabase,
  sampleBasho,
  type DatabaseClient,
} from "@fantasy-sumo/db";
import { buildApp } from "../app.js";

let app: FastifyInstance;
let client: DatabaseClient;
let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), "fantasy-sumo-admin-demo-"));
  client = createDatabaseClient(`file:${join(tmpRoot, "test.sqlite")}`);
  await runMigrations(client);
  app = buildApp({
    db: client,
    demoAdminToken: "test-demo-token",
    now: () => new Date("2026-05-10T00:00:00.000Z"),
  });
});

afterEach(async () => {
  await app.close();
  await client.close();
  rmSync(tmpRoot, { force: true, recursive: true });
});

describe("admin demo routes", () => {
  it("rejects demo progression requests with missing or invalid tokens", async () => {
    const missingTokenResponse = await app.inject({
      method: "POST",
      url: "/api/admin/demo/reset",
    });

    expect(missingTokenResponse.statusCode).toBe(403);
    expect(missingTokenResponse.json()).toMatchObject({
      error: "admin-forbidden",
    });

    const invalidTokenResponse = await app.inject({
      headers: {
        "x-demo-admin-token": "wrong-token",
      },
      method: "POST",
      url: "/api/admin/demo/reset",
    });

    expect(invalidTokenResponse.statusCode).toBe(403);
    expect(invalidTokenResponse.json()).toMatchObject({
      error: "admin-forbidden",
    });
  });

  it("forbids demo progression when no admin access is configured", async () => {
    vi.stubEnv("DEMO_ADMIN_TOKEN", "");
    const disabledApp = buildApp({
      db: client,
      now: () => new Date("2026-05-10T00:00:00.000Z"),
    });

    try {
      const response = await disabledApp.inject({
        method: "POST",
        url: "/api/admin/demo/reset",
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        error: "admin-forbidden",
      });
    } finally {
      await disabledApp.close();
      vi.unstubAllEnvs();
    }
  });

  it("resets, starts, advances, and completes demo progression", async () => {
    const resetResponse = await app.inject({
      headers: demoAdminHeaders,
      method: "POST",
      url: "/api/admin/demo/reset",
    });

    expect(resetResponse.statusCode).toBe(200);
    expect(resetResponse.json()).toMatchObject({
      action: "reset",
      appliedResults: 0,
      basho: {
        status: "upcoming",
        currentDay: 0,
      },
    });

    const startResponse = await app.inject({
      headers: demoAdminHeaders,
      method: "POST",
      url: "/api/admin/demo/start",
    });

    expect(startResponse.statusCode).toBe(200);
    expect(startResponse.json()).toMatchObject({
      action: "start",
      appliedResults: 0,
      basho: {
        status: "active",
        currentDay: 0,
      },
    });

    const advanceResponse = await app.inject({
      headers: demoAdminHeaders,
      method: "POST",
      url: "/api/admin/demo/advance-day",
    });

    expect(advanceResponse.statusCode).toBe(200);
    const advanceBody = advanceResponse.json();
    expect(advanceBody).toMatchObject({
      action: "advance-day",
      appliedResults: 4,
      basho: {
        status: "active",
        currentDay: 1,
      },
    });
    expect(advanceBody.leaderboard).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayName: "Dohyo Dreamers",
          score: 1,
        }),
      ]),
    );

    const completeResponse = await app.inject({
      headers: demoAdminHeaders,
      method: "POST",
      url: "/api/admin/demo/complete",
    });

    expect(completeResponse.statusCode).toBe(200);
    const completeBody = completeResponse.json();
    expect(completeBody).toMatchObject({
      action: "complete",
      appliedResults: 60,
      basho: {
        status: "complete",
        currentDay: DEMO_FINAL_DAY,
      },
    });
    expect(completeBody.leaderboard).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayName: "Yusho Hunters",
          score: 22,
        }),
      ]),
    );
  });

  it("preserves live basho data when the demo reset endpoint runs", async () => {
    const repositories = createRepositories(client);
    await seedDatabase(repositories);

    const response = await app.inject({
      headers: demoAdminHeaders,
      method: "POST",
      url: "/api/admin/demo/reset",
    });

    expect(response.statusCode).toBe(200);
    expect(await repositories.getBasho(sampleBasho.id)).toEqual(sampleBasho);
    expect(
      await repositories.listFantasyTeamsForBasho(sampleBasho.id),
    ).not.toHaveLength(0);
    expect(
      await repositories.listFantasyPicksForBasho(sampleBasho.id),
    ).not.toHaveLength(0);
    expect(
      await repositories.listBoutResultsForBasho(sampleBasho.id),
    ).not.toHaveLength(0);
  });
});

const demoAdminHeaders = {
  "x-demo-admin-token": "test-demo-token",
};
