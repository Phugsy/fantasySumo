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
