import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { createDatabaseClient, type DatabaseClient } from "./client.js";
import { createRepositories, type Repositories } from "./repositories.js";
import { runMigrations } from "./migrate.js";
import { seedDemoDatabase } from "./seed.js";
import { startDemoBasho, advanceDemoBashoDay } from "./demo-progression.js";
import type { JokerCommand, JokerSnapshot } from "./joker-repositories.js";
import { SUMO_API_PRE_BOUT_SOURCE } from "@fantasy-sumo/domain";
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
      it("loads tournament picks in one query with matching order and no cross-basho leakage", async () => {
        await november();
        const teams = await repos.listFantasyTeamsForBasho(id);
        const expected = (
          await Promise.all(
            teams.map((team) => repos.listFantasyPicksForTeam(team.id)),
          )
        ).flat();
        let count = 0;
        const sqlite = client.provider === "sqlite" ? client.sqlite : undefined;
        const prepare = sqlite?.prepare.bind(sqlite);
        const spy =
          sqlite &&
          vi.spyOn(sqlite, "prepare").mockImplementation((query) => {
            count++;
            return prepare!(query);
          });
        try {
          expect(await repos.listFantasyPicksForBasho(id)).toEqual(expected);
          if (sqlite) expect(count).toBe(1);
        } finally {
          spy?.mockRestore();
        }
        expect(await repos.listFantasyPicksForBasho("missing")).toEqual([]);
      });
      it("preserves allocations and audit when the owner selects achievement focus on both providers", async () => {
        const before = await apply(command(await state(), 1));
        expect(
          await repos.overrideBashoScoringMode(id, "achievements-v2", {
            actorUserId: "owner",
            reason: "Approved achievement-focused scoring",
            expectedMode: "wins-v0",
            changedAt: wall().toISOString(),
          }),
        ).toBe("updated");
        const after = await state();
        expect(after.allocations).toEqual(before.allocations);
        expect(after.trial.baseMode).toBe("achievements-v2");
        expect(await repos.listBashoScoringOverrides(id)).toMatchObject([
          { fromMode: "wins-v0", toMode: "achievements-v2" },
        ]);
        expect(await repos.setBashoScoringMode(id, "achievements-v1")).toBe(
          "locked",
        );
        const live = await november();
        expect(await repos.setBashoScoringMode(live, "achievements-v2")).toBe(
          "updated",
        );
        await repos.lockBashoAndFantasyTeams(live, wall().toISOString());
        expect(
          (
            await repos.enableNovemberJokers(
              live,
              "owner",
              () => new Date("2026-11-07T14:00:00.000Z"),
            )
          ).baseMode,
        ).toBe("achievements-v2");
      });
      it("accepts a verified pre-bout pairing and settles only after result verification", async () => {
        const publication = (
          await repos.listScheduledBoutPublicationsForBasho(id)
        ).find((entry) => entry.day === 1)!;
        const bouts = (await repos.listScheduledBoutsForBasho(id)).filter(
          (entry) => entry.day === 1,
        );
        const preBout = { ...publication, source: SUMO_API_PRE_BOUT_SOURCE };
        await repos.applyScheduledBoutsImport({ publication: preBout, bouts });
        expect((await state()).windows[0]?.status).toBe("open");

        // Even a syntactically valid shorter retry cannot prove the omitted
        // matchups. Keep the fuller display card but suspend joker picks.
        for (const source of [SUMO_API_PRE_BOUT_SOURCE, "sumo-api-schedule"]) {
          expect(
            await repos.applyScheduledBoutsImport({
              publication: { ...publication, source },
              bouts: bouts.slice(0, 1),
            }),
          ).toBe("pre-bout-eligibility-revoked");
          expect(
            (await repos.listScheduledBoutsForBasho(id)).filter(
              (entry) => entry.day === 1,
            ),
          ).toEqual(bouts);
          expect((await state()).windows[0]?.status).toBe("unavailable");
          await repos.applyScheduledBoutsImport({
            publication: preBout,
            bouts,
          });
        }
        const reserved = await apply(command(await state(), 1));
        expect(reserved.allocations[0]?.state).toBe("reserved");
        await repos.configureDemoJokers("2026-05-10T03:00:00.000Z", wall);
        expect((await state()).windows[0]?.status).toBe("closed");
        const results = bouts.map((bout) => ({
          id: `result-${bout.id}`,
          bashoId: id,
          day: 1,
          winnerRikishiId: bout.eastRikishiId,
          loserRikishiId: bout.westRikishiId,
        }));
        for (const result of results) await repos.insertBoutResult(result);
        expect((await state()).allocations[0]?.state).toBe("locked");
        const verified = {
          ...publication,
          source: "sumo-api-schedule:complete",
        };
        await repos.applyScheduledBoutsImport({ publication: verified, bouts });
        expect((await state()).allocations[0]?.state).toBe("consumed");
        expect(
          await repos.applyScheduledBoutsImport({
            publication: preBout,
            bouts,
          }),
        ).toBe("preserved-existing-complete");
        expect((await state()).allocations[0]?.state).toBe("consumed");
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
      async function november() {
        const live = "2026-11";
        await repos.upsertBasho({
          id: live,
          name: "November",
          isDemo: false,
          status: "upcoming",
          startDate: "2026-11-08",
          endDate: "2026-11-22",
          currentDay: 0,
        });
        for (const entry of await repos.listBanzukeEntriesForBasho(id)) {
          await repos.insertBanzukeEntry({
            ...entry,
            id: "live-" + entry.id,
            bashoId: live,
          });
        }
        for (const [teamId, owner] of [
          ["live-alice", "alice"],
          ["live-bob", "bob"],
        ]) {
          await repos.insertFantasyTeamWithPicksIfBashoUpcoming(
            {
              id: teamId!,
              bashoId: live,
              displayName: teamId!,
              ownerUserId: owner!,
            },
            [
              { teamId: teamId!, rikishiId: "onosato" },
              { teamId: teamId!, rikishiId: "ura" },
            ],
          );
        }
        return live;
      }
      it("enables only the November pre-start exception and freezes the unchanged base", async () => {
        const live = await november();
        const before = () => new Date("2026-11-07T14:59:59.000Z");
        await repos.lockBashoAndFantasyTeams(live, before().toISOString());
        const base = await repos.getBashoScoringConfig(live);
        const trial = await repos.enableNovemberJokers(live, "admin", before);
        expect(trial).toMatchObject({
          bashoId: live,
          enabledBy: "admin",
          baseMode: base?.mode,
        });
        expect(await repos.getBashoScoringConfig(live)).toMatchObject({
          locked: true,
          mode: base?.mode,
        });
        expect(await repos.setBashoScoringMode(live, "achievements-v1")).toBe(
          "locked",
        );
        expect((await repos.getBasho(live))?.status).toBe("locked");
        // The previous application checks only its original table and ignores
        // this live opt-in rather than throwing a demo-only scoring error.
        expect(
          await query(
            sql`SELECT * FROM basho_joker_trial WHERE basho_id=${live}`,
          ),
        ).toHaveLength(0);
        expect(
          await repos.enableNovemberJokers(live, "other-admin", wall),
        ).toEqual(trial);
      });
      it("rejects activation at the cutoff, after any result, for other bashos or active play", async () => {
        const live = await november();
        await expect(
          repos.enableNovemberJokers(
            live,
            "admin",
            () => new Date("2026-11-08T03:00:00.000Z"),
          ),
        ).rejects.toThrow("trial-setup-closed");
        await expect(
          repos.enableNovemberJokers(id, "admin", wall),
        ).rejects.toThrow("november-trial-only");
        const before = () => new Date("2026-11-07T10:00:00.000Z");
        await repos.insertBoutResult({
          id: "live-result",
          bashoId: live,
          day: 1,
          winnerRikishiId: "onosato",
          loserRikishiId: "ura",
        });
        await expect(
          repos.enableNovemberJokers(live, "admin", before),
        ).rejects.toThrow("trial-setup-closed");
        expect(await repos.getLiveJokerTrial(live)).toBeUndefined();
      });
      it("uses real server time and keeps live player ownership and cutoff enforcement", async () => {
        const live = await november();
        const before = () => new Date("2026-11-07T10:00:00.000Z");
        await repos.enableNovemberJokers(live, "admin", before);
        await repos.lockBashoAndFantasyTeams(live, before().toISOString());
        await repos.applyScheduledBoutsImport({
          publication: {
            id: "live-card",
            bashoId: live,
            day: 1,
            source: SUMO_API_PRE_BOUT_SOURCE,
            publishedAt: before().toISOString(),
          },
          bouts: [
            {
              id: "live-bout",
              bashoId: live,
              day: 1,
              eastRikishiId: "onosato",
              westRikishiId: "hoshoryu",
              status: "scheduled",
            },
          ],
        });
        const today = () => new Date("2026-11-08T02:59:59.999Z");
        const snapshot = (await repos.getJokerSnapshot(live, today, "alice"))!;
        expect(snapshot.now).toBe(today().toISOString());
        const saved = (await repos.getJokerSnapshot(
          live,
          today,
          "alice",
          command(snapshot, 1),
        ))!;
        expect(saved.remaining).toBe(2);
        expect(
          (await repos.getJokerSnapshot(live, today, "bob"))?.remaining,
        ).toBe(3);
        await expect(
          repos.getJokerSnapshot(live, today, "bob", command(snapshot, 1)),
        ).rejects.toThrow("not-owner");
        await expect(
          repos.getJokerSnapshot(
            live,
            () => new Date("2026-11-08T03:00:00.000Z"),
            "alice",
            {
              ...command(saved, 1),
              rikishiId: null,
              boutId: null,
              opponentId: null,
            },
          ),
        ).rejects.toThrow("window-not-open");
      });
      it("serializes concurrent live activation and keeps its original administrator", async () => {
        const live = await november();
        const before = () => new Date("2026-11-07T10:00:00.000Z");
        const [first, second] = await Promise.all([
          repos.enableNovemberJokers(live, "admin-a", before),
          peerRepos.enableNovemberJokers(live, "admin-b", before),
        ]);
        expect(first).toEqual(second);
        expect(
          await query(
            sql`SELECT * FROM basho_live_joker_trial WHERE basho_id=${live}`,
          ),
        ).toHaveLength(1);
      });
      it.each(["active", "complete", "nonzero-day"] as const)(
        "rejects pre-start activation for %s even without results",
        async (condition) => {
          const live = await november();
          await repos.updateBasho({
            ...(await repos.getBasho(live))!,
            status: condition === "nonzero-day" ? "upcoming" : condition,
            currentDay: condition === "nonzero-day" ? 1 : 0,
          });
          await expect(
            repos.enableNovemberJokers(
              live,
              "admin",
              () => new Date("2026-11-07T10:00:00.000Z"),
            ),
          ).rejects.toThrow("trial-setup-closed");
        },
      );
    },
  );
