import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDatabaseClient, type DatabaseClient } from "./client.js";
import { createRepositories, type Repositories } from "./repositories.js";
import { runMigrations } from "./migrate.js";
import { seedDemoDatabase } from "./seed.js";
import { startDemoBasho, advanceDemoBashoDay } from "./demo-progression.js";
import type { JokerCommand, JokerSnapshot } from "./joker-repositories.js";
const id = "demo-2026-05";
const wall = () => new Date("2026-11-01T10:30:00.000Z");
const postgresUrl = process.env.JOKER_TEST_POSTGRES_URL;
for (const provider of ["sqlite", "postgres"] as const)
  describe.skipIf(provider === "postgres" && !postgresUrl)(
    `joker transactions (${provider})`,
    () => {
      let client: DatabaseClient,
        peer: DatabaseClient,
        repos: Repositories,
        peerRepos: Repositories,
        directory: string;
      async function query(statement: ReturnType<typeof sql>) {
        return client.provider === "sqlite"
          ? client.db.all(statement)
          : client.db.execute(statement);
      }
      async function state() {
        return (await repos.getJokerSnapshot(id, wall, "alice"))!;
      }
      function command(
        snapshot: JokerSnapshot,
        day: number,
        extra: Partial<JokerCommand> = {},
      ): JokerCommand {
        const target = snapshot.windows[day - 1]!.targets[0]!;
        return {
          ownerUserId: "alice",
          day,
          ...target,
          expectedRevision:
            snapshot.allocations.find((a) => a.day === day)?.revision ?? 0,
          requestId: randomUUID(),
          ...extra,
        };
      }
      async function apply(c: JokerCommand) {
        return (await repos.getJokerSnapshot(id, wall, "alice", c))!;
      }
      beforeEach(async () => {
        if (provider === "postgres") {
          const url = new URL(postgresUrl!);
          if (
            !["localhost", "127.0.0.1"].includes(url.hostname) ||
            url.port !== "55434"
          )
            throw new Error(
              "Use only the dedicated local joker test Postgres on55434.",
            );
        }
        directory = mkdtempSync(join(tmpdir(), "joker-parity-"));
        const url =
          provider === "sqlite"
            ? `file:${join(directory, "test.sqlite")}`
            : postgresUrl!;
        client = createDatabaseClient(url);
        peer = createDatabaseClient(url);
        peerRepos = createRepositories(peer);
        await runMigrations(client);
        repos = createRepositories(client);
        await repos.resetAllDataForLocalFixtures();
        await seedDemoDatabase(repos);
        await repos.insertFantasyTeamWithPicksIfBashoUpcoming(
          {
            id: "owned",
            bashoId: id,
            displayName: "Owned",
            ownerUserId: "alice",
          },
          [
            { teamId: "owned", rikishiId: "onosato" },
            { teamId: "owned", rikishiId: "ura" },
          ],
        );
        await repos.configureDemoJokers(undefined, wall);
        await startDemoBasho(repos, wall);
      });
      afterEach(async () => {
        await peer.close();
        await client.close();
        rmSync(directory, { recursive: true, force: true });
      });
      it("rejects unowned/stale matchups and stale revisions; replays commands once", async () => {
        const initial = await state();
        const c = command(initial, 1);
        const saved = await apply(c);
        expect(saved.remaining).toBe(2);
        expect(await apply(c)).toEqual(saved);
        await expect(apply({ ...c, requestId: randomUUID() })).rejects.toThrow(
          "stale-revision",
        );
        await expect(apply({ ...c, rikishiId: "hoshoryu" })).rejects.toThrow(
          "request-id-reused",
        );
        await expect(
          apply(command(saved, 1, { opponentId: "changed" })),
        ).rejects.toThrow("stale-or-unowned");
        await expect(
          apply(command(saved, 1, { rikishiId: "hoshoryu" })),
        ).rejects.toThrow("stale-or-unowned");
        await expect(repos.getJokerSnapshot(id, wall, "bob")).rejects.toThrow(
          "team-not-found",
        );
        await expect(
          apply({ ...command(saved, 1), ownerUserId: "bob" }),
        ).rejects.toThrow("not-owner");
        await expect(
          query(
            sql`UPDATE joker_events SET fingerprint='tampered' WHERE request_id=${c.requestId} RETURNING id`,
          ),
        ).rejects.toThrow();
        const audit = await query(
          sql`SELECT * FROM joker_events WHERE request_id=${c.requestId}`,
        );
        expect(audit.length).toBe(1);
      });
      it("serializes same-day writes and pending reservations across days within the budget", async () => {
        await query(
          sql`UPDATE scheduled_bout_publications SET published_at='2026-05-09T08:00:00.000Z' WHERE basho_id=${id} RETURNING day`,
        );
        const s = await state();
        const attempts = await Promise.allSettled(
          [1, 2, 3, 4].map((day) =>
            (day % 2 ? repos : peerRepos).getJokerSnapshot(
              id,
              wall,
              "alice",
              command(s, day),
            ),
          ),
        );
        expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(
          3,
        );
        let current = await state();
        expect(current.remaining).toBe(0);
        expect(current.allocations).toHaveLength(3);
        const day = current.allocations[0]!.day;
        current = await apply(
          command(current, day, {
            rikishiId: null,
            boutId: null,
            opponentId: null,
          }),
        );
        expect(current.remaining).toBe(1);
        const same = await Promise.allSettled([
          apply(command(current, day)),
          peerRepos.getJokerSnapshot(id, wall, "alice", command(current, day)),
        ]);
        expect(same.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect((await state()).remaining).toBe(0);
      });
      it("enforces the exact deadline, cannot rewind, and preserves locked targets", async () => {
        let current = await apply(command(await state(), 1));
        await repos.configureDemoJokers("2026-05-10T03:00:00.000Z", wall);
        current = await state();
        expect(current.allocations[0]?.state).toBe("locked");
        await expect(
          apply(
            command(current, 1, {
              rikishiId: null,
              boutId: null,
              opponentId: null,
            }),
          ),
        ).rejects.toThrow("window-not-open");
        await expect(
          repos.configureDemoJokers("2026-05-10T02:59:59.999Z", wall),
        ).rejects.toThrow("clock-cannot-rewind");
        expect((await state()).allocations[0]?.rikishiId).toBe(
          current.allocations[0]?.rikishiId,
        );
      });
      it("refunds a verified fusen then exposes a later correction conflict without deleting accepted choices", async () => {
        await query(
          sql`UPDATE scheduled_bout_publications SET published_at='2026-05-09T08:00:00.000Z' WHERE basho_id=${id} RETURNING day`,
        );
        const first = await apply(command(await state(), 1));
        await repos.configureDemoJokers("2026-05-10T04:00:00.000Z", wall);
        await advanceDemoBashoDay(repos, wall);
        expect((await state()).allocations[0]?.state).toBe("consumed");
        const allocation = first.allocations[0]!;
        const result = (await repos.listBoutResultsForBasho(id)).find((r) =>
          [r.winnerRikishiId, r.loserRikishiId].includes(allocation.rikishiId),
        )!;
        await repos.upsertBoutResult({ ...result, kimarite: "fusen" });
        let s = await state();
        expect(s.allocations[0]?.state).toBe("refunded");
        expect(s.remaining).toBe(3);
        for (const day of [2, 3, 4]) s = await apply(command(s, day));
        await repos.upsertBoutResult(result);
        s = await state();
        expect(s.budgetDiscrepancy).toBe(true);
        expect(s.allocations).toHaveLength(4);
        await expect(apply(command(s, 5))).rejects.toThrow(
          "joker-budget-exhausted",
        );
        s = await apply(
          command(s, 4, { rikishiId: null, boutId: null, opponentId: null }),
        );
        expect(s.budgetDiscrepancy).toBe(false);
        expect(s.allocations).toHaveLength(4);
        const events = await query(
          sql`SELECT * FROM joker_events WHERE fingerprint='reconcile'`,
        );
        expect(events.length).toBeGreaterThanOrEqual(3);
      });
      it("refunds an attested schedule cancellation without consuming the retained old result", async () => {
        const selected = await apply(command(await state(), 1));
        const allocation = selected.allocations[0]!;
        await repos.configureDemoJokers("2026-05-10T04:00:00.000Z", wall);
        await advanceDemoBashoDay(repos, wall);
        expect((await state()).allocations[0]?.state).toBe("consumed");
        const results = await repos.listBoutResultsForBasho(id);
        const bouts = (await repos.listScheduledBoutsForBasho(id)).filter(
          (b) => b.day === 1,
        );
        const publication = (
          await repos.listScheduledBoutPublicationsForBasho(id)
        ).find((p) => p.day === 1)!;
        expect(
          await repos.applyScheduledBoutsImport({
            publication: { ...publication, source: "demo:complete" },
            bouts: bouts.map((b) =>
              b.id === allocation.boutId ? { ...b, status: "cancelled" } : b,
            ),
          }),
        ).toBe("applied");
        expect(await repos.listBoutResultsForBasho(id)).toEqual(results);
        const reconciled = await state();
        expect(reconciled.allocations[0]?.state).toBe("refunded");
        expect(reconciled.remaining).toBe(3);
        expect((await state()).allocations).toEqual(reconciled.allocations);
        const events = await query(
          sql`SELECT * FROM joker_events WHERE fingerprint='reconcile'`,
        );
        expect(events.length).toBe(3); // locked -> consumed -> refunded, once each.
      });
      it("keeps a removed original matchup pending even when its old result remains", async () => {
        const selected = await apply(command(await state(), 1));
        const allocation = selected.allocations[0]!;
        await repos.configureDemoJokers("2026-05-10T04:00:00.000Z", wall);
        await advanceDemoBashoDay(repos, wall);
        expect((await state()).allocations[0]?.state).toBe("consumed");
        const results = await repos.listBoutResultsForBasho(id);
        const bouts = (await repos.listScheduledBoutsForBasho(id)).filter(
          (b) => b.day === 1 && b.id !== allocation.boutId,
        );
        const publication = (
          await repos.listScheduledBoutPublicationsForBasho(id)
        ).find((p) => p.day === 1)!;
        expect(
          await repos.applyScheduledBoutsImport({
            publication: { ...publication, source: "demo:complete" },
            bouts,
          }),
        ).toBe("applied");
        expect(await repos.listBoutResultsForBasho(id)).toEqual(results);
        const reconciled = await state();
        expect(reconciled.allocations[0]?.state).toBe("locked");
        expect(reconciled.remaining).toBe(2);
        expect((await state()).allocations).toEqual(reconciled.allocations);
      });
      it("does not enable a live collision, resets only demo trial data, and keeps the old schema API usable", async () => {
        await repos.upsertBasho({
          id: "live",
          name: "Live",
          isDemo: false,
          startDate: "2026-05-10",
          endDate: "2026-05-24",
          status: "upcoming",
        });
        expect(await repos.getJokerSnapshot("live", wall)).toBeUndefined();
        await seedDemoDatabase(repos);
        expect(await repos.getJokerSnapshot(id, wall)).toBeUndefined();
        expect(await repos.getBasho("live")).toBeDefined();
        await repos.updateBasho({
          ...(await repos.getBasho(id))!,
          isDemo: false,
        });
        await expect(
          repos.configureDemoJokers(undefined, wall),
        ).rejects.toThrow("demo-only");
      });
      it("keeps the trial base in sync before lock and frozen after start", async () => {
        await seedDemoDatabase(repos);
        await repos.configureDemoJokers(undefined, wall);
        expect(await repos.setBashoScoringMode(id, "achievements-v1")).toBe(
          "updated",
        );
        expect((await repos.getJokerSnapshot(id, wall))?.trial.baseMode).toBe(
          "achievements-v1",
        );
        await startDemoBasho(repos, wall);
        expect(await repos.setBashoScoringMode(id, "wins-v0")).toBe("locked");
      });
    },
  );
