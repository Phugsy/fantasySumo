import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createECDH, randomBytes, randomUUID } from "node:crypto";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
  seedDemoDatabase,
  startDemoBasho,
  type DatabaseClient,
  type Repositories,
} from "@fantasy-sumo/db";
import { buildApp } from "../app.js";
import { deliverPushOpening, installPushPublicationObserver } from "../push.js";
const bashoId = "demo-2026-05",
  origin = "http://localhost";
const now = () => new Date("2026-05-10T02:00:00.000Z");
const curve = createECDH("prime256v1");
curve.generateKeys();
const subscription = {
  endpoint: "https://fcm.googleapis.com/wp/synthetic",
  expirationTime: null,
  keys: {
    p256dh: curve.getPublicKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  },
  timezone: "Asia/Tokyo",
};
let client: DatabaseClient, repos: Repositories, dir: string;
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "push-api-"));
  client = createDatabaseClient(`file:${join(dir, "test.sqlite")}`);
  await runMigrations(client);
  repos = createRepositories(client);
  await seedDemoDatabase(repos);
  for (const owner of ["alice", "bob"])
    await repos.insertFantasyTeamWithPicksIfBashoUpcoming(
      { id: owner, bashoId, ownerUserId: owner, displayName: owner },
      [
        { teamId: owner, rikishiId: "onosato" },
        { teamId: owner, rikishiId: "ura" },
      ],
    );
  await repos.configureDemoJokers(undefined, now);
  await startDemoBasho(repos, now);
  await repos.preparePushPilot(bashoId, ["alice", "bob"]);
  await repos.setPushPilotEnabled(bashoId, true);
});
afterEach(async () => {
  await client.close();
  rmSync(dir, { recursive: true, force: true });
});
function app(
  enabled = true,
  transport = vi.fn(async () => ({ send: async () => "accepted" as const })),
) {
  return buildApp({
    db: client,
    now,
    authMode: "neon",
    neonJwtVerifier: async (token) => ({ id: token }),
    ...(enabled
      ? {
          pushRuntime: {
            bashoId,
            origin,
            publicKey: subscription.keys.p256dh,
            allowedHosts: ["fcm.googleapis.com"],
            transport,
          },
        }
      : {}),
  });
}
const headers = (owner = "alice") => ({
  authorization: `Bearer ${owner}`,
  origin,
});
it("is disabled by default; enforces authentication, same origin and expected session ownership", async () => {
  const disabled = app(false);
  expect(
    (
      await disabled.inject({
        url: "/api/push/preferences",
        headers: headers(),
      })
    ).json(),
  ).toEqual({ available: false, subscribed: false, revision: null });
  expect(
    (
      await disabled.inject({
        method: "PUT",
        url: "/api/push/subscription",
        headers: headers(),
        payload: {},
      })
    ).statusCode,
  ).toBe(404);
  await disabled.close();
  const api = app();
  expect((await api.inject({ url: "/api/push/preferences" })).statusCode).toBe(
    401,
  );
  const payload = {
    expectedOwnerId: "alice",
    deviceId: randomUUID(),
    expectedRevision: null,
    subscription,
  };
  expect(
    (
      await api.inject({
        method: "PUT",
        url: "/api/push/subscription",
        headers: { ...headers(), origin: "https://evil.test" },
        payload,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await api.inject({
        method: "PUT",
        url: "/api/push/subscription",
        headers: headers("bob"),
        payload,
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await api.inject({
        method: "PUT",
        url: "/api/push/subscription",
        headers: headers(),
        payload: { ...payload, ownerId: "bob" },
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await api.inject({
        method: "PUT",
        url: "/api/push/subscription",
        headers: headers(),
        payload: {
          ...payload,
          subscription: { ...subscription, endpoint: "https://127.0.0.1/id" },
        },
      })
    ).statusCode,
  ).toBe(400);
  await api.close();
});
it("stores one owned subscription and allows only capability-proven device revocation across accounts", async () => {
  const api = app();
  const deviceId = randomUUID();
  const saved = await api.inject({
    method: "PUT",
    url: "/api/push/subscription",
    headers: headers(),
    payload: {
      expectedOwnerId: "alice",
      deviceId,
      expectedRevision: null,
      subscription,
    },
  });
  expect(saved.statusCode).toBe(200);
  const { revokeToken } = saved.json();
  expect(revokeToken).toHaveLength(43);
  const own = (
    await api.inject({ url: "/api/push/preferences", headers: headers() })
  ).json();
  expect(own.subscribed).toBe(true);
  expect(JSON.stringify(own)).not.toContain("endpoint");
  expect(JSON.stringify(own)).not.toContain("revokeToken");
  expect(
    (
      await api.inject({
        url: "/api/push/preferences",
        headers: headers("bob"),
      })
    ).json().subscribed,
  ).toBe(false);
  const revoke = (token: string) =>
    api.inject({
      method: "POST",
      url: "/api/push/revoke-device",
      headers: headers("bob"),
      payload: { deviceId, revokeToken: token },
    });
  expect((await revoke("A".repeat(43))).statusCode).toBe(204);
  expect(
    (await repos.getPushPreferences(bashoId, "alice", now)).subscribed,
  ).toBe(true);
  expect((await revoke(revokeToken)).statusCode).toBe(204);
  expect(
    (await repos.getPushPreferences(bashoId, "alice", now)).subscribed,
  ).toBe(false);
  expect(
    (
      await api.inject({
        method: "PUT",
        url: "/api/push/subscription",
        headers: headers("bob"),
        payload: {
          expectedOwnerId: "bob",
          deviceId,
          expectedRevision: null,
          subscription,
        },
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await api.inject({
        method: "DELETE",
        url: "/api/push/subscription",
        headers: headers("bob"),
        payload: {},
      })
    ).statusCode,
  ).toBe(204);
  expect((await repos.getPushPreferences(bashoId, "bob", now)).subscribed).toBe(
    false,
  );
  await api.close();
});
it("isolates post-commit publication, ignores partial cards and persists unknown outcomes without replay", async () => {
  await repos.savePushSubscription(
    bashoId,
    "alice",
    randomUUID(),
    null,
    subscription,
    now,
  );
  const send = vi.fn(async () => {
    throw new Error("uncertain send");
  });
  const transport = vi.fn(async () => ({ send }));
  const runtime = {
    bashoId,
    origin,
    publicKey: subscription.keys.p256dh,
    allowedHosts: ["fcm.googleapis.com"],
    transport,
  };
  installPushPublicationObserver(repos, runtime, now);
  const publication = (
    await repos.listScheduledBoutPublicationsForBasho(bashoId)
  ).find((p) => p.day === 1)!;
  const original = await repos.listScheduledBoutsForBasho(bashoId);
  const bouts = original.filter((b) => b.day === 1);
  await repos.applyScheduledBoutsImport({ publication, bouts });
  expect(transport).not.toHaveBeenCalled();
  await repos.applyScheduledBoutsImport({
    publication: { ...publication, source: "synthetic:complete" },
    bouts,
  });
  expect(send).toHaveBeenCalledTimes(1);
  await deliverPushOpening(repos, runtime, 1, now);
  expect(send).toHaveBeenCalledTimes(1);
  expect(await repos.listScheduledBoutsForBasho(bashoId)).toEqual(original);
});

it("rechecks consent after transport preparation and cannot collect for a live basho", async () => {
  await repos.savePushSubscription(
    bashoId,
    "alice",
    randomUUID(),
    null,
    subscription,
    now,
  );
  const send = vi.fn(async () => "accepted" as const);
  const transport = vi.fn(async () => {
    await repos.disablePushSubscriptions(bashoId, "alice");
    return { send };
  });
  await deliverPushOpening(
    repos,
    {
      bashoId,
      origin,
      publicKey: subscription.keys.p256dh,
      allowedHosts: ["fcm.googleapis.com"],
      transport,
    },
    1,
    now,
  );
  expect(transport).toHaveBeenCalledTimes(1);
  expect(send).not.toHaveBeenCalled();
  await repos.upsertBasho({
    id: "live",
    isDemo: false,
    name: "Live",
    startDate: "2026-05-10",
    endDate: "2026-05-24",
    status: "active",
  });
  await repos.preparePushPilot("live", ["alice"]);
  await repos.setPushPilotEnabled("live", true);
  expect((await repos.getPushPreferences("live", "alice", now)).available).toBe(
    false,
  );
  await expect(
    repos.savePushSubscription(
      "live",
      "alice",
      randomUUID(),
      null,
      subscription,
      now,
    ),
  ).rejects.toThrow("pilot-unavailable");
});
