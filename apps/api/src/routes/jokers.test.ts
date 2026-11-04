import { beforeEach, afterEach, it, expect } from "vitest";
import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
  seedDemoDatabase,
  startDemoBasho,
  advanceDemoBashoDay,
  type DatabaseClient,
  type Repositories,
} from "@fantasy-sumo/db";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";
const id = "demo-2026-05",
  url = `/api/basho/${id}/my-jokers`;
const now = () => new Date("2026-11-01T10:30:00.000Z");
let client: DatabaseClient,
  repos: Repositories,
  app: FastifyInstance,
  cookie: string;
beforeEach(async () => {
  client = createDatabaseClient(":memory:");
  await runMigrations(client);
  repos = createRepositories(client);
  await seedDemoDatabase(repos);
  app = buildApp({
    db: client,
    authMode: "local",
    demoAdminToken: "demo-test",
    now,
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/session",
    payload: { email: "joker@example.com", displayName: "Joker Player" },
  });
  cookie = String(login.headers["set-cookie"]).split(";")[0]!;
  await app.inject({
    method: "POST",
    url: `/api/basho/${id}/teams`,
    headers: { cookie },
    payload: { displayName: "Joker Stable", rikishiIds: ["onosato", "ura"] },
  });
});
afterEach(async () => {
  await app.close();
  await client.close();
});
it("requires existing authentication/admin boundaries and cannot accept clock injection", async () => {
  expect((await app.inject({ url })).statusCode).toBe(401);
  expect(
    (
      await app.inject({
        method: "PUT",
        url: "/api/admin/demo/jokers",
        payload: {},
        headers: { cookie },
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "PUT",
        url: "/api/admin/demo/jokers",
        payload: {},
        headers: { "x-demo-admin-token": "demo-test" },
      })
    ).statusCode,
  ).toBe(200);
  await startDemoBasho(repos, now);
  const read = await app.inject({ url, headers: { cookie } });
  expect(read.statusCode).toBe(200);
  const s = read.json().snapshot;
  const target = s.windows[0].targets[0];
  const command = { ...target, day: 1, expectedRevision: 0, requestId: "one" };
  expect(
    (
      await app.inject({
        method: "PUT",
        url,
        headers: { cookie },
        payload: { ...command, now: "2026-05-01" },
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await app.inject({
        method: "PUT",
        url,
        headers: { cookie },
        payload: command,
      })
    ).statusCode,
  ).toBe(200);
  await repos.configureDemoJokers("2026-05-10T03:00:00.000Z", now);
  expect(
    (
      await app.inject({
        method: "PUT",
        url,
        headers: { cookie },
        payload: { ...command, expectedRevision: 1, requestId: "late" },
      })
    ).statusCode,
  ).toBe(409);
});
it("keeps official stable and leaderboard totals/history aligned with a verified joker and leaves public base scores unchanged", async () => {
  await repos.configureDemoJokers(undefined, now);
  await startDemoBasho(repos, now);
  const s = (await app.inject({ url, headers: { cookie } })).json().snapshot;
  const target = s.windows[0].targets.find(
    (t: { rikishiId: string }) => t.rikishiId === "onosato",
  );
  await app.inject({
    method: "PUT",
    url,
    headers: { cookie },
    payload: { ...target, day: 1, expectedRevision: 0, requestId: "score" },
  });
  await repos.configureDemoJokers("2026-05-10T04:00:00.000Z", now);
  await advanceDemoBashoDay(repos, now);
  const team = (
    await app.inject({ url: `/api/basho/${id}/my-team`, headers: { cookie } })
  ).json();
  expect(team).toMatchObject({
    jokerTrial: true,
    totalScore: 2,
    breakdown: { wins: 1, joker: 1 },
  });
  const standings = (
    await app.inject({ url: `/api/basho/${id}/leaderboard` })
  ).json().leaderboard;
  expect(
    standings.find((e: { teamId: string }) => e.teamId === team.team.id),
  ).toMatchObject({
    score: 2,
    scoreHistory: [{ day: 1, dailyScore: 2, cumulativeScore: 2 }],
  });
  const rikishi = (await app.inject({ url: `/api/basho/${id}/rikishi` })).json()
    .rikishi;
  expect(rikishi.find((r: { id: string }) => r.id === "onosato").score).toBe(1);
});
