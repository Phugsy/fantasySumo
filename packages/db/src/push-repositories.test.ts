import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { createDatabaseClient, type DatabaseClient } from "./client.js";
import { createRepositories, type Repositories } from "./repositories.js";
import { seedDemoDatabase } from "./seed.js";
import { runMigrations } from "./migrate.js";
import { startDemoBasho } from "./demo-progression.js";
import type { PushSubscriptionData } from "./push-repositories.js";
const id = "demo-2026-05";
const owners = Array.from({ length: 20 }, (_, i) => `push-owner-${i}`);
const data = (owner = owners[0]!): PushSubscriptionData => ({
  endpoint: `https://fcm.googleapis.com/wp/${owner}`,
  expirationTime: null,
  keys: { p256dh: "synthetic-point", auth: "synthetic-auth" },
  timezone: "Asia/Tokyo",
});
const postgres = process.env.PUSH_TEST_POSTGRES_URL;
for (const provider of ["sqlite", "postgres"] as const)
  describe.skipIf(provider === "postgres" && !postgres)(
    `push transactions (${provider})`,
    () => {
      let client: DatabaseClient,
        peer: DatabaseClient,
        repos: Repositories,
        other: Repositories,
        dir: string;
      let time = "2026-05-10T02:00:00.000Z";
      const now = () => new Date(time);
      async function query(statement: ReturnType<typeof sql>) {
        return client.provider === "sqlite"
          ? client.db.all(statement)
          : client.db.execute(statement);
      }
      async function subscribe(
        owner = owners[0]!,
        device = owner,
        expected: string | null = null,
        extra: Partial<PushSubscriptionData> = {},
      ) {
        return repos.savePushSubscription(
          id,
          owner,
          device,
          expected,
          { ...data(owner), ...extra },
          now,
        );
      }
      beforeEach(async () => {
        if (provider === "postgres") {
          const url = new URL(postgres!);
          if (
            !["localhost", "127.0.0.1"].includes(url.hostname) ||
            url.port !== "55434" ||
            url.pathname !== "/push_test"
          )
            throw new Error("Use dedicated local push_test database on55434");
        }
        dir = mkdtempSync(join(tmpdir(), "push-parity-"));
        const url =
          provider === "sqlite"
            ? `file:${join(dir, "test.sqlite")}`
            : postgres!;
        client = createDatabaseClient(url);
        peer = createDatabaseClient(url);
        repos = createRepositories(client);
        other = createRepositories(peer);
        await runMigrations(client);
        await repos.resetAllDataForLocalFixtures();
        await seedDemoDatabase(repos);
        time = "2026-05-10T02:00:00.000Z";
        for (const owner of owners)
          await repos.insertFantasyTeamWithPicksIfBashoUpcoming(
            { id: owner, bashoId: id, ownerUserId: owner, displayName: owner },
            [
              { teamId: owner, rikishiId: "onosato" },
              { teamId: owner, rikishiId: "ura" },
            ],
          );
        await repos.configureDemoJokers(undefined, now);
        await startDemoBasho(repos, now);
        await query(
          sql`UPDATE scheduled_bout_publications SET published_at='2026-05-09T08:00:00.000Z' WHERE basho_id=${id} RETURNING day`,
        );
        await repos.preparePushPilot(id, owners);
        await repos.setPushPilotEnabled(id, true);
      });
      afterEach(async () => {
        await peer.close();
        await client.close();
        rmSync(dir, { recursive: true, force: true });
      });
      it("keeps roster fixed, owns one device and endpoint, and never exposes capability data", async () => {
        await expect(
          repos.preparePushPilot(id, [...owners, "extra"]),
        ).rejects.toThrow("invalid-roster");
        await expect(repos.preparePushPilot(id, ["changed"])).rejects.toThrow(
          "roster-immutable",
        );
        const revision = await subscribe();
        const prefs = await repos.getPushPreferences(id, owners[0]!, now);
        expect(prefs.subscribed).toBe(true);
        expect(JSON.stringify(prefs)).not.toContain("endpoint");
        expect(JSON.stringify(prefs)).not.toContain("synthetic-auth");
        await expect(subscribe()).rejects.toThrow("stale-subscription");
        await expect(subscribe(owners[1], owners[0])).rejects.toThrow(
          "device-unavailable",
        );
        await expect(
          subscribe(owners[1], "other", null, { endpoint: data().endpoint }),
        ).rejects.toThrow("device-unavailable");
        await subscribe(owners[0], "replacement", revision);
        await repos.disablePushSubscriptions(id, owners[0]!, owners[0]);
        expect(
          (await repos.getPushPreferences(id, owners[0]!, now)).subscribed,
        ).toBe(true);
        await repos.disablePushSubscriptions(id, owners[0]!);
        expect(
          (await repos.getPushPreferences(id, owners[0]!, now)).subscribed,
        ).toBe(false);
        await repos.setPushPilotEnabled(id, false);
        await expect(subscribe()).rejects.toThrow("pilot-unavailable");
      });
      it("atomically bounds overlapping publications at20/day and300/basho across two clients", async () => {
        for (const owner of owners) await subscribe(owner);
        for (let day = 1; day <= 15; day++) {
          time = `2026-05-${String(day + 9).padStart(2, "0")}T02:00:00.000Z`;
          const claims = await Promise.all(
            owners.flatMap((owner) => [
              repos.claimPushOpening(id, day, owner, now),
              other.claimPushOpening(id, day, owner, now),
            ]),
          );
          expect(claims.filter(Boolean)).toHaveLength(20);
        }
        const [pilot] = await query(
          sql`SELECT * FROM push_pilots WHERE basho_id=${id}`,
        );
        expect(Number(pilot!.total_attempts)).toBe(300);
        const rows = await query(
          sql`SELECT * FROM push_openings WHERE basho_id=${id}`,
        );
        expect(rows).toHaveLength(300);
      });
      it("binds canonical endpoint spellings to one owner across clients", async () => {
        await subscribe(owners[0], "first-device", null, {
          endpoint: data().endpoint.replace(
            "fcm.googleapis.com",
            "FCM.GOOGLEAPIS.COM:443",
          ),
        });
        const [stored] = await query(
          sql`SELECT payload_json FROM push_subscriptions WHERE owner_id=${owners[0]!}`,
        );
        expect(JSON.parse(String(stored!.payload_json)).endpoint).toBe(
          data().endpoint,
        );
        for (const endpoint of [
          data().endpoint,
          data().endpoint.replace("fcm.googleapis.com", "FCM.GOOGLEAPIS.COM"),
          data().endpoint.replace(
            "fcm.googleapis.com",
            "fcm.googleapis.com:443",
          ),
        ]) {
          await expect(
            other.savePushSubscription(
              id,
              owners[1]!,
              "other-device",
              null,
              { ...data(), endpoint },
              now,
            ),
          ).rejects.toThrow("device-unavailable");
        }
        expect(
          (await repos.getPushPreferences(id, owners[0]!, now)).subscribed,
        ).toBe(true);
        expect(
          (await repos.getPushPreferences(id, owners[1]!, now)).subscribed,
        ).toBe(false);
      });
      it("hands a reservation off once, never retries uncertain sends, and preserves a replacement on old expiry", async () => {
        const revision = await subscribe();
        const claim = (await repos.claimPushOpening(id, 1, owners[0]!, now))!;
        const attempts = await Promise.all([
          repos.recheckPushClaim(claim, now),
          other.recheckPushClaim(claim, now),
        ]);
        expect(attempts.filter(Boolean)).toHaveLength(1);
        expect(
          await other.claimPushOpening(id, 1, owners[0]!, now),
        ).toBeUndefined();
        await subscribe(owners[0], "replacement", revision);
        await repos.finishPushAttempt(claim, "expired");
        expect(
          (await repos.getPushPreferences(id, owners[0]!, now)).deviceId,
        ).toBe("replacement");
      });
      it("persists quiet skips and rejects exact cutoff, changed choices, revoked consent and kill switch", async () => {
        await subscribe(owners[0], owners[0], null, {
          timezone: "Europe/London",
        });
        expect(
          await repos.claimPushOpening(id, 1, owners[0]!, now),
        ).toBeUndefined();
        const preferences = await repos.getPushPreferences(id, owners[0]!, now);
        await subscribe(owners[0], owners[0], preferences.revision);
        expect(
          await repos.claimPushOpening(id, 1, owners[0]!, now),
        ).toBeUndefined();
        await subscribe(owners[1]);
        const claim = (await repos.claimPushOpening(id, 1, owners[1]!, now))!;
        await repos.disablePushSubscriptions(id, owners[1]!);
        expect(await repos.recheckPushClaim(claim, now)).toBeUndefined();
        await subscribe(owners[2]);
        const selected = (await repos.claimPushOpening(
          id,
          1,
          owners[2]!,
          now,
        ))!;
        const snapshot = (await repos.getJokerSnapshot(id, now, owners[2]))!;
        await repos.getJokerSnapshot(id, now, owners[2], {
          ownerUserId: owners[2]!,
          day: 1,
          ...snapshot.windows[0]!.targets[0]!,
          expectedRevision: 0,
          requestId: randomUUID(),
        });
        expect(await repos.recheckPushClaim(selected, now)).toBeUndefined();
        await subscribe(owners[3]);
        time = "2026-05-10T03:00:00.000Z";
        expect(
          await repos.claimPushOpening(id, 1, owners[3]!, now),
        ).toBeUndefined();
        await repos.setPushPilotEnabled(id, false);
        expect(
          await repos.claimPushOpening(id, 2, owners[3]!, now),
        ).toBeUndefined();
      });
      it("cleans expired capabilities and statuses without resetting aggregate caps", async () => {
        await subscribe();
        const claim = (await repos.claimPushOpening(id, 1, owners[0]!, now))!;
        await repos.recheckPushClaim(claim, now);
        await repos.finishPushAttempt(claim, "unknown");
        time = "2026-05-31T14:59:59.999Z";
        expect((await repos.cleanPushRetention(id, now)).subscriptions).toBe(0);
        time = "2026-05-31T15:00:00.000Z";
        expect((await repos.cleanPushRetention(id, now)).subscriptions).toBe(1);
        expect(
          (await repos.getPushPreferences(id, owners[0]!, now)).available,
        ).toBe(false);
        time = "2026-06-09T01:59:59.999Z";
        expect((await repos.cleanPushRetention(id, now)).statuses).toBe(0);
        time = "2026-06-09T02:00:00.000Z";
        expect((await repos.cleanPushRetention(id, now)).statuses).toBe(1);
        const [pilot] = await query(
          sql`SELECT * FROM push_pilots WHERE basho_id=${id}`,
        );
        expect(Number(pilot!.total_attempts)).toBe(1);
      });
      it("keeps the per-day quota when delivery statuses are removed", async () => {
        await subscribe();
        expect(
          await repos.claimPushOpening(id, 1, owners[0]!, now),
        ).toBeDefined();
        // Simulate status retention independently of the active window's clock.
        await query(
          sql`DELETE FROM push_openings WHERE basho_id=${id} RETURNING id`,
        );
        expect(
          await other.claimPushOpening(id, 1, owners[0]!, now),
        ).toBeUndefined();
        const [pilot] = await query(
          sql`SELECT * FROM push_pilots WHERE basho_id=${id}`,
        );
        expect(Number(pilot!.total_attempts)).toBe(1);
      });
      it("serializes a cross-pilot owner replacement without a stale overwrite", async () => {
        const second = "next-pilot";
        await repos.upsertBasho({
          id: second,
          isDemo: true,
          name: "Next",
          startDate: "2026-05-10",
          endDate: "2026-05-24",
          status: "upcoming",
        });
        await repos.preparePushPilot(second, owners);
        await repos.setPushPilotEnabled(second, true);
        const results = await Promise.allSettled([
          subscribe(),
          other.savePushSubscription(
            second,
            owners[0]!,
            "second-device",
            null,
            data(),
            now,
          ),
        ]);
        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      });
    },
  );
