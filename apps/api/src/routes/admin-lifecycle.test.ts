import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
  seedDatabase,
  type DatabaseClient,
} from "@fantasy-sumo/db";
import { buildApp } from "../app.js";

const adminEmail = "admin@example.com";
const adminUserId = localUserId(adminEmail);

let app: FastifyInstance;
let client: DatabaseClient;
let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), "fantasy-sumo-admin-lifecycle-"));
  client = createDatabaseClient(`file:${join(tmpRoot, "test.sqlite")}`);
  await runMigrations(client);
  app = buildApp({
    adminUserIds: [adminUserId],
    authMode: "local",
    db: client,
    now: () => new Date("2026-05-09T12:00:00.000Z"),
  });
});

afterEach(async () => {
  await app.close();
  await client.close();
  rmSync(tmpRoot, { force: true, recursive: true });
});

describe("admin lifecycle routes", () => {
  it("forbids signed-out and non-admin users", async () => {
    const signedOutResponse = await app.inject({
      method: "GET",
      url: "/api/admin/basho/current",
    });
    const playerCookie = await login("player@example.com");
    const playerResponse = await app.inject({
      headers: { cookie: playerCookie },
      method: "POST",
      url: "/api/admin/basho/2026-05/start",
    });

    expect(signedOutResponse.statusCode).toBe(403);
    expect(signedOutResponse.json()).toMatchObject({
      error: "admin-forbidden",
    });
    expect(playerResponse.statusCode).toBe(403);
    expect(playerResponse.json()).toMatchObject({ error: "admin-forbidden" });
  });

  it("starts and closes a live basho while preventing later pick writes", async () => {
    const repositories = createRepositories(client);
    await seedDatabase(repositories);
    const adminCookie = await login(adminEmail);

    const statusResponse = await app.inject({
      headers: { cookie: adminCookie },
      method: "GET",
      url: "/api/admin/basho/current",
    });
    const startResponse = await app.inject({
      headers: { cookie: adminCookie },
      method: "POST",
      url: "/api/admin/basho/2026-05/start",
    });
    const latePickResponse = await app.inject({
      headers: { cookie: adminCookie },
      method: "POST",
      payload: {
        displayName: "Late Stable",
        rikishiIds: ["onosato", "kotozakura"],
      },
      url: "/api/basho/2026-05/teams",
    });
    const closeResponse = await app.inject({
      headers: { cookie: adminCookie },
      method: "POST",
      url: "/api/admin/basho/2026-05/close",
    });

    expect(statusResponse.json().basho).toMatchObject({
      id: "2026-05",
      isDemo: false,
      status: "upcoming",
    });
    expect(startResponse.json()).toMatchObject({
      action: "start",
      basho: { status: "active" },
      changed: true,
    });
    expect(latePickResponse.statusCode).toBe(409);
    expect(latePickResponse.json()).toMatchObject({ error: "picks-locked" });
    expect(closeResponse.json()).toMatchObject({
      action: "close",
      basho: { status: "complete" },
      changed: true,
    });
  });

  it("reopens only a locked live basho with no progress or results", async () => {
    const repositories = createRepositories(client);
    await repositories.insertBasho({
      id: "2026-07",
      isDemo: false,
      name: "July 2026 Basho",
      startDate: "2026-07-12",
      endDate: "2026-07-26",
      status: "locked",
      currentDay: 0,
    });
    await repositories.insertFantasyTeam({
      id: "locked-team",
      bashoId: "2026-07",
      displayName: "Locked Team",
      lockedAt: "2026-07-10T12:00:00.000Z",
    });
    const adminCookie = await login(adminEmail);

    const openResponse = await app.inject({
      headers: { cookie: adminCookie },
      method: "POST",
      url: "/api/admin/basho/2026-07/open-picks",
    });

    expect(openResponse.json()).toMatchObject({
      action: "open-picks",
      basho: { status: "upcoming" },
      changed: true,
    });
    expect(
      (await repositories.getFantasyTeam("locked-team"))?.lockedAt,
    ).toBeUndefined();
  });

  it("rejects reopening an active or completed live basho", async () => {
    const repositories = createRepositories(client);
    await repositories.insertBasho({
      id: "2026-07",
      isDemo: false,
      name: "July 2026 Basho",
      startDate: "2026-07-12",
      endDate: "2026-07-26",
      status: "active",
      currentDay: 1,
    });
    const adminCookie = await login(adminEmail);

    const response = await app.inject({
      headers: { cookie: adminCookie },
      method: "POST",
      url: "/api/admin/basho/2026-07/open-picks",
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: "invalid-lifecycle-transition",
      basho: { status: "active" },
    });
  });

  it("uses only scoped demo controls for the deterministic fixture", async () => {
    const adminCookie = await login(adminEmail);
    const resetResponse = await app.inject({
      headers: { cookie: adminCookie },
      method: "POST",
      url: "/api/admin/demo/reset",
    });
    const genericStartResponse = await app.inject({
      headers: { cookie: adminCookie },
      method: "POST",
      url: "/api/admin/basho/demo-2026-05/start",
    });

    expect(resetResponse.statusCode).toBe(200);
    expect(resetResponse.json().basho).toMatchObject({
      id: "demo-2026-05",
      isDemo: true,
      status: "upcoming",
    });
    expect(genericStartResponse.statusCode).toBe(409);
    expect(genericStartResponse.json()).toMatchObject({
      error: "demo-action-required",
    });
  });
});

