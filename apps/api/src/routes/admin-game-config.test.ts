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
  sampleBanzukeEntries,
  sampleBasho,
  sampleRikishi,
  type DatabaseClient,
} from "@fantasy-sumo/db";
import { buildApp } from "../app.js";

const adminEmail = "admin@example.com";
const adminUserId = localUserId(adminEmail);

let app: FastifyInstance;
let client: DatabaseClient;
let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), "fantasy-sumo-game-config-"));
  client = createDatabaseClient(`file:${join(tmpRoot, "test.sqlite")}`);
  await runMigrations(client);
  await createRepositories(client).applyBanzukeImport({
    basho: sampleBasho,
    rikishi: sampleRikishi,
    banzukeEntries: sampleBanzukeEntries,
  });
  app = buildApp({
    adminUserIds: [adminUserId],
    authMode: "local",
    db: client,
    teamIdFactory: () => "configured",
  });
});

afterEach(async () => {
  await app.close();
  await client.close();
  rmSync(tmpRoot, { force: true, recursive: true });
});

describe("admin game configuration routes", () => {
  it("forbids signed-out and non-admin users", async () => {
    const signedOutResponse = await app.inject({
      method: "GET",
      url: `/api/admin/basho/${sampleBasho.id}/game-config`,
    });
    const playerCookie = await login("player@example.com");
    const playerResponse = await app.inject({
      headers: { cookie: playerCookie },
      method: "PUT",
      payload: { teamSize: 3 },
      url: `/api/admin/basho/${sampleBasho.id}/game-config`,
    });

    expect(signedOutResponse.statusCode).toBe(403);
    expect(playerResponse.statusCode).toBe(403);
  });

  it("persists an upcoming basho team size and makes it authoritative", async () => {
    const adminCookie = await login(adminEmail);
    const defaultResponse = await app.inject({
      headers: { cookie: adminCookie },
      method: "GET",
      url: `/api/admin/basho/${sampleBasho.id}/game-config`,
    });
    const updateResponse = await app.inject({
      headers: { cookie: adminCookie },
      method: "PUT",
      payload: { teamSize: 3 },
      url: `/api/admin/basho/${sampleBasho.id}/game-config`,
    });
    const currentBashoResponse = await app.inject({
      method: "GET",
      url: "/api/basho/current",
    });

    expect(defaultResponse.json()).toMatchObject({
      canChangeTeamSize: true,
      gameConfig: {
        teamSize: 2,
        teamSizeSource: "default",
        scoringMode: "wins-v0",
      },
    });
    expect(updateResponse.json()).toMatchObject({
      changed: true,
      gameConfig: { teamSize: 3, teamSizeSource: "basho" },
    });
    expect(currentBashoResponse.json()).toMatchObject({ teamSize: 3 });

    await app.close();
    app = buildApp({
      adminUserIds: [adminUserId],
      authMode: "local",
      db: client,
      teamSize: 7,
    });

    const persistedResponse = await app.inject({
      headers: { cookie: await login(adminEmail) },
      method: "GET",
      url: `/api/admin/basho/${sampleBasho.id}/game-config`,
    });
    expect(persistedResponse.json()).toMatchObject({
      gameConfig: { teamSize: 3, teamSizeSource: "basho" },
    });
  });

  it("uses the configured team size for validation and locks it after submission", async () => {
    const adminCookie = await login(adminEmail);
    await app.inject({
      headers: { cookie: adminCookie },
      method: "PUT",
      payload: { teamSize: 3 },
      url: `/api/admin/basho/${sampleBasho.id}/game-config`,
    });

    const tooSmallResponse = await app.inject({
      headers: { cookie: adminCookie },
      method: "POST",
      payload: {
        displayName: "Configured Stable",
        rikishiIds: ["onosato", "kotozakura"],
      },
      url: `/api/basho/${sampleBasho.id}/teams`,
    });
    const createdResponse = await app.inject({
      headers: { cookie: adminCookie },
      method: "POST",
      payload: {
        displayName: "Configured Stable",
        rikishiIds: ["onosato", "kotozakura", "hoshoryu"],
      },
      url: `/api/basho/${sampleBasho.id}/teams`,
    });
    const idempotentUpdateResponse = await app.inject({
      headers: { cookie: adminCookie },
      method: "PUT",
      payload: { teamSize: 3 },
      url: `/api/admin/basho/${sampleBasho.id}/game-config`,
    });
    const lockedUpdateResponse = await app.inject({
      headers: { cookie: adminCookie },
      method: "PUT",
      payload: { teamSize: 4 },
      url: `/api/admin/basho/${sampleBasho.id}/game-config`,
    });

    expect(tooSmallResponse.statusCode).toBe(409);
    expect(tooSmallResponse.json()).toMatchObject({
      error: "team-size-changed",
      teamSize: 3,
    });
    expect(createdResponse.statusCode).toBe(201);
    expect(createdResponse.json().picks).toHaveLength(3);
    expect(idempotentUpdateResponse.statusCode).toBe(200);
    expect(idempotentUpdateResponse.json()).toMatchObject({
      changed: false,
      canChangeTeamSize: false,
      gameConfig: { teamSize: 3 },
    });
    expect(lockedUpdateResponse.statusCode).toBe(409);
    expect(lockedUpdateResponse.json()).toMatchObject({
      error: "game-config-locked",
      reason: "teams-exist",
      gameConfig: { teamSize: 3 },
    });
  });

  it("rejects team-size changes after picks close", async () => {
    const repositories = createRepositories(client);
    await repositories.updateBasho({ ...sampleBasho, status: "locked" });
    const response = await app.inject({
      headers: { cookie: await login(adminEmail) },
      method: "PUT",
      payload: { teamSize: 3 },
      url: `/api/admin/basho/${sampleBasho.id}/game-config`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: "game-config-locked",
      reason: "basho-not-upcoming",
    });
  });

  it("rejects invalid team sizes", async () => {
    const response = await app.inject({
      headers: { cookie: await login(adminEmail) },
      method: "PUT",
      payload: { teamSize: 0 },
      url: `/api/admin/basho/${sampleBasho.id}/game-config`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "invalid-request",
    });
  });
});

async function login(email: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    payload: { displayName: email.split("@")[0], email },
    url: "/api/session",
  });
  const cookie = response.headers["set-cookie"];

  expect(response.statusCode).toBe(201);
  expect(cookie).toBeTypeOf("string");

  return String(cookie).split(";")[0];
}

function localUserId(email: string): string {
  return `local-${createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("base64url")
    .slice(0, 24)}`;
}
