import { createHash, randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
  seedDemoDatabase,
} from "@fantasy-sumo/db";
import { SUMO_API_PRE_BOUT_SOURCE } from "@fantasy-sumo/domain";
import { buildApp } from "../app.js";

const id = "2026-11";
const ownerId = userId("owner@example.com");
const adminId = userId("admin@example.com");
const playerId = userId("player@example.com");
let db: ReturnType<typeof createDatabaseClient>;
let app: ReturnType<typeof buildApp>;
let repos: ReturnType<typeof createRepositories>;
let clock: string;
function userId(email: string) {
  return (
    "local-" +
    createHash("sha256").update(email).digest("base64url").slice(0, 24)
  );
}
async function login(email: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/session",
    payload: { email, displayName: email.split("@")[0] },
  });
  return String(response.headers["set-cookie"]).split(";")[0]!;
}
async function change(
  cookie: string,
  override: boolean,
  expectedMode = "wins-v0",
) {
  return app.inject({
    method: "PUT",
    url: `/api/admin/basho/${id}/game-config/scoring`,
    headers: { cookie },
    payload: {
      scoringMode: "achievements-v1",
      ...(override
        ? {
            override: {
              expectedMode,
              reason: "Owner approved full tournament rescore",
            },
          }
        : {}),
    },
  });
}
beforeEach(async () => {
  db = createDatabaseClient(":memory:");
  await runMigrations(db);
  repos = createRepositories(db);
  await seedDemoDatabase(repos);
  await repos.insertBasho({
    id,
    name: "November test",
    isDemo: false,
    startDate: "2026-11-08",
    endDate: "2026-11-22",
    status: "upcoming",
    currentDay: 0,
  });
  for (const row of await repos.listBanzukeEntriesForBasho("demo-2026-05"))
    await repos.insertBanzukeEntry({
      ...row,
      id: "live-" + row.id,
      bashoId: id,
    });
  await repos.insertFantasyTeamWithPicksIfBashoUpcoming(
    {
      id: "rescored",
      bashoId: id,
      displayName: "Rescored Stable",
      ownerUserId: playerId,
      ownerName: "Player",
    },
    [
      { teamId: "rescored", rikishiId: "onosato" },
      { teamId: "rescored", rikishiId: "ura" },
    ],
  );
  clock = "2026-11-07T12:00:00.000Z";
  await repos.enableNovemberJokers(id, ownerId, () => new Date(clock));
  await repos.transitionBashoLifecycle(id, "start", clock);
  await repos.applyScheduledBoutsImport({
    publication: {
      id: "live-card-1",
      bashoId: id,
      day: 1,
      source: SUMO_API_PRE_BOUT_SOURCE,
      publishedAt: clock,
    },
    bouts: [
      {
        id: "live-bout-1",
        bashoId: id,
        day: 1,
        eastRikishiId: "onosato",
        westRikishiId: "hoshoryu",
        status: "scheduled",
      },
    ],
  });
  clock = "2026-11-08T02:00:00.000Z";
  await repos.getJokerSnapshot(id, () => new Date(clock), playerId, {
    ownerUserId: playerId,
    day: 1,
    rikishiId: "onosato",
    boutId: "live-bout-1",
    opponentId: "hoshoryu",
    expectedRevision: 0,
    requestId: randomUUID(),
  });
  for (let day = 1; day <= 8; day++) {
    const date = `2026-11-${String(day + 7).padStart(2, "0")}T10:00:00.000Z`;
    await repos.applyScheduledBoutsImport({
      publication: {
        id: `live-card-${day}`,
        bashoId: id,
        day,
        source: "test:complete",
        publishedAt: date,
      },
      bouts: [
        {
          id: `live-bout-${day}`,
          bashoId: id,
          day,
          eastRikishiId: "onosato",
          westRikishiId: "hoshoryu",
          status: "scheduled",
        },
      ],
    });
    await repos.insertBoutResult({
      id: `live-result-${day}`,
      bashoId: id,
      day,
      winnerRikishiId: "onosato",
      loserRikishiId: "hoshoryu",
    });
  }
  await repos.updateBasho({
    ...(await repos.getBasho(id))!,
    status: "complete",
    currentDay: 8,
  });
  clock = "2026-11-15T12:00:00.000Z";
  app = buildApp({
    db,
    authMode: "local",
    adminUserIds: [adminId],
    superAdminUserIds: [ownerId],
    now: () => new Date(clock),
  });
});
afterEach(async () => {
  await app.close();
  await db.close();
});

