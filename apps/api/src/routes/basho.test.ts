import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRepositories,
  createDatabaseClient,
  demoBasho,
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
    await repositories.upsertBasho({
      ...sampleBasho,
      status: "locked",
      currentDay: 1,
    });
    await repositories.insertBasho({
      id: "2026-07",
      isDemo: false,
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

  it("prefers a live basho over an active demo basho", async () => {
    const repositories = createRepositories(client);
    await repositories.insertBasho({
      ...demoBasho,
      status: "active",
      currentDay: 3,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/basho/current",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: sampleBasho.id,
      isDemo: false,
    });
  });

  it("returns the flagged demo basho only when demo mode is explicit", async () => {
    const repositories = createRepositories(client);
    await repositories.insertBasho({
      ...demoBasho,
      status: "active",
      currentDay: 3,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/basho/current?mode=demo",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: demoBasho.id,
      isDemo: true,
      status: "active",
      currentDay: 3,
    });
  });

  it("does not treat a live fixed-ID collision as the demo basho", async () => {
    const repositories = createRepositories(client);
    await repositories.insertBasho({
      ...demoBasho,
      isDemo: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/basho/current?mode=demo",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: "not-found",
      message: "The demo basho is not available.",
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
      tournamentNotes: { statuses: [], achievements: [] },
    });
  });

  it("exposes source-reported status and derived achievements without changing scores", async () => {
    const headers = await signIn();
    const repositories = createRepositories(client);
    await app.inject({
      headers,
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: "Status Watchers",
        rikishiIds: ["onosato", "kotozakura"],
      },
    });

    for (let day = 2; day <= 8; day += 1) {
      await repositories.insertBoutResult({
        id: `2026-05-day-${day}-status-test`,
        bashoId: "2026-05",
        day,
        winnerRikishiId: "onosato",
        loserRikishiId: "hoshoryu",
      });
      if (day > 2) {
        await repositories.applyScheduledBoutsImport({
          publication: {
            id: `2026-05-day-${day}-status-test`,
            bashoId: "2026-05",
            day,
            source: "test-source:complete",
            publishedAt: "2026-05-18T08:00:00.000Z",
          },
          bouts: [
            {
              id: `2026-05-day-${day}-status-test`,
              bashoId: "2026-05",
              day,
              eastRikishiId: "onosato",
              westRikishiId: "hoshoryu",
              status: "scheduled",
            },
          ],
        });
      }
    }

    await repositories.applyScheduledBoutsImport({
      publication: {
        id: "2026-05-day-9-status-test",
        bashoId: "2026-05",
        day: 9,
        source: "test-source",
        publishedAt: "2026-05-18T08:00:00.000Z",
      },
      bouts: [
        {
          id: "2026-05-day-9-status-match",
          bashoId: "2026-05",
          day: 9,
          eastRikishiId: "kotozakura",
          westRikishiId: "kirishima",
          status: "cancelled",
          withdrawnRikishiId: "kotozakura",
        },
      ],
    });
    await repositories.updateBasho({
      ...sampleBasho,
      status: "active",
      currentDay: 8,
    });
    await verifyStoredResultDays(repositories, 8);

    const rikishiResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/rikishi",
    });
    const myTeamResponse = await app.inject({
      headers,
      method: "GET",
      url: "/api/basho/2026-05/my-team",
    });

    expect(rikishiResponse.statusCode).toBe(200);
    expect(
      rikishiResponse
        .json()
        .rikishi.find((entry: { id: string }) => entry.id === "onosato"),
    ).toMatchObject({
      tournamentNotes: {
        statuses: [],
        achievements: [{ type: "kachi-koshi", day: 8, provenance: "derived" }],
      },
    });
    expect(
      rikishiResponse
        .json()
        .rikishi.find((entry: { id: string }) => entry.id === "kotozakura"),
    ).toMatchObject({
      tournamentNotes: {
        statuses: [
          { type: "withdrawn", effectiveDay: 9, provenance: "source" },
        ],
        achievements: [],
      },
    });
    expect(myTeamResponse.statusCode).toBe(200);
    expect(myTeamResponse.json().totalScore).toBe(9);
    expect(myTeamResponse.json().picks).toEqual([
      expect.objectContaining({
        rikishiId: "onosato",
        score: 8,
        tournamentNotes: expect.objectContaining({
          achievements: [
            { type: "kachi-koshi", day: 8, provenance: "derived" },
          ],
        }),
      }),
      expect.objectContaining({
        rikishiId: "kotozakura",
        score: 1,
        tournamentNotes: expect.objectContaining({
          statuses: [
            { type: "withdrawn", effectiveDay: 9, provenance: "source" },
          ],
        }),
      }),
    ]);

    await repositories.updateBasho({
      ...sampleBasho,
      status: "complete",
      currentDay: 8,
    });
    const earlyClosedRikishiResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/rikishi",
    });

    expect(
      earlyClosedRikishiResponse
        .json()
        .rikishi.find((entry: { id: string }) => entry.id === "kotozakura")
        .tournamentNotes.achievements,
    ).toEqual([]);

    await repositories.upsertBasho({
      ...sampleBasho,
      status: "complete",
      currentDay: 15,
    });
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "complete",
      currentDay: 15,
    });
    const missingFinalResultsResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/rikishi",
    });

    expect(
      missingFinalResultsResponse
        .json()
        .rikishi.find((entry: { id: string }) => entry.id === "kotozakura")
        .tournamentNotes.achievements,
    ).toEqual([]);

    await repositories.upsertRikishi({
      id: "juryo-visitor",
      shikona: "Juryo Visitor",
    });
    await repositories.applyScheduledBoutsImport({
      publication: {
        id: "2026-05-day-15-status-test",
        bashoId: "2026-05",
        day: 15,
        source: "test-source:complete",
        publishedAt: "2026-05-24T08:00:00.000Z",
      },
      bouts: [
        {
          id: "2026-05-day-15-status-match-1",
          bashoId: "2026-05",
          day: 15,
          eastRikishiId: "onosato",
          westRikishiId: "hoshoryu",
          status: "scheduled",
        },
        {
          id: "2026-05-day-15-status-match-2",
          bashoId: "2026-05",
          day: 15,
          eastRikishiId: "kirishima",
          westRikishiId: "juryo-visitor",
          status: "scheduled",
        },
      ],
    });
    await repositories.insertBoutResult({
      id: "2026-05-day-15-final-status-test-1",
      bashoId: "2026-05",
      day: 15,
      winnerRikishiId: "onosato",
      loserRikishiId: "hoshoryu",
    });
    const partialFinalResultsResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/rikishi",
    });

    expect(
      partialFinalResultsResponse
        .json()
        .rikishi.find((entry: { id: string }) => entry.id === "kotozakura")
        .tournamentNotes.achievements,
    ).toEqual([]);

    for (let day = 9; day <= 14; day += 1) {
      await repositories.insertBoutResult({
        id: `2026-05-day-${day}-other-status-test`,
        bashoId: "2026-05",
        day,
        winnerRikishiId: "hoshoryu",
        loserRikishiId: "kirishima",
      });
    }

    const earlierResults = (
      await repositories.listBoutResultsForBasho("2026-05")
    ).filter((result) => result.day <= 14);
    const withdrawal = (
      await repositories.listScheduledBoutsForBasho("2026-05")
    ).find((bout) => bout.status === "cancelled");
    for (let day = 1; day <= 14; day += 1) {
      const scheduledResults = earlierResults
        .filter((result) => result.day === day)
        .map((result) => ({
          id: `${result.id}-schedule`,
          bashoId: result.bashoId,
          day: result.day,
          eastRikishiId: result.winnerRikishiId,
          westRikishiId: result.loserRikishiId,
          status: "scheduled" as const,
        }));
      await repositories.applyScheduledBoutsImport({
        publication: {
          id: `2026-05-day-${day}-complete-status-test`,
          bashoId: "2026-05",
          day,
          source: "test-source:complete",
          publishedAt: "2026-05-24T08:00:00.000Z",
        },
        bouts: [
          ...scheduledResults,
          ...(day === 9 && withdrawal !== undefined ? [withdrawal] : []),
        ],
      });
    }

    await repositories.insertBoutResult({
      id: "2026-05-day-15-final-status-test-2",
      bashoId: "2026-05",
      day: 15,
      winnerRikishiId: "kirishima",
      loserRikishiId: "juryo-visitor",
    });
    const completedRikishiResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/rikishi",
    });

    expect(completedRikishiResponse.statusCode).toBe(200);
    expect(
      completedRikishiResponse
        .json()
        .rikishi.find((entry: { id: string }) => entry.id === "kotozakura"),
    ).toMatchObject({
      tournamentNotes: {
        statuses: [
          { type: "withdrawn", effectiveDay: 9, provenance: "source" },
        ],
        achievements: [{ type: "make-koshi", day: 9, provenance: "derived" }],
      },
    });
  });

  it("creates and retrieves a fantasy team", async () => {
    const headers = await signIn();
    const createResponse = await app.inject({
      headers,
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: "North Side",
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
        ownerUserId: expect.stringMatching(/^local-/),
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
      headers,
      method: "GET",
      url: "/api/basho/2026-05/teams/team-north",
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().team).toMatchObject({
      id: "team-north",
      displayName: "North Side",
    });
  });

  it("uses the stored upcoming status rather than the current date", async () => {
    await app.close();
    app = buildApp({
      db: client,
      now: () => new Date("2026-05-25T12:00:00.000Z"),
      teamIdFactory: () => "status-only",
    });
    const headers = await signIn();

    const response = await app.inject({
      headers,
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: "Status Controlled",
        rikishiIds: ["onosato", "kotozakura"],
      },
    });

    expect(response.statusCode).toBe(201);

    const currentResponse = await app.inject({
      method: "GET",
      url: "/api/basho/current",
    });

    expect(currentResponse.statusCode).toBe(200);
    expect(currentResponse.json()).toMatchObject({
      id: "2026-05",
      status: "upcoming",
    });

    const rikishiResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/rikishi",
    });

    expect(rikishiResponse.json().basho).toMatchObject({ status: "upcoming" });

    const leaderboardResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/leaderboard",
    });

    expect(leaderboardResponse.json().basho).toMatchObject({
      status: "upcoming",
    });
  });

  it("requires a signed-in user before creating a fantasy team", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: "North Side",
        rikishiIds: ["onosato", "kotozakura"],
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: "unauthenticated",
    });
  });

  it("requires a signed-in user before updating a fantasy team", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/basho/2026-05/my-team",
      payload: {
        displayName: "North Side Updated",
        rikishiIds: ["hoshoryu", "kirishima"],
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: "unauthenticated",
    });
  });

  it("updates the signed-in user's existing fantasy team", async () => {
    const headers = await signIn();

    const firstResponse = await app.inject({
      headers,
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: "North Side",
        rikishiIds: ["onosato", "kotozakura"],
      },
    });
    const updateResponse = await app.inject({
      headers,
      method: "PUT",
      url: "/api/basho/2026-05/my-team",
      payload: {
        displayName: "North Side Updated",
        rikishiIds: ["hoshoryu", "kirishima"],
      },
    });

    expect(firstResponse.statusCode).toBe(201);
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().team).toMatchObject({
      id: "team-north",
      displayName: "North Side Updated",
    });
    expect(updateResponse.json().picks).toEqual([
      {
        id: "team-north-hoshoryu",
        teamId: "team-north",
        rikishiId: "hoshoryu",
      },
      {
        id: "team-north-kirishima",
        teamId: "team-north",
        rikishiId: "kirishima",
      },
    ]);
  });

  it("does not let another signed-in user update the owner's team", async () => {
    const ownerHeaders = await signIn();
    const otherUserHeaders = await signIn(
      "other.player@example.com",
      "Other Player",
    );

    await app.inject({
      headers: ownerHeaders,
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: "Owner Stable",
        rikishiIds: ["onosato", "kotozakura"],
      },
    });

    const response = await app.inject({
      headers: otherUserHeaders,
      method: "PUT",
      url: "/api/basho/2026-05/my-team",
      payload: {
        displayName: "Taken Over",
        rikishiIds: ["hoshoryu", "kirishima"],
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not-found" });

    const ownerResponse = await app.inject({
      headers: ownerHeaders,
      method: "GET",
      url: "/api/basho/2026-05/my-team",
    });

    expect(ownerResponse.json().team).toMatchObject({
      displayName: "Owner Stable",
    });
    expect(ownerResponse.json().picks).toEqual([
      expect.objectContaining({ rikishiId: "onosato" }),
      expect.objectContaining({ rikishiId: "kotozakura" }),
    ]);
  });

  it("returns the signed-in user's team for a basho", async () => {
    const headers = await signIn();

    await app.inject({
      headers,
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: "North Side",
        rikishiIds: ["onosato", "kotozakura"],
      },
    });

    const upcomingResponse = await app.inject({
      headers,
      method: "GET",
      url: "/api/basho/2026-05/my-team",
    });

    expect(upcomingResponse.statusCode).toBe(200);
    expect(upcomingResponse.json().totalScore).toBe(0);
    expect(upcomingResponse.json().picks).toEqual([
      expect.objectContaining({ rikishiId: "onosato", wins: 0, score: 0 }),
      expect.objectContaining({
        rikishiId: "kotozakura",
        wins: 0,
        score: 0,
      }),
    ]);

    await createRepositories(client).upsertBasho({
      ...sampleBasho,
      status: "active",
      currentDay: 1,
    });
    await verifyStoredResultDays(createRepositories(client), 1);

    const response = await app.inject({
      headers,
      method: "GET",
      url: "/api/basho/2026-05/my-team",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().basho).toMatchObject({
      id: "2026-05",
      status: "active",
      currentDay: 1,
    });
    expect(response.json().team).toMatchObject({
      id: "team-north",
      ownerUserId: expect.stringMatching(/^local-/),
    });
    expect(response.json().totalScore).toBe(2);
    expect(response.json().picks).toEqual([
      expect.objectContaining({
        rikishiId: "onosato",
        shikona: "Onosato",
        heya: "Nishonoseki",
        rank: "Ozeki",
        rankOrder: 1,
        wins: 1,
        score: 1,
      }),
      expect.objectContaining({
        rikishiId: "kotozakura",
        shikona: "Kotozakura",
        heya: "Sadogatake",
        rank: "Ozeki",
        rankOrder: 2,
        wins: 1,
        score: 1,
      }),
    ]);
  });

  it("requires a signed-in user before returning a private team", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/my-team",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: "unauthenticated",
    });
  });

  it("rejects invalid team picks", async () => {
    const headers = await signIn();
    const response = await app.inject({
      headers,
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

  it("returns the authoritative team size when a stale client submits the old pick count", async () => {
    await app.close();
    app = buildApp({
      db: client,
      now: () => new Date("2026-05-02T09:00:00.000Z"),
      teamIdFactory: () => "north",
      teamSize: 3,
    });
    const headers = await signIn();

    const response = await app.inject({
      headers,
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: "Stale Stable",
        rikishiIds: ["onosato", "kotozakura"],
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: "team-size-changed",
      message: "Team size changed to 3. Review your picks and try again.",
      teamSize: 3,
    });
  });

  it("rejects invalid picks when updating a fantasy team", async () => {
    const headers = await signIn();

    await app.inject({
      headers,
      method: "POST",
      url: "/api/basho/2026-05/teams",
      payload: {
        displayName: "North Side",
        rikishiIds: ["onosato", "kotozakura"],
      },
    });

    const response = await app.inject({
      headers,
      method: "PUT",
      url: "/api/basho/2026-05/my-team",
      payload: {
        displayName: "Bad Update",
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
    const headers = await signIn();
    const response = await app.inject({
      headers,
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
    const headers = await signIn();
    const response = await app.inject({
      headers,
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
      const headers = await signIn();
      await createRepositories(client).upsertBasho({
        ...sampleBasho,
        status,
      });

      const response = await app.inject({
        headers,
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
    "rejects team updates when a basho is $status",
    async ({ status, expectedMessage }) => {
      const headers = await signIn();

      await app.inject({
        headers,
        method: "POST",
        url: "/api/basho/2026-05/teams",
        payload: {
          displayName: "Original Team",
          rikishiIds: ["onosato", "kotozakura"],
        },
      });
      await createRepositories(client).upsertBasho({
        ...sampleBasho,
        status,
      });

      const response = await app.inject({
        headers,
        method: "PUT",
        url: "/api/basho/2026-05/my-team",
        payload: {
          displayName: "Late Update",
          rikishiIds: ["hoshoryu", "kirishima"],
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

  it.each([
    { method: "POST", url: "/api/basho/2026-05/teams" },
    { method: "PUT", url: "/api/basho/2026-05/my-team" },
  ] as const)(
    "reports a team-level lock through $method while the basho remains upcoming",
    async ({ method, url }) => {
      const headers = await signIn();
      const repositories = createRepositories(client);

      await app.inject({
        headers,
        method: "POST",
        url: "/api/basho/2026-05/teams",
        payload: {
          displayName: "Original Team",
          rikishiIds: ["onosato", "kotozakura"],
        },
      });
      await repositories.lockFantasyTeamsForBasho(
        sampleBasho.id,
        "2026-05-08T02:00:00.000Z",
      );

      expect((await repositories.getBasho(sampleBasho.id))?.status).toBe(
        "upcoming",
      );

      const response = await app.inject({
        headers,
        method,
        url,
        payload: {
          displayName: "Late Update",
          rikishiIds: ["hoshoryu", "kirishima"],
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: "picks-locked",
        bashoStatus: "upcoming",
        teamLockedAt: "2026-05-08T02:00:00.000Z",
      });
    },
  );

  it("keeps pick identities private on an upcoming leaderboard", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/leaderboard",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().basho.status).toBe("upcoming");
    expect(response.json().leaderboard).not.toHaveLength(0);
    expect(
      response
        .json()
        .leaderboard.every(
          (entry: {
            rikishiScores: unknown[];
            scoreHistory: Array<{ rikishiScores: unknown[] }>;
          }) =>
            entry.rikishiScores.length === 0 &&
            entry.scoreHistory.every(
              (history) => history.rikishiScores.length === 0,
            ),
        ),
    ).toBe(true);
    expect(JSON.stringify(response.json().leaderboard)).not.toContain(
      "rikishiId",
    );
  });

  it("returns no published future schedule without inventing matchups", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/schedule",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      bashoId: "2026-05",
      publishedDays: [],
      bouts: [],
    });
  });

  it("returns ranked future scheduled bouts and withdrawal context", async () => {
    const repositories = createRepositories(client);
    await repositories.applyScheduledBoutsImport({
      publication: {
        id: "2026-05-day-2-schedule",
        bashoId: "2026-05",
        day: 2,
        source: "test",
        publishedAt: "2026-05-11T08:00:00.000Z",
      },
      bouts: [
        {
          id: "2026-05-day-2-match-1",
          bashoId: "2026-05",
          day: 2,
          eastRikishiId: "onosato",
          westRikishiId: "kotozakura",
          status: "cancelled",
          withdrawnRikishiId: "kotozakura",
        },
      ],
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/schedule",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      publishedDays: [2],
      bouts: [
        {
          day: 2,
          status: "cancelled",
          withdrawnRikishiId: "kotozakura",
          east: { id: "onosato", shikona: "Onosato", rank: "Ozeki" },
          west: {
            id: "kotozakura",
            shikona: "Kotozakura",
            rank: "Ozeki",
          },
        },
      ],
    });

    await repositories.insertBoutResult({
      id: "2026-05-day-2-match-1",
      bashoId: "2026-05",
      day: 2,
      winnerRikishiId: "onosato",
      loserRikishiId: "kotozakura",
    });
    const scoredResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/schedule",
    });

    expect(scoredResponse.statusCode).toBe(200);
    expect(scoredResponse.json()).toMatchObject({
      publishedDays: [2],
      bouts: [],
    });
  });

  it("returns a leaderboard ordered by score after picks lock", async () => {
    const repositories = createRepositories(client);
    await repositories.updateBasho({
      ...sampleBasho,
      status: "active",
      currentDay: 2,
    });
    await verifyStoredResultDays(repositories, 2);
    const response = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/leaderboard",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      basho: {
        id: "2026-05",
        name: "May 2026 Sample Basho",
        status: "active",
        currentDay: 2,
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
    expect(response.json().leaderboard[0]).toMatchObject({
      latestDayScore: {
        day: 2,
        score: 1,
      },
      scoreHistory: [
        {
          day: 1,
          dailyScore: 1,
          cumulativeScore: 1,
          rikishiScores: [
            { rikishiId: "kirishima", outcome: "loss", score: 0 },
            { rikishiId: "onosato", outcome: "win", score: 1 },
          ],
        },
        {
          day: 2,
          dailyScore: 1,
          cumulativeScore: 2,
          rikishiScores: [
            { rikishiId: "kirishima", outcome: "win", score: 1 },
            { rikishiId: "onosato", outcome: "no-result", score: 0 },
          ],
        },
      ],
    });

    await repositories.insertBoutResult({
      id: "2026-05-day-15-pending-leaderboard-result",
      bashoId: "2026-05",
      day: 15,
      winnerRikishiId: "onosato",
      loserRikishiId: "kotozakura",
    });
    const pendingFinalDayResponse = await app.inject({
      method: "GET",
      url: "/api/basho/2026-05/leaderboard",
    });

    expect(pendingFinalDayResponse.statusCode).toBe(200);
    expect(pendingFinalDayResponse.json().leaderboard).toEqual(
      response.json().leaderboard,
    );
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

  it("aggregates cross-tournament scores and preserves personal pick history", async () => {
    const repositories = createRepositories(client);
    const { cookie } = await signIn("history@example.com", "History Player");
    const createdTeamResponse = await app.inject({
      method: "POST",
      url: "/api/basho/2026-05/teams",
      headers: { cookie },
      payload: {
        displayName: "History Stable",
        rikishiIds: ["onosato", "kotozakura"],
      },
    });
    const ownerUserId = createdTeamResponse.json().team.ownerUserId as string;

    expect(createdTeamResponse.statusCode).toBe(201);
    await repositories.updateBasho({
      ...sampleBasho,
      status: "complete",
      currentDay: 15,
    });
    await repositories.upsertBanzukeEntry({
      id: "2026-05-onosato",
      bashoId: "2026-05",
      rikishiId: "onosato",
      shikona: "Historic Onosato",
      heya: "Historic Heya",
      rank: "Ozeki",
      rankOrder: 1,
    });
    await repositories.insertBasho({
      id: "2026-07",
      isDemo: false,
      name: "July 2026 Basho",
      startDate: "2026-07-12",
      endDate: "2026-07-26",
      status: "active",
      currentDay: 1,
    });
    await repositories.insertBanzukeEntry({
      id: "2026-07-onosato",
      bashoId: "2026-07",
      rikishiId: "onosato",
      shikona: "Modern Onosato",
      heya: "Modern Heya",
      rank: "Yokozuna",
      rankOrder: 1,
    });
    await repositories.insertBanzukeEntry({
      id: "2026-07-kirishima",
      bashoId: "2026-07",
      rikishiId: "kirishima",
      shikona: "Kirishima",
      heya: "Otowayama",
      rank: "Maegashira",
      rankOrder: 2,
    });
    await repositories.upsertRikishi({
      id: "onosato",
      shikona: "Future Onosato",
      heya: "Future Heya",
    });
    await repositories.insertFantasyTeam({
      id: "team-history-july",
      bashoId: "2026-07",
      displayName: "History Stable II",
      ownerUserId,
    });
    await repositories.insertFantasyPick({
      teamId: "team-history-july",
      rikishiId: "onosato",
    });
    await repositories.insertFantasyPick({
      teamId: "team-history-july",
      rikishiId: "kirishima",
    });
    await repositories.insertBoutResult({
      id: "2026-07-day-1-bout-1",
      bashoId: "2026-07",
      day: 1,
      winnerRikishiId: "onosato",
      loserRikishiId: "hoshoryu",
    });
    await repositories.insertBoutResult({
      id: "2026-07-day-1-bout-2",
      bashoId: "2026-07",
      day: 1,
      winnerRikishiId: "kirishima",
      loserRikishiId: "kotozakura",
    });

    const [bashosResponse, leaderboardResponse, unauthenticatedHistory] =
      await Promise.all([
        app.inject({ method: "GET", url: "/api/bashos" }),
        app.inject({ method: "GET", url: "/api/leaderboard/all-time" }),
        app.inject({ method: "GET", url: "/api/my-history" }),
      ]);
    const historyResponse = await app.inject({
      method: "GET",
      url: "/api/my-history",
      headers: { cookie },
    });

    expect(
      bashosResponse.json().bashos.map((basho: { id: string }) => basho.id),
    ).toEqual(["2026-07", "2026-05"]);
    expect(leaderboardResponse.statusCode).toBe(200);
    expect(leaderboardResponse.json().bashoCount).toBe(1);
    expect(
      leaderboardResponse
        .json()
        .leaderboard.find(
          (entry: { displayName: string }) =>
            entry.displayName === "History Stable",
        ),
    ).toMatchObject({
      displayName: "History Stable",
      score: 2,
      tournamentsPlayed: 1,
      bashos: [{ bashoId: "2026-05", score: 2 }],
    });
    expect(unauthenticatedHistory.statusCode).toBe(401);
    expect(historyResponse.statusCode).toBe(200);
    const historyBody = historyResponse.json();
    expect(historyBody.score).toBe(2);
    expect(
      historyBody.history.map(
        (entry: { basho: { id: string } }) => entry.basho.id,
      ),
    ).toEqual(["2026-07", "2026-05"]);
    expect(historyBody.history[0]).toMatchObject({
      basho: { id: "2026-07" },
      score: 2,
    });
    expect(historyBody.history[0].picks[0]).toMatchObject({
      rikishiId: "onosato",
      shikona: "Modern Onosato",
      heya: "Modern Heya",
      wins: 1,
    });
    expect(historyBody.history[1]).toMatchObject({
      basho: { id: "2026-05" },
      score: 2,
    });
    expect(historyBody.history[1].picks[0]).toMatchObject({
      rikishiId: "onosato",
      shikona: "Historic Onosato",
      heya: "Historic Heya",
      wins: 1,
    });
  });
});

async function signIn(
  email = "new.player@example.com",
  displayName = "New Player",
) {
  const response = await app.inject({
    method: "POST",
    url: "/api/session",
    payload: {
      email,
      displayName,
    },
  });
  const cookie = response.headers["set-cookie"];

  expect(response.statusCode).toBe(201);
  expect(cookie).toBeDefined();

  return {
    cookie: Array.isArray(cookie) ? cookie[0] : cookie,
  };
}

async function verifyStoredResultDays(
  repositories: ReturnType<typeof createRepositories>,
  throughDay: number,
) {
  const results = await repositories.listBoutResultsForBasho("2026-05");

  for (let day = 1; day <= throughDay; day += 1) {
    const dayResults = results.filter((result) => result.day === day);
    await repositories.applyScheduledBoutsImport({
      publication: {
        id: `2026-05-day-${day}-verified-test`,
        bashoId: "2026-05",
        day,
        source: "test:complete",
        publishedAt: "2026-05-18T08:00:00.000Z",
      },
      bouts: dayResults.map((result) => ({
        id: result.id,
        bashoId: result.bashoId,
        day: result.day,
        eastRikishiId: result.winnerRikishiId,
        westRikishiId: result.loserRikishiId,
        status: "scheduled",
      })),
    });
  }
}
