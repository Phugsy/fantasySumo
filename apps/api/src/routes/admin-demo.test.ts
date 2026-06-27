import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_FINAL_DAY,
  createDatabaseClient,
  runMigrations,
  type DatabaseClient,
} from "@fantasy-sumo/db";
import { buildApp } from "../app.js";

let app: FastifyInstance;
let client: DatabaseClient;
let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "fantasy-sumo-admin-demo-"));
  client = createDatabaseClient(`file:${join(tmpRoot, "test.sqlite")}`);
  runMigrations(client.db);
  app = buildApp({
    db: client.db,
    now: () => new Date("2026-05-10T00:00:00.000Z"),
  });
});

afterEach(async () => {
  await app.close();
  client.close();
  rmSync(tmpRoot, { force: true, recursive: true });
});

describe("admin demo routes", () => {
  it("resets, starts, advances, and completes demo progression", async () => {
    const resetResponse = await app.inject({
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
});
