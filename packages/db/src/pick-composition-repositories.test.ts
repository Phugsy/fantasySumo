import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "./client.js";
import { createRepositories, type Repositories } from "./repositories.js";
import { runMigrations } from "./migrate.js";
import {
  demoBanzukeEntries,
  demoBasho,
  demoRikishi,
} from "./demo-seed-data.js";

const postgresUrl = process.env.PICK_COMPOSITION_TEST_POSTGRES_URL;
const basho = {
  ...demoBasho,
  id: "2027-01",
  isDemo: false,
  startDate: "2027-01-10",
  endDate: "2027-01-24",
};
const roster = demoBanzukeEntries.map((entry) => ({
  ...entry,
  id: `${basho.id}-${entry.rikishiId}`,
  bashoId: basho.id,
}));
const team = {
  id: "owned",
  bashoId: basho.id,
  ownerUserId: "alice",
  displayName: "Original",
};
const picks = (ids: string[]) =>
  ids.map((rikishiId) => ({ teamId: team.id, rikishiId }));

for (const provider of ["sqlite", "postgres"] as const) {
  describe.skipIf(provider === "postgres" && !postgresUrl)(
    `selection transactions (${provider})`,
    () => {
      let client: DatabaseClient,
        peer: DatabaseClient,
        repos: Repositories,
        other: Repositories,
        directory: string;
      beforeEach(async () => {
        if (provider === "postgres") {
          const url = new URL(postgresUrl!);
          if (
            !["localhost", "127.0.0.1"].includes(url.hostname) ||
            url.port !== "55435" ||
            url.pathname !== "/fantasy_sumo_selection_test"
          )
            throw new Error(
              "Use only the disposable local selection test Postgres on 55435.",
            );
        }
        directory = mkdtempSync(join(tmpdir(), "selection-parity-"));
        const url =
          provider === "sqlite"
            ? `file:${join(directory, "test.sqlite")}`
            : postgresUrl!;
        client = createDatabaseClient(url);
        peer = createDatabaseClient(url);
        repos = createRepositories(client);
        other = createRepositories(peer);
        await runMigrations(client);
        await repos.resetAllDataForLocalFixtures();
        await repos.applyBanzukeImport({
          basho,
          rikishi: demoRikishi,
          banzukeEntries: roster,
        });
        await repos.setBashoGameConfigIfConfigurable(
          { bashoId: basho.id, teamSize: 3 },
          2,
        );
      });
      afterEach(async () => {
        await peer?.close();
        await client?.close();
        if (directory) rmSync(directory, { recursive: true, force: true });
      });

      it("accepts two sanyaku with distinct heyas and rejects both invalid creates atomically", async () => {
        for (const [ids, code] of [
          [["onosato", "hoshoryu", "kotozakura"], "sanyaku-limit"],
          [["kirishima", "tobizaru", "ura"], "duplicate-heya"],
        ] as const) {
          expect(
            await repos.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
              team,
              picks([...ids]),
            ),
          ).toMatchObject({ status: "invalid-picks", errors: [{ code }] });
          expect(
            await repos.getFantasyTeamForOwner(basho.id, "alice"),
          ).toBeUndefined();
          expect(
            await repos.insertFantasyTeamWithPicksIfBashoUpcoming(
              team,
              picks([...ids]),
            ),
          ).toBe(false);
        }
        expect(
          await repos.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
            team,
            picks(["onosato", "hoshoryu", "ura"]),
          ),
        ).toMatchObject({ status: "saved" });
      });

      it("preserves the previous team name and picks when replacement is rejected", async () => {
        await repos.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
          team,
          picks(["onosato", "hoshoryu", "ura"]),
        );
        const previous = await repos.listFantasyPicksForTeam(team.id);
        expect(
          await repos.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
            { ...team, displayName: "Rejected" },
            picks(["kirishima", "tobizaru", "ura"]),
          ),
        ).toMatchObject({ status: "invalid-picks" });
        expect(await repos.getFantasyTeam(team.id)).toMatchObject({
          displayName: "Original",
        });
        expect(await repos.listFantasyPicksForTeam(team.id)).toEqual(previous);
      });

      it("uses the latest banzuke snapshot, ignoring mutable global heya metadata", async () => {
        await other.upsertRikishi({ ...demoRikishi[0]!, heya: "Tatsunami" });
        expect(
          await repos.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
            team,
            picks(["onosato", "hoshoryu", "ura"]),
          ),
        ).toMatchObject({ status: "saved" });
        const stale = await repos.listBanzukeEntriesForBasho(basho.id);
        await other.applyBanzukeImport({
          basho,
          rikishi: [],
          banzukeEntries: stale.map((entry) =>
            entry.rikishiId === "ura"
              ? { ...entry, heya: "Nishonoseki-beya" }
              : entry,
          ),
        });
        expect(
          await repos.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
            team,
            picks(["onosato", "hoshoryu", "ura"]),
          ),
        ).toMatchObject({
          status: "invalid-picks",
          errors: [{ code: "duplicate-heya" }],
        });
      });

      it("fails closed on missing snapshot heya even if global metadata exists", async () => {
        await other.applyBanzukeImport({
          basho,
          rikishi: [],
          banzukeEntries: roster.filter((entry) => entry.rikishiId !== "ura"),
        });
        await other.applyBanzukeImport({
          basho,
          rikishi: [],
          banzukeEntries: roster.map((entry) =>
            entry.rikishiId === "ura" ? { ...entry, heya: undefined } : entry,
          ),
        });
        expect(
          await repos.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
            team,
            picks(["onosato", "hoshoryu", "ura"]),
          ),
        ).toMatchObject({
          status: "invalid-picks",
          errors: [{ code: "invalid-selection-data" }],
        });
      });

      it("preserves existing tournament rules even when imports change the start date", async () => {
        const legacy = { ...basho, id: "2026-11" };
        await repos.applyBanzukeImport({
          basho: legacy,
          rikishi: [],
          banzukeEntries: roster.map((entry) => ({
            ...entry,
            id: `legacy-${entry.rikishiId}`,
            bashoId: legacy.id,
          })),
        });
        expect(
          await repos.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
            { ...team, id: "legacy", bashoId: legacy.id },
            picks(["onosato", "hoshoryu", "kotozakura"]),
            3,
          ),
        ).toMatchObject({ status: "saved" });
      });

      it.each(["banzuke", "lifecycle"])(
        "serializes a save with a concurrent %s update",
        async (change) => {
          if (client.provider !== "postgres" || peer.provider !== "postgres") {
            if (change === "lifecycle") {
              await other.updateBasho({ ...basho, status: "locked" });
            } else {
              await other.applyBanzukeImport({
                basho,
                rikishi: [],
                banzukeEntries: roster.map((entry) =>
                  entry.rikishiId === "ura"
                    ? { ...entry, heya: "Tatsunami" }
                    : entry,
                ),
              });
            }
            expect(
              await repos.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
                team,
                picks(["onosato", "hoshoryu", "ura"]),
              ),
            ).toMatchObject({
              status: change === "lifecycle" ? "picks-locked" : "invalid-picks",
            });
            return;
          }
          const [{ pid }] = await client.sql<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;
          let pending:
            | ReturnType<
                Repositories["saveOwnedFantasyTeamWithPicksIfBashoUpcoming"]
              >
            | undefined;
          await peer.sql.begin(async (sql) => {
            await sql`UPDATE basho SET name = name WHERE id = ${basho.id}`;
            if (change === "lifecycle")
              await sql`UPDATE basho SET status = 'locked' WHERE id = ${basho.id}`;
            else
              await sql`UPDATE banzuke_entries SET heya = 'Tatsunami' WHERE basho_id = ${basho.id} AND rikishi_id = 'ura'`;
            pending = repos.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
              team,
              picks(["onosato", "hoshoryu", "ura"]),
            );
            let blocked = false;
            for (let attempt = 0; attempt < 100; attempt++) {
              const [state] =
                await sql`SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${pid!}`;
              if (state?.wait_event_type === "Lock") {
                blocked = true;
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 5));
            }
            expect(blocked).toBe(true);
          });
          expect(await pending).toMatchObject({
            status: change === "lifecycle" ? "picks-locked" : "invalid-picks",
          });
          expect(
            await repos.getFantasyTeamForOwner(basho.id, "alice"),
          ).toBeUndefined();
        },
      );
    },
  );
}
