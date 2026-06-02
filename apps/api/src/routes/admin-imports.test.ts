import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDatabaseClient,
  runMigrations,
  type DatabaseClient,
} from "@fantasy-sumo/db";
import { buildApp } from "../app.js";

let app: FastifyInstance;
let client: DatabaseClient;
let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "fantasy-sumo-admin-imports-"));
  client = createDatabaseClient(`file:${join(tmpRoot, "test.sqlite")}`);
  runMigrations(client.db);
  app = buildApp({
    db: client.db,
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

      return jsonResponse({
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
      });
    },
  });
});

afterEach(async () => {
  await app.close();
  client.close();
  rmSync(tmpRoot, { force: true, recursive: true });
});

describe("admin import routes", () => {
  it("dry-runs and applies source-backed banzuke imports", async () => {
    const dryRunResponse = await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke?dryRun=true",
      payload: {},
    });

    expect(dryRunResponse.statusCode).toBe(200);
    expect(dryRunResponse.json()).toMatchObject({
      dryRun: true,
      source: "jsa-banzuke",
      summary: {
        basho: { created: 1 },
        rikishi: { created: 2 },
      },
    });

    const applyResponse = await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke",
      payload: {},
    });

    expect(applyResponse.statusCode).toBe(200);

    const rikishiResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/rikishi",
    });

    expect(rikishiResponse.statusCode).toBe(200);
    expect(rikishiResponse.json().rikishi).toHaveLength(2);
  });

  it("imports source-backed daily results", async () => {
    await app.inject({
      method: "POST",
      url: "/api/admin/import-banzuke",
      payload: {},
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
      source: "sumo-api-results",
      summary: {
        results: { created: 1 },
      },
    });

    const leaderboardResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/leaderboard",
    });
    expect(leaderboardResponse.statusCode).toBe(200);
  });
});

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
    },
  });
}
