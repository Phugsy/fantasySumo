import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDatabaseClient,
  runMigrations,
  seedDatabase,
  type DatabaseClient,
} from "@fantasy-sumo/db";
import { buildApp } from "../app.js";

let app: FastifyInstance;
let client: DatabaseClient;
let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "fantasy-sumo-api-"));
  client = createDatabaseClient(`file:${join(tmpRoot, "test.sqlite")}`);
  runMigrations(client.db);
  seedDatabase(client.db);
  app = buildApp({
    db: client.db,
    now: () => new Date("2026-05-02T09:00:00.000Z"),
    teamIdFactory: () => "north",
  });
});

afterEach(async () => {
  await app.close();
  client.close();
  rmSync(tmpRoot, { force: true, recursive: true });
});

describe("basho routes", () => {
  it("returns the current basho", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/basho/current",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "2026-05",
      name: "May 2026 Sample Basho",
      status: "active",
    });
  });

  it("returns rikishi for a basho with banzuke ranks", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/rikishi",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.basho).toMatchObject({
      id: "2026-05",
    });
    expect(body.rikishi).toHaveLength(4);
    expect(body.rikishi[0]).toMatchObject({
      id: "onosato",
      shikona: "Onosato",
      rank: "Ozeki",
      rankOrder: 1,
    });
  });

  it("creates and retrieves a fantasy team", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: "North Side",
        ownerName: "New Player",
        rikishiIds: ["onosato", "kotozakura"],
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toEqual({
      team: {
        id: "team-north",
        bashoId: "2026-05",
        displayName: "North Side",
        ownerName: "New Player",
        createdAt: "2026-05-02T09:00:00.000Z",
      },
      picks: [
        {
          id: "team-north-kotozakura",
          teamId: "team-north",
          rikishiId: "kotozakura",
        },
        {
          id: "team-north-onosato",
          teamId: "team-north",
          rikishiId: "onosato",
        },
      ],
    });

    const getResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/teams/team-north",
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().team).toMatchObject({
      id: "team-north",
      displayName: "North Side",
    });
  });

  it("rejects invalid team picks", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: "Bad Team",
        rikishiIds: ["onosato", "onosato"],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "invalid-picks",
      details: [
        {
          code: "duplicate-pick",
          rikishiId: "onosato",
        },
      ],
    });
  });

  it("rejects malformed team creation requests", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: " ",
        rikishiIds: "onosato",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "invalid-request",
      message: "Team creation request is invalid.",
    });
  });

  it("rejects picks outside the requested basho", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: "Bad Team",
        rikishiIds: ["onosato", "unknown"],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "invalid-picks",
      details: [
        {
          code: "unknown-rikishi",
          rikishiId: "unknown",
        },
      ],
    });
  });

  it("returns a leaderboard ordered by score", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/leaderboard",
    });

    expect(response.statusCode).toBe(200);
    expect(
      response
        .json()
        .leaderboard.map(
          (entry: { displayName: string; score: number; rank: number }) => ({
            displayName: entry.displayName,
            score: entry.score,
            rank: entry.rank,
          }),
        ),
    ).toEqual([
      {
        displayName: "East Side",
        score: 2,
        rank: 1,
      },
      {
        displayName: "West Side",
        score: 1,
        rank: 2,
      },
    ]);
  });

  it("returns clear 404 errors for unknown basho and teams", async () => {
    const bashoResponse = await app.inject({
      method: "GET",
      url: "/api/basho/unknown/rikishi",
    });
    const teamResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/teams/unknown",
    });

    expect(bashoResponse.statusCode).toBe(404);
    expect(bashoResponse.json()).toMatchObject({
      error: "not-found",
      message: "Basho unknown was not found.",
    });
    expect(teamResponse.statusCode).toBe(404);
    expect(teamResponse.json()).toMatchObject({
      error: "not-found",
      message: "Team unknown was not found for basho 2026-05.",
    });
  });
});
