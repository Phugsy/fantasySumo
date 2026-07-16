import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRepositories,
  createDatabaseClient,
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
  tmpRoot = mkdtempSync(join(tmpdir(), "fantasy-sumo-api-"));
  client = createDatabaseClient(`file:${join(tmpRoot, "test.sqlite")}`);
  await runMigrations(client);
  await seedDatabase(createRepositories(client));
  app = buildApp({
    db: client,
    now: () => new Date("2026-05-02T09:00:00.000Z"),
    teamIdFactory: () => "north",
  });
});

afterEach(async () => {
  await app.close();
  await client.close();
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
      status: "upcoming",
      currentDay: 0,
      teamSize: 2,
    });
  });

  it("prefers a locked current basho over a later upcoming basho", async () => {
    const repositories = createRepositories(client);
    repositories.upsertBasho({
      ...sampleBasho,
      status: "locked",
      currentDay: 1,
    });
    repositories.insertBasho({
      id: "2026-07",
      name: "July 2026 Future Basho",
      startDate: "2026-07-12",
      endDate: "2026-07-26",
      status: "upcoming",
      currentDay: 0,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/basho/current",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "2026-05",
      status: "locked",
      currentDay: 1,
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

  it("rejects teams from the start of the day before the basho in Japan", async () => {
    await app.close();
    app = buildApp({
      db: client,
      now: () => new Date("2026-05-08T14:59:59.000Z"),
      teamIdFactory: () => "before-cutoff",
    });

    const beforeCutoff = await app.inject({
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: "Just In Time",
        rikishiIds: ["onosato", "kotozakura"],
      },
    });

    expect(beforeCutoff.statusCode).toBe(201);

    await app.close();
    app = buildApp({
      db: client,
      now: () => new Date("2026-05-08T15:00:00.000Z"),
      teamIdFactory: () => "at-cutoff",
    });

    const atCutoff = await app.inject({
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: "Too Late",
        rikishiIds: ["onosato", "kotozakura"],
      },
    });

    expect(atCutoff.statusCode).toBe(409);
    expect(atCutoff.json()).toMatchObject({
      error: "picks-locked",
      message: "Picks closed the day before this basho starts.",
      bashoStatus: "locked",
    });

    const currentResponse = await app.inject({
      method: "GET",
      url: "/api/basho/current",
    });

    expect(currentResponse.statusCode).toBe(200);
    expect(currentResponse.json()).toMatchObject({
      id: "2026-05",
      status: "locked",
    });

    const rikishiResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/rikishi",
    });

    expect(rikishiResponse.json().basho).toMatchObject({ status: "locked" });

    const leaderboardResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/leaderboard",
    });

    expect(leaderboardResponse.json().basho).toMatchObject({
      status: "locked",
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

  it.each([
    {
      status: "locked",
      expectedMessage: "Picks are locked for this basho.",
    },
    {
      status: "active",
      expectedMessage: "This basho has started, so picks are locked.",
    },
    {
      status: "complete",
      expectedMessage: "This basho is complete, so picks are closed.",
    },
  ] as const)(
    "rejects team creation when a basho is $status",
    async ({ status, expectedMessage }) => {
      createRepositories(client).upsertBasho({
        ...sampleBasho,
        status,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/basho/2026-05/teams",
        payload: {
          displayName: "Late Team",
          rikishiIds: ["onosato", "kotozakura"],
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: "picks-locked",
        message: expectedMessage,
        bashoStatus: status,
      });
    },
  );

  it("returns a leaderboard ordered by score", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/leaderboard",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      basho: {
        id: "2026-05",
        name: "May 2026 Sample Basho",
        status: "upcoming",
        currentDay: 0,
      },
      bashoId: "2026-05",
      totalDays: 15,
    });
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
