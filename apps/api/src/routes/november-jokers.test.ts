import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
  seedDemoDatabase,
} from "@fantasy-sumo/db";
import { buildApp } from "../app.js";
import { SUMO_API_PRE_BOUT_SOURCE } from "@fantasy-sumo/domain";

const adminEmail = "trial-admin@example.com";
const adminId =
  "local-" +
  createHash("sha256").update(adminEmail).digest("base64url").slice(0, 24);
const db = () => createDatabaseClient(":memory:");
let client: ReturnType<typeof db>;
let app: ReturnType<typeof buildApp>;
let repos: ReturnType<typeof createRepositories>;
let clock: string;
const adminUrl = "/api/admin/basho/2026-11/jokers";
const body = { confirmBashoId: "2026-11", acceptPreStartTrial: true };
async function login(email: string) {
  const r = await app.inject({
    method: "POST",
    url: "/api/session",
    payload: { email, displayName: email.split("@")[0] },
  });
  return String(r.headers["set-cookie"]).split(";")[0]!;
}
beforeEach(async () => {
  client = db();
  await runMigrations(client);
  repos = createRepositories(client);
  await seedDemoDatabase(repos);
  await repos.insertBasho({
    id: "2026-11",
    name: "November",
    isDemo: false,
    startDate: "2026-11-08",
    endDate: "2026-11-22",
    status: "upcoming",
    currentDay: 0,
  });
  for (const entry of await repos.listBanzukeEntriesForBasho("demo-2026-05"))
    await repos.insertBanzukeEntry({
      ...entry,
      id: "live-" + entry.id,
      bashoId: "2026-11",
    });
  clock = "2026-11-07T14:00:00.000Z";
  app = buildApp({
    db: client,
    authMode: "local",
    adminUserIds: [adminId],
    now: () => new Date(clock),
  });
});
afterEach(async () => {
  await app.close();
  await client.close();
});

it("requires an authenticated administrator and explicit confirmation without clock injection", async () => {
  expect((await app.inject({ url: adminUrl })).statusCode).toBe(403);
  const player = await login("player@example.com");
  expect(
    (
      await app.inject({
        method: "POST",
        url: adminUrl,
        headers: { cookie: player },
        payload: body,
      })
    ).statusCode,
  ).toBe(403);
  const cookie = await login(adminEmail);
  expect(
    (
      await app.inject({
        method: "POST",
        url: adminUrl,
        headers: { cookie },
        payload: {},
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await app.inject({
        method: "POST",
        url: adminUrl,
        headers: { cookie },
        payload: { ...body, now: clock },
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await app.inject({
        method: "POST",
        url: adminUrl,
        headers: { cookie },
        payload: body,
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (await app.inject({ url: adminUrl, headers: { cookie } })).json().trial
      .enabledBy,
  ).toBe(adminId);
});
it("keeps owned live jokers private, enforces the server cutoff and adds points only after verified results", async () => {
  const alice = await login("alice@example.com");
  const bob = await login("bob@example.com");
  for (const [cookie, displayName] of [
    [alice, "Alice"],
    [bob, "Bob"],
  ])
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/basho/2026-11/teams",
          headers: { cookie },
          payload: { displayName, rikishiIds: ["onosato", "ura"] },
        })
      ).statusCode,
    ).toBe(201);
  await repos.setBashoScoringMode("2026-11", "achievements-v1");
  const admin = await login(adminEmail);
  expect(
    (
      await app.inject({
        method: "POST",
        url: adminUrl,
        headers: { cookie: admin },
        payload: body,
      })
    ).statusCode,
  ).toBe(200);
  await repos.lockBashoAndFantasyTeams("2026-11", clock);
  const card = {
    publication: {
      id: "card",
      bashoId: "2026-11",
      day: 1,
      source: SUMO_API_PRE_BOUT_SOURCE,
      publishedAt: clock,
    },
    bouts: [
      {
        id: "bout",
        bashoId: "2026-11",
        day: 1,
        eastRikishiId: "onosato",
        westRikishiId: "hoshoryu",
        status: "scheduled" as const,
      },
    ],
  };
  await repos.applyScheduledBoutsImport(card);
  clock = "2026-11-08T02:59:59.000Z";
  const url = "/api/basho/2026-11/my-jokers";
  const snapshot = (
    await app.inject({ url, headers: { cookie: alice } })
  ).json().snapshot;
  const pick = {
    ...snapshot.windows[0].targets[0],
    day: 1,
    expectedRevision: 0,
    requestId: "alice-pick",
  };
  expect(
    (
      await app.inject({
        method: "PUT",
        url,
        headers: { cookie: alice },
        payload: pick,
      })
    ).json().snapshot.remaining,
  ).toBe(2);
  expect(
    (await app.inject({ url, headers: { cookie: bob } })).json().snapshot
      .allocations,
  ).toHaveLength(0);
  clock = "2026-11-08T03:00:00.000Z";
  expect(
    (
      await app.inject({
        method: "PUT",
        url,
        headers: { cookie: alice },
        payload: {
          ...pick,
          rikishiId: null,
          boutId: null,
          opponentId: null,
          expectedRevision: 1,
          requestId: "late",
        },
      })
    ).statusCode,
  ).toBe(409);
  await repos.insertBoutResult({
    id: "result",
    bashoId: "2026-11",
    day: 1,
    winnerRikishiId: "onosato",
    loserRikishiId: "hoshoryu",
  });
  expect(
    (await app.inject({ url, headers: { cookie: alice } })).json().snapshot
      .allocations[0].state,
  ).toBe("locked");
  await repos.applyScheduledBoutsImport({
    ...card,
    publication: { ...card.publication, source: "sumo-api:complete" },
  });
  const owned = (
    await app.inject({
      url: "/api/basho/2026-11/my-team",
      headers: { cookie: alice },
    })
  ).json();
  expect(owned.jokerTrial).toBe(true);
  expect(owned.totalScore).toBe(2);
  const standings = (
    await app.inject({ url: "/api/basho/2026-11/leaderboard" })
  ).json().leaderboard;
  expect(
    standings.find(
      (entry: { displayName: string }) => entry.displayName === "Alice",
    ).score,
  ).toBe(2);
  expect(
    standings.find(
      (entry: { displayName: string }) => entry.displayName === "Bob",
    ).score,
  ).toBe(1);
});
