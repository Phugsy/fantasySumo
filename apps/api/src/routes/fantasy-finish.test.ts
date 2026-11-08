import { afterEach, beforeEach, expect, it } from "vitest";
import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
  seedDemoDatabase,
} from "@fantasy-sumo/db";
import { buildApp } from "../app.js";

let client: ReturnType<typeof createDatabaseClient>;
let repos: ReturnType<typeof createRepositories>;
let app: ReturnType<typeof buildApp>;
beforeEach(async () => {
  client = createDatabaseClient(":memory:");
  await runMigrations(client);
  repos = createRepositories(client);
  await seedDemoDatabase(repos);
  app = buildApp({
    db: client,
    authMode: "local",
    now: () => new Date("2026-12-01T12:00:00Z"),
  });
});
afterEach(async () => {
  await app.close();
  await client.close();
});

async function fixture(
  id = "2026-01",
  mode: "wins-v0" | "achievements-v1" = "wins-v0",
) {
  await repos.insertBasho({
    id,
    name: `Test ${id}`,
    isDemo: false,
    startDate: `${id}-01`,
    endDate: `${id}-01`,
    status: "upcoming",
    currentDay: 0,
  });
  for (const entry of await repos.listBanzukeEntriesForBasho("demo-2026-05"))
    await repos.insertBanzukeEntry({
      ...entry,
      id: `${id}-${entry.id}`,
      bashoId: id,
    });
  await repos.setBashoScoringMode(id, mode);
  for (const [player, pick] of [
    ["alice", "onosato"],
    ["bob", "ura"],
    ["carol", "takayasu"],
  ]) {
    await repos.insertFantasyTeam({
      id: `${id}-${player}`,
      bashoId: id,
      displayName: `${id} ${player}`,
      ownerUserId: player,
      ownerName: player,
    });
    await repos.insertFantasyPick({
      teamId: `${id}-${player}`,
      rikishiId: pick!,
    });
  }
  await repos.applyScheduledBoutsImport({
    publication: {
      id: `${id}-pub`,
      bashoId: id,
      day: 1,
      source: "sumo-api:complete",
      publishedAt: "2026-01-01T12:00:00Z",
    },
    bouts: [
      {
        id: `${id}-one`,
        bashoId: id,
        day: 1,
        status: "scheduled",
        eastRikishiId: "onosato",
        westRikishiId: "hoshoryu",
      },
      {
        id: `${id}-two`,
        bashoId: id,
        day: 1,
        status: "scheduled",
        eastRikishiId: "ura",
        westRikishiId: "takayasu",
      },
    ],
  });
  await repos.insertBoutResult({
    id: `${id}-one`,
    bashoId: id,
    day: 1,
    winnerRikishiId: "onosato",
    loserRikishiId: "hoshoryu",
  });
  await repos.insertBoutResult({
    id: `${id}-two`,
    bashoId: id,
    day: 1,
    winnerRikishiId: "ura",
    loserRikishiId: "takayasu",
  });
  await repos.updateBasho({
    ...(await repos.getBasho(id)),
    id,
    name: `Test ${id}`,
    isDemo: false,
    startDate: `${id}-01`,
    endDate: `${id}-01`,
    status: "complete",
    currentDay: 1,
  });
}
const board = async (id = "2026-01") =>
  (await app.inject(`/api/basho/${id}/leaderboard`)).json();
const all = async () => (await app.inject("/api/leaderboard/all-time")).json();

it("uses the same verified shared finish for the public board and idempotent all-time counts", async () => {
  await fixture();
  const finish = (await board()).finish;
  expect(finish.outcome).toMatchObject({
    status: "confirmed",
    yusho: [{ teamId: "2026-01-alice" }, { teamId: "2026-01-bob" }],
    junYusho: [],
  });
  const first = await all();
  expect(first.latestFinish).toEqual(finish);
  expect(first.honoursBashoCount).toBe(1);
  expect(
    first.leaderboard.find(
      (e: { ownerName: string }) => e.ownerName === "alice",
    ),
  ).toMatchObject({ yushoCount: 1, junYushoCount: 0 });
  expect(
    first.leaderboard.find(
      (e: { ownerName: string }) => e.ownerName === "carol",
    ),
  ).toMatchObject({ yushoCount: 0, junYushoCount: 0 });
  expect(await all()).toEqual(first);
  expect(
    (await app.inject("/api/basho/demo-2026-05/leaderboard")).json().finish
      .outcome,
  ).toEqual({ status: "ineligible", reason: "demo" });
});
it("reconciles a correction and aggregates title history by player rather than renamed stable", async () => {
  await fixture();
  await fixture("2026-03");
  await repos.upsertBoutResult({
    id: "2026-01-two",
    bashoId: "2026-01",
    day: 1,
    winnerRikishiId: "takayasu",
    loserRikishiId: "ura",
  });
  const changed = await all();
  expect(changed.bashoCount).toBe(2);
  expect(
    changed.leaderboard.find(
      (e: { ownerName: string }) => e.ownerName === "bob",
    ),
  ).toMatchObject({
    displayName: "2026-03 bob",
    tournamentsPlayed: 2,
    yushoCount: 1,
    junYushoCount: 0,
  });
  expect(
    changed.leaderboard.find(
      (e: { ownerName: string }) => e.ownerName === "carol",
    ),
  ).toMatchObject({ yushoCount: 1, junYushoCount: 0 });
  await repos.upsertBoutResult({
    id: "2026-01-two",
    bashoId: "2026-01",
    day: 1,
    winnerRikishiId: "hoshoryu",
    loserRikishiId: "ura",
  });
  expect((await board()).finish.outcome.status).toBe("pending");
  expect((await all()).honoursBashoCount).toBe(1);
});
it("withholds achievements-mode honours while final prizes are unconfirmed", async () => {
  await fixture("2026-01", "achievements-v1");
  expect((await board()).finish.outcome).toEqual({
    status: "pending",
    reason: "scoring-pending",
  });
  expect((await all()).latestFinish).toBeNull();
  expect(
    (await all()).leaderboard.every(
      (e: { yushoCount: number }) => e.yushoCount === 0,
    ),
  ).toBe(true);
  await repos.replaceSpecialPrizeSnapshot({
    bashoId: "2026-01",
    source: "test",
    fetchedAt: "2026-01-01T12:00:00.000Z",
    awards: [],
  });
  expect((await board()).finish.outcome.status).toBe("confirmed");
});
it("counts a unique winner and runner-up from the same official projection", async () => {
  await fixture();
  await repos.insertFantasyPick({ teamId: "2026-01-alice", rikishiId: "ura" });
  expect((await board()).finish.outcome).toMatchObject({
    status: "confirmed",
    yusho: [{ teamId: "2026-01-alice", score: 2 }],
    junYusho: [{ teamId: "2026-01-bob", score: 1 }],
  });
  expect(
    (await all()).leaderboard.find(
      (e: { ownerName: string }) => e.ownerName === "bob",
    ),
  ).toMatchObject({ yushoCount: 0, junYushoCount: 1 });
});
it("withholds a premature completion even when a stored result exists", async () => {
  await fixture();
  await repos.updateBasho({
    ...(await repos.getBasho("2026-01")),
    id: "2026-01",
    name: "Premature",
    isDemo: false,
    startDate: "2026-01-01",
    endDate: "2026-01-15",
    status: "complete",
    currentDay: 1,
  });
  expect((await board()).finish.outcome).toEqual({
    status: "pending",
    reason: "results-pending",
  });
  expect((await all()).finishes).toEqual([]);
});