async function login(email: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    payload: { displayName: "Test Operator", email },
    url: "/api/session",
  });
  const cookie = response.headers["set-cookie"];
  return (Array.isArray(cookie) ? cookie[0] : cookie) ?? "";
}

function localUserId(email: string): string {
  const digest = createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("base64url");
  return `local-${digest.slice(0, 24)}`;
}

it("locks picks without starting, then undoes only a result-free start while keeping teams locked", async () => {
  const repos = createRepositories(client);
  await seedDatabase(repos);
  const basho = {
    id: "2026-07",
    name: "July",
    isDemo: false,
    startDate: "2026-07-12",
    endDate: "2026-07-26",
    status: "upcoming" as const,
    currentDay: 0,
  };
  await repos.insertBasho(basho);
  for (const entry of await repos.listBanzukeEntriesForBasho("2026-05"))
    await repos.insertBanzukeEntry({
      ...entry,
      id: "transition-" + entry.id,
      bashoId: basho.id,
    });
  await repos.insertFantasyTeamWithPicksIfBashoUpcoming(
    {
      id: "locked-transition",
      bashoId: basho.id,
      displayName: "Locked",
      ownerUserId: "fixture-owner",
    },
    [
      { teamId: "locked-transition", rikishiId: "onosato" },
      { teamId: "locked-transition", rikishiId: "kotozakura" },
    ],
  );
  const cookie = await login(adminEmail);
  for (const action of ["lock-picks", "undo-start"])
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/admin/basho/${basho.id}/${action}`,
        })
      ).statusCode,
    ).toBe(403);
  const action = async (name: string) =>
    app.inject({
      method: "POST",
      url: `/api/admin/basho/${basho.id}/${name}`,
      headers: { cookie },
    });
  expect((await action("lock-picks")).json().basho).toMatchObject({
    status: "locked",
    currentDay: 0,
  });
  const lockedAt = (await repos.getFantasyTeam("locked-transition"))!.lockedAt;
  expect(lockedAt).toBeTruthy();
  expect((await action("start")).statusCode).toBe(200);
  expect((await action("undo-start")).json().basho.status).toBe("locked");
  expect((await repos.getFantasyTeam("locked-transition"))!.lockedAt).toBe(
    lockedAt,
  );
  const player = await login("another@example.com");
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/api/basho/${basho.id}/teams`,
        headers: { cookie: player },
        payload: { displayName: "Late", rikishiIds: ["onosato", "kotozakura"] },
      })
    ).statusCode,
  ).toBe(409);
  await action("start");
  await repos.insertBoutResult({
    id: "partial-result",
    bashoId: basho.id,
    day: 1,
    winnerRikishiId: "onosato",
    loserRikishiId: "kotozakura",
  });
  expect((await action("undo-start")).statusCode).toBe(409);
  expect((await repos.getBasho(basho.id))!.status).toBe("active");
});