it("requires the separate verified owner permission and an explicit, current confirmation", async () => {
  expect(
    (await change(await login("player@example.com"), true)).statusCode,
  ).toBe(403);
  const admin = await login("admin@example.com");
  expect((await change(admin, true)).statusCode).toBe(403);
  expect((await change(admin, false)).statusCode).toBe(409);
  const owner = await login("owner@example.com");
  expect((await change(owner, false)).statusCode).toBe(409);
  expect((await change(owner, true, "achievements-v1")).statusCode).toBe(409);
  expect(await repos.listBashoScoringOverrides(id)).toEqual([]);
  const ordinaryConfig = (
    await app.inject({
      url: `/api/admin/basho/${id}/game-config`,
      headers: { cookie: admin },
    })
  ).json();
  expect(ordinaryConfig).not.toHaveProperty("canOverrideScoringMode");
  expect(ordinaryConfig).not.toHaveProperty("scoringOverrides");
});

it("rescores existing results, joker boosts and all histories atomically while retaining original facts", async () => {
  const owner = await login("owner@example.com");
  const player = await login("player@example.com");
  const board = async () =>
    (await app.inject(`/api/basho/${id}/leaderboard`))
      .json()
      .leaderboard.find((row: { teamId: string }) => row.teamId === "rescored");
  expect((await board()).score).toBe(9);
  const originalPicks = await repos.listFantasyPicksForBasho(id);
  const originalResults = await repos.listBoutResultsForBasho(id);
  const originalJokers = (await repos.getJokerSnapshot(
    id,
    () => new Date(clock),
    playerId,
  ))!.allocations;
  expect((await change(owner, true)).statusCode).toBe(200);
  expect((await board()).score).toBe(12);
  expect((await board()).scoreHistory.at(-1).cumulativeScore).toBe(12);
  expect(
    (
      await app.inject({
        url: `/api/basho/${id}/my-team`,
        headers: { cookie: player },
      })
    ).json().totalScore,
  ).toBe(12);
  expect(
    (await app.inject("/api/leaderboard/all-time"))
      .json()
      .leaderboard.find(
        (row: { displayName: string }) => row.displayName === "Rescored Stable",
      ).score,
  ).toBe(12);
  expect(
    (
      await app.inject({ url: "/api/my-history", headers: { cookie: player } })
    ).json().score,
  ).toBe(12);
  expect(await repos.listFantasyPicksForBasho(id)).toEqual(originalPicks);
  expect(await repos.listBoutResultsForBasho(id)).toEqual(originalResults);
  expect(
    (await repos.getJokerSnapshot(id, () => new Date(clock), playerId))!
      .allocations,
  ).toEqual(originalJokers);
  expect((await repos.getLiveJokerTrial(id))!.baseMode).toBe("achievements-v1");
  expect(await repos.getBashoScoringConfig(id)).toMatchObject({
    mode: "achievements-v1",
    locked: true,
  });
  expect(await repos.setBashoScoringMode(id, "wins-v0")).toBe("locked");
  expect(await repos.listBashoScoringOverrides(id)).toEqual([
    expect.objectContaining({
      actorUserId: ownerId,
      fromMode: "wins-v0",
      toMode: "achievements-v1",
      changedAt: clock,
    }),
  ]);
  expect((await change(owner, true)).statusCode).toBe(200);
  expect(await repos.listBashoScoringOverrides(id)).toHaveLength(1);
});

it("rolls back mode and joker configuration if the audit write fails", async () => {
  if (db.provider !== "sqlite") throw new Error("SQLite fixture required");
  db.sqlite.exec(
    "CREATE TRIGGER reject_override BEFORE INSERT ON basho_scoring_overrides BEGIN SELECT RAISE(ABORT, 'audit failed'); END",
  );
  await expect(
    repos.overrideBashoScoringMode(id, "achievements-v1", {
      actorUserId: ownerId,
      reason: "Test an atomic rollback",
      expectedMode: "wins-v0",
      changedAt: clock,
    }),
  ).rejects.toThrow("audit failed");
  expect((await repos.getBashoScoringConfig(id))!.mode).toBe("wins-v0");
  expect((await repos.getLiveJokerTrial(id))!.baseMode).toBe("wins-v0");
  expect(await repos.listBashoScoringOverrides(id)).toEqual([]);
});
