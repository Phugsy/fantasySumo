import { and, eq, isNull, notInArray } from "drizzle-orm";
import type {
  BanzukeEntry,
  Basho,
  BoutResult,
  FantasyPick,
  FantasyTeam,
  Rikishi,
} from "@fantasy-sumo/domain";
import { preserveBashoLifecycleProgress } from "@fantasy-sumo/domain";
import type {
  AppDatabase,
  PostgresDatabase,
  SqliteDatabase,
} from "./client.js";
import { DEMO_BASHO_ID } from "./demo-constants.js";
import * as pg from "./schema.pg.js";
import * as sqlite from "./schema.js";

export interface BanzukeImportData {
  basho: Basho;
  rikishi: readonly Rikishi[];
  banzukeEntries: readonly BanzukeEntry[];
}

export interface BoutResultsImportData {
  basho?: Basho;
  bashoId: Basho["id"];
  day: BoutResult["day"];
  rikishi?: readonly Rikishi[];
  results: readonly BoutResult[];
}

export interface DemoBashoResetData extends BanzukeImportData {
  fantasyTeams: readonly FantasyTeam[];
  fantasyPicks: readonly FantasyPick[];
  boutResults: readonly BoutResult[];
}

export interface Repositories {
  /** Clears every game record. Production and admin paths must never call this. */
  resetAllDataForLocalFixtures: () => Promise<void>;
  replaceDemoBashoData: (resetData: DemoBashoResetData) => Promise<void>;

  insertBasho: (entry: Basho) => Promise<void>;
  upsertBasho: (entry: Basho) => Promise<void>;
  listBashos: () => Promise<Basho[]>;
  getBasho: (id: Basho["id"]) => Promise<Basho | undefined>;
  updateBasho: (entry: Basho) => Promise<void>;

  insertRikishi: (entry: Rikishi) => Promise<void>;
  upsertRikishi: (entry: Rikishi) => Promise<void>;
  listRikishi: () => Promise<Rikishi[]>;

  insertBanzukeEntry: (entry: BanzukeEntry) => Promise<void>;
  upsertBanzukeEntry: (entry: BanzukeEntry) => Promise<void>;
  listBanzukeEntriesForBasho: (bashoId: Basho["id"]) => Promise<BanzukeEntry[]>;

  insertFantasyTeam: (entry: FantasyTeam) => Promise<void>;
  insertFantasyTeamWithPicksIfBashoUpcoming: (
    team: FantasyTeam,
    picks: readonly FantasyPick[],
  ) => Promise<boolean>;
  getFantasyTeam: (id: FantasyTeam["id"]) => Promise<FantasyTeam | undefined>;
  listFantasyTeamsForBasho: (bashoId: Basho["id"]) => Promise<FantasyTeam[]>;
  lockFantasyTeamsForBasho: (
    bashoId: Basho["id"],
    lockedAt: NonNullable<FantasyTeam["lockedAt"]>,
  ) => Promise<void>;
  lockBashoAndFantasyTeams: (
    bashoId: Basho["id"],
    lockedAt: NonNullable<FantasyTeam["lockedAt"]>,
  ) => Promise<void>;

  insertFantasyPick: (entry: FantasyPick) => Promise<void>;
  listFantasyPicksForTeam: (
    teamId: FantasyTeam["id"],
  ) => Promise<FantasyPick[]>;
  listFantasyPicksForBasho: (bashoId: Basho["id"]) => Promise<FantasyPick[]>;

  insertBoutResult: (entry: BoutResult) => Promise<void>;
  upsertBoutResult: (entry: BoutResult) => Promise<void>;
  listBoutResultsForBasho: (bashoId: Basho["id"]) => Promise<BoutResult[]>;
  deleteBoutResultsForBasho: (bashoId: Basho["id"]) => Promise<void>;
  applyBanzukeImport: (importData: BanzukeImportData) => Promise<void>;
  applyBoutResultsImport: (importData: BoutResultsImportData) => Promise<void>;
}

export function createRepositories(database: AppDatabase): Repositories {
  if (database.provider === "postgres") {
    return createPostgresRepositories(database.db);
  }

  return createSqliteRepositories(database.db);
}

function createSqliteRepositories(db: SqliteDatabase): Repositories {
  const repositories: Repositories = {
    resetAllDataForLocalFixtures: async () => {
      db.delete(sqlite.fantasyPicks).run();
      db.delete(sqlite.fantasyTeams).run();
      db.delete(sqlite.boutResults).run();
      db.delete(sqlite.banzukeEntries).run();
      db.delete(sqlite.rikishi).run();
      db.delete(sqlite.basho).run();
    },
    replaceDemoBashoData: async (resetData) => {
      assertDemoBashoResetData(resetData);

      db.transaction((transaction) => {
        const existingBasho = transaction
          .select({ isDemo: sqlite.basho.isDemo })
          .from(sqlite.basho)
          .where(eq(sqlite.basho.id, resetData.basho.id))
          .get();

        if (existingBasho !== undefined && !existingBasho.isDemo) {
          throw new Error(
            `Refusing to replace live basho ${resetData.basho.id} with demo data.`,
          );
        }

        transaction
          .delete(sqlite.basho)
          .where(
            and(
              eq(sqlite.basho.id, resetData.basho.id),
              eq(sqlite.basho.isDemo, true),
            ),
          )
          .run();

        for (const entry of resetData.rikishi) {
          transaction
            .insert(sqlite.rikishi)
            .values(toRikishiRow(entry))
            .onConflictDoNothing({ target: sqlite.rikishi.id })
            .run();
        }

        transaction
          .insert(sqlite.basho)
          .values(toBashoRow(resetData.basho))
          .run();

        for (const entry of resetData.banzukeEntries) {
          transaction.insert(sqlite.banzukeEntries).values(entry).run();
        }

        for (const entry of resetData.fantasyTeams) {
          transaction
            .insert(sqlite.fantasyTeams)
            .values(toFantasyTeamRow(entry))
            .run();
        }

        for (const entry of resetData.fantasyPicks) {
          transaction
            .insert(sqlite.fantasyPicks)
            .values(toFantasyPickRow(entry))
            .run();
        }

        for (const entry of resetData.boutResults) {
          transaction
            .insert(sqlite.boutResults)
            .values(toBoutResultRow(entry))
            .run();
        }
      });
    },
    insertBasho: async (entry) => {
      db.insert(sqlite.basho).values(toBashoRow(entry)).run();
    },
    upsertBasho: async (entry) => {
      db.insert(sqlite.basho)
        .values(toBashoRow(entry))
        .onConflictDoUpdate({
          target: sqlite.basho.id,
          set: toBashoRow(entry),
        })
        .run();
    },
    listBashos: async () =>
      db
        .select()
        .from(sqlite.basho)
        .orderBy(sqlite.basho.startDate)
        .all()
        .map(toBasho),
    getBasho: async (id) =>
      toOptionalBasho(
        db.select().from(sqlite.basho).where(eq(sqlite.basho.id, id)).get(),
      ),
    updateBasho: async (entry) => {
      db.update(sqlite.basho)
        .set(toBashoRow(entry))
        .where(eq(sqlite.basho.id, entry.id))
        .run();
    },

    insertRikishi: async (entry) => {
      db.insert(sqlite.rikishi).values(toRikishiRow(entry)).run();
    },
    upsertRikishi: async (entry) => {
      db.insert(sqlite.rikishi)
        .values(toRikishiRow(entry))
        .onConflictDoUpdate({
          target: sqlite.rikishi.id,
          set: toRikishiRow(entry),
        })
        .run();
    },
    listRikishi: async () =>
      db
        .select()
        .from(sqlite.rikishi)
        .orderBy(sqlite.rikishi.shikona)
        .all()
        .map(toRikishi),

    insertBanzukeEntry: async (entry) => {
      db.insert(sqlite.banzukeEntries).values(entry).run();
    },
    upsertBanzukeEntry: async (entry) => {
      db.insert(sqlite.banzukeEntries)
        .values(entry)
        .onConflictDoUpdate({
          target: sqlite.banzukeEntries.id,
          set: entry,
        })
        .run();
    },
    listBanzukeEntriesForBasho: async (bashoId) =>
      db
        .select()
        .from(sqlite.banzukeEntries)
        .where(eq(sqlite.banzukeEntries.bashoId, bashoId))
        .orderBy(sqlite.banzukeEntries.rankOrder)
        .all(),

    insertFantasyTeam: async (entry) => {
      db.insert(sqlite.fantasyTeams).values(toFantasyTeamRow(entry)).run();
    },
    insertFantasyTeamWithPicksIfBashoUpcoming: async (team, picks) =>
      db.transaction((transaction) => {
        const basho = transaction
          .select({ status: sqlite.basho.status })
          .from(sqlite.basho)
          .where(eq(sqlite.basho.id, team.bashoId))
          .get();

        if (basho?.status !== "upcoming") {
          return false;
        }

        transaction
          .insert(sqlite.fantasyTeams)
          .values(toFantasyTeamRow(team))
          .run();

        for (const pick of picks) {
          transaction
            .insert(sqlite.fantasyPicks)
            .values(toFantasyPickRow(pick))
            .run();
        }

        return true;
      }),
    getFantasyTeam: async (id) => {
      const row = db
        .select()
        .from(sqlite.fantasyTeams)
        .where(eq(sqlite.fantasyTeams.id, id))
        .get();

      return row === undefined ? undefined : toFantasyTeam(row);
    },
    listFantasyTeamsForBasho: async (bashoId) =>
      db
        .select()
        .from(sqlite.fantasyTeams)
        .where(eq(sqlite.fantasyTeams.bashoId, bashoId))
        .orderBy(sqlite.fantasyTeams.displayName)
        .all()
        .map(toFantasyTeam),
    lockFantasyTeamsForBasho: async (bashoId, lockedAt) => {
      db.update(sqlite.fantasyTeams)
        .set({ lockedAt })
        .where(
          and(
            eq(sqlite.fantasyTeams.bashoId, bashoId),
            isNull(sqlite.fantasyTeams.lockedAt),
          ),
        )
        .run();
    },
    lockBashoAndFantasyTeams: async (bashoId, lockedAt) => {
      db.transaction((transaction) => {
        transaction
          .update(sqlite.basho)
          .set({ status: "locked" })
          .where(
            and(
              eq(sqlite.basho.id, bashoId),
              eq(sqlite.basho.status, "upcoming"),
            ),
          )
          .run();
        transaction
          .update(sqlite.fantasyTeams)
          .set({ lockedAt })
          .where(
            and(
              eq(sqlite.fantasyTeams.bashoId, bashoId),
              isNull(sqlite.fantasyTeams.lockedAt),
            ),
          )
          .run();
      });
    },

    insertFantasyPick: async (entry) => {
      db.insert(sqlite.fantasyPicks).values(toFantasyPickRow(entry)).run();
    },
    listFantasyPicksForTeam: async (teamId) =>
      db
        .select()
        .from(sqlite.fantasyPicks)
        .where(eq(sqlite.fantasyPicks.teamId, teamId))
        .orderBy(sqlite.fantasyPicks.id)
        .all()
        .map(toFantasyPick),
    listFantasyPicksForBasho: async (bashoId) => {
      const teams = await repositories.listFantasyTeamsForBasho(bashoId);
      const picks = await Promise.all(
        teams.map((team) => repositories.listFantasyPicksForTeam(team.id)),
      );

      return picks.flat();
    },

    insertBoutResult: async (entry) => {
      db.insert(sqlite.boutResults).values(toBoutResultRow(entry)).run();
    },
    upsertBoutResult: async (entry) => {
      db.insert(sqlite.boutResults)
        .values(toBoutResultRow(entry))
        .onConflictDoUpdate({
          target: sqlite.boutResults.id,
          set: toBoutResultRow(entry),
        })
        .run();
    },
    listBoutResultsForBasho: async (bashoId) =>
      db
        .select()
        .from(sqlite.boutResults)
        .where(eq(sqlite.boutResults.bashoId, bashoId))
        .orderBy(sqlite.boutResults.day)
        .all()
        .map(toBoutResult),
    deleteBoutResultsForBasho: async (bashoId) => {
      db.delete(sqlite.boutResults)
        .where(eq(sqlite.boutResults.bashoId, bashoId))
        .run();
    },
    applyBanzukeImport: async (importData) => {
      db.transaction((transaction) => {
        const existingBasho = transaction
          .select()
          .from(sqlite.basho)
          .where(eq(sqlite.basho.id, importData.basho.id))
          .get();
        const nextBasho = preserveBashoLifecycleProgress(
          existingBasho === undefined ? undefined : toBasho(existingBasho),
          importData.basho,
        );

        transaction
          .insert(sqlite.basho)
          .values(toBashoRow(nextBasho))
          .onConflictDoUpdate({
            target: sqlite.basho.id,
            set: toBashoRow(nextBasho),
          })
          .run();

        for (const entry of importData.rikishi) {
          transaction
            .insert(sqlite.rikishi)
            .values(toRikishiRow(entry))
            .onConflictDoUpdate({
              target: sqlite.rikishi.id,
              set: toRikishiRow(entry),
            })
            .run();
        }

        for (const entry of importData.banzukeEntries) {
          transaction
            .insert(sqlite.banzukeEntries)
            .values(entry)
            .onConflictDoUpdate({
              target: sqlite.banzukeEntries.id,
              set: entry,
            })
            .run();
        }

        if (importData.banzukeEntries.length > 0) {
          transaction
            .delete(sqlite.banzukeEntries)
            .where(
              and(
                eq(sqlite.banzukeEntries.bashoId, importData.basho.id),
                notInArray(
                  sqlite.banzukeEntries.id,
                  importData.banzukeEntries.map((entry) => entry.id),
                ),
              ),
            )
            .run();
        }
      });
    },
    applyBoutResultsImport: async (importData) => {
      db.transaction((transaction) => {
        if (importData.basho !== undefined) {
          transaction
            .insert(sqlite.basho)
            .values(toBashoRow(importData.basho))
            .onConflictDoUpdate({
              target: sqlite.basho.id,
              set: toBashoRow(importData.basho),
            })
            .run();
        }

        for (const entry of importData.rikishi ?? []) {
          transaction
            .insert(sqlite.rikishi)
            .values(toRikishiRow(entry))
            .onConflictDoNothing({ target: sqlite.rikishi.id })
            .run();
        }

        for (const entry of importData.results) {
          transaction
            .insert(sqlite.boutResults)
            .values(toBoutResultRow(entry))
            .onConflictDoUpdate({
              target: sqlite.boutResults.id,
              set: toBoutResultRow(entry),
            })
            .run();
        }

        if (importData.results.length > 0) {
          transaction
            .delete(sqlite.boutResults)
            .where(
              and(
                eq(sqlite.boutResults.bashoId, importData.bashoId),
                eq(sqlite.boutResults.day, importData.day),
                notInArray(
                  sqlite.boutResults.id,
                  importData.results.map((entry) => entry.id),
                ),
              ),
            )
            .run();
        }
      });
    },
  };

  return repositories;
}

function createPostgresRepositories(db: PostgresDatabase): Repositories {
  const repositories: Repositories = {
    resetAllDataForLocalFixtures: async () => {
      await db.delete(pg.fantasyPicks);
      await db.delete(pg.fantasyTeams);
      await db.delete(pg.boutResults);
      await db.delete(pg.banzukeEntries);
      await db.delete(pg.rikishi);
      await db.delete(pg.basho);
    },
    replaceDemoBashoData: async (resetData) => {
      assertDemoBashoResetData(resetData);

      await db.transaction(async (transaction) => {
        const existingBasho = (
          await transaction
            .select({ isDemo: pg.basho.isDemo })
            .from(pg.basho)
            .where(eq(pg.basho.id, resetData.basho.id))
            .for("update")
        ).at(0);

        if (existingBasho !== undefined && !existingBasho.isDemo) {
          throw new Error(
            `Refusing to replace live basho ${resetData.basho.id} with demo data.`,
          );
        }

        await transaction
          .delete(pg.basho)
          .where(
            and(eq(pg.basho.id, resetData.basho.id), eq(pg.basho.isDemo, true)),
          );

        for (const entry of resetData.rikishi) {
          await transaction
            .insert(pg.rikishi)
            .values(toRikishiRow(entry))
            .onConflictDoNothing({ target: pg.rikishi.id });
        }

        await transaction.insert(pg.basho).values(toBashoRow(resetData.basho));

        for (const entry of resetData.banzukeEntries) {
          await transaction.insert(pg.banzukeEntries).values(entry);
        }

        for (const entry of resetData.fantasyTeams) {
          await transaction
            .insert(pg.fantasyTeams)
            .values(toFantasyTeamRow(entry));
        }

        for (const entry of resetData.fantasyPicks) {
          await transaction
            .insert(pg.fantasyPicks)
            .values(toFantasyPickRow(entry));
        }

        for (const entry of resetData.boutResults) {
          await transaction
            .insert(pg.boutResults)
            .values(toBoutResultRow(entry));
        }
      });
    },
    insertBasho: async (entry) => {
      await db.insert(pg.basho).values(toBashoRow(entry));
    },
    upsertBasho: async (entry) => {
      await db
        .insert(pg.basho)
        .values(toBashoRow(entry))
        .onConflictDoUpdate({
          target: pg.basho.id,
          set: toBashoRow(entry),
        });
    },
    listBashos: async () =>
      (await db.select().from(pg.basho).orderBy(pg.basho.startDate)).map(
        toBasho,
      ),
    getBasho: async (id) =>
      toOptionalBasho(
        (await db.select().from(pg.basho).where(eq(pg.basho.id, id))).at(0),
      ),
    updateBasho: async (entry) => {
      await db
        .update(pg.basho)
        .set(toBashoRow(entry))
        .where(eq(pg.basho.id, entry.id));
    },

    insertRikishi: async (entry) => {
      await db.insert(pg.rikishi).values(toRikishiRow(entry));
    },
    upsertRikishi: async (entry) => {
      await db
        .insert(pg.rikishi)
        .values(toRikishiRow(entry))
        .onConflictDoUpdate({
          target: pg.rikishi.id,
          set: toRikishiRow(entry),
        });
    },
    listRikishi: async () =>
      (await db.select().from(pg.rikishi).orderBy(pg.rikishi.shikona)).map(
        toRikishi,
      ),

    insertBanzukeEntry: async (entry) => {
      await db.insert(pg.banzukeEntries).values(entry);
    },
    upsertBanzukeEntry: async (entry) => {
      await db.insert(pg.banzukeEntries).values(entry).onConflictDoUpdate({
        target: pg.banzukeEntries.id,
        set: entry,
      });
    },
    listBanzukeEntriesForBasho: async (bashoId) =>
      await db
        .select()
        .from(pg.banzukeEntries)
        .where(eq(pg.banzukeEntries.bashoId, bashoId))
        .orderBy(pg.banzukeEntries.rankOrder),

    insertFantasyTeam: async (entry) => {
      await db.insert(pg.fantasyTeams).values(toFantasyTeamRow(entry));
    },
    insertFantasyTeamWithPicksIfBashoUpcoming: async (team, picks) =>
      db.transaction(async (transaction) => {
        const basho = (
          await transaction
            .select({ status: pg.basho.status })
            .from(pg.basho)
            .where(eq(pg.basho.id, team.bashoId))
            .for("update")
        ).at(0);

        if (basho?.status !== "upcoming") {
          return false;
        }

        await transaction
          .insert(pg.fantasyTeams)
          .values(toFantasyTeamRow(team));

        for (const pick of picks) {
          await transaction
            .insert(pg.fantasyPicks)
            .values(toFantasyPickRow(pick));
        }

        return true;
      }),
    getFantasyTeam: async (id) => {
      const row = (
        await db
          .select()
          .from(pg.fantasyTeams)
          .where(eq(pg.fantasyTeams.id, id))
      ).at(0);

      return row === undefined ? undefined : toFantasyTeam(row);
    },
    listFantasyTeamsForBasho: async (bashoId) =>
      (
        await db
          .select()
          .from(pg.fantasyTeams)
          .where(eq(pg.fantasyTeams.bashoId, bashoId))
          .orderBy(pg.fantasyTeams.displayName)
      ).map(toFantasyTeam),
    lockFantasyTeamsForBasho: async (bashoId, lockedAt) => {
      await db
        .update(pg.fantasyTeams)
        .set({ lockedAt })
        .where(
          and(
            eq(pg.fantasyTeams.bashoId, bashoId),
            isNull(pg.fantasyTeams.lockedAt),
          ),
        );
    },
    lockBashoAndFantasyTeams: async (bashoId, lockedAt) => {
      await db.transaction(async (transaction) => {
        await transaction
          .update(pg.basho)
          .set({ status: "locked" })
          .where(
            and(eq(pg.basho.id, bashoId), eq(pg.basho.status, "upcoming")),
          );
        await transaction
          .update(pg.fantasyTeams)
          .set({ lockedAt })
          .where(
            and(
              eq(pg.fantasyTeams.bashoId, bashoId),
              isNull(pg.fantasyTeams.lockedAt),
            ),
          );
      });
    },

    insertFantasyPick: async (entry) => {
      await db.insert(pg.fantasyPicks).values(toFantasyPickRow(entry));
    },
    listFantasyPicksForTeam: async (teamId) =>
      (
        await db
          .select()
          .from(pg.fantasyPicks)
          .where(eq(pg.fantasyPicks.teamId, teamId))
          .orderBy(pg.fantasyPicks.id)
      ).map(toFantasyPick),
    listFantasyPicksForBasho: async (bashoId) => {
      const teams = await repositories.listFantasyTeamsForBasho(bashoId);
      const picks = await Promise.all(
        teams.map((team) => repositories.listFantasyPicksForTeam(team.id)),
      );

      return picks.flat();
    },

    insertBoutResult: async (entry) => {
      await db.insert(pg.boutResults).values(toBoutResultRow(entry));
    },
    upsertBoutResult: async (entry) => {
      await db
        .insert(pg.boutResults)
        .values(toBoutResultRow(entry))
        .onConflictDoUpdate({
          target: pg.boutResults.id,
          set: toBoutResultRow(entry),
        });
    },
    listBoutResultsForBasho: async (bashoId) =>
      (
        await db
          .select()
          .from(pg.boutResults)
          .where(eq(pg.boutResults.bashoId, bashoId))
          .orderBy(pg.boutResults.day)
      ).map(toBoutResult),
    deleteBoutResultsForBasho: async (bashoId) => {
      await db
        .delete(pg.boutResults)
        .where(eq(pg.boutResults.bashoId, bashoId));
    },
    applyBanzukeImport: async (importData) => {
      await db.transaction(async (transaction) => {
        const existingBasho = (
          await transaction
            .select()
            .from(pg.basho)
            .where(eq(pg.basho.id, importData.basho.id))
            .for("update")
        ).at(0);
        const nextBasho = preserveBashoLifecycleProgress(
          existingBasho === undefined ? undefined : toBasho(existingBasho),
          importData.basho,
        );

        await transaction
          .insert(pg.basho)
          .values(toBashoRow(nextBasho))
          .onConflictDoUpdate({
            target: pg.basho.id,
            set: toBashoRow(nextBasho),
          });

        for (const entry of importData.rikishi) {
          await transaction
            .insert(pg.rikishi)
            .values(toRikishiRow(entry))
            .onConflictDoUpdate({
              target: pg.rikishi.id,
              set: toRikishiRow(entry),
            });
        }

        for (const entry of importData.banzukeEntries) {
          await transaction
            .insert(pg.banzukeEntries)
            .values(entry)
            .onConflictDoUpdate({
              target: pg.banzukeEntries.id,
              set: entry,
            });
        }

        if (importData.banzukeEntries.length > 0) {
          await transaction.delete(pg.banzukeEntries).where(
            and(
              eq(pg.banzukeEntries.bashoId, importData.basho.id),
              notInArray(
                pg.banzukeEntries.id,
                importData.banzukeEntries.map((entry) => entry.id),
              ),
            ),
          );
        }
      });
    },
    applyBoutResultsImport: async (importData) => {
      await db.transaction(async (transaction) => {
        if (importData.basho !== undefined) {
          await transaction
            .insert(pg.basho)
            .values(toBashoRow(importData.basho))
            .onConflictDoUpdate({
              target: pg.basho.id,
              set: toBashoRow(importData.basho),
            });
        }

        for (const entry of importData.rikishi ?? []) {
          await transaction
            .insert(pg.rikishi)
            .values(toRikishiRow(entry))
            .onConflictDoNothing({ target: pg.rikishi.id });
        }

        for (const entry of importData.results) {
          await transaction
            .insert(pg.boutResults)
            .values(toBoutResultRow(entry))
            .onConflictDoUpdate({
              target: pg.boutResults.id,
              set: toBoutResultRow(entry),
            });
        }

        if (importData.results.length > 0) {
          await transaction.delete(pg.boutResults).where(
            and(
              eq(pg.boutResults.bashoId, importData.bashoId),
              eq(pg.boutResults.day, importData.day),
              notInArray(
                pg.boutResults.id,
                importData.results.map((entry) => entry.id),
              ),
            ),
          );
        }
      });
    },
  };

  return repositories;
}

function toBashoRow(entry: Basho) {
  return {
    ...entry,
    currentDay: entry.currentDay ?? null,
  };
}

function assertDemoBashoResetData(resetData: DemoBashoResetData): void {
  if (resetData.basho.id !== DEMO_BASHO_ID) {
    throw new Error(
      `Demo reset may only replace the fixed basho ${DEMO_BASHO_ID}.`,
    );
  }

  if (!resetData.basho.isDemo) {
    throw new Error(
      `Refusing to replace live basho ${resetData.basho.id} through the demo reset path.`,
    );
  }

  if (
    resetData.banzukeEntries.some(
      (entry) => entry.bashoId !== resetData.basho.id,
    ) ||
    resetData.fantasyTeams.some(
      (entry) => entry.bashoId !== resetData.basho.id,
    ) ||
    resetData.boutResults.some((entry) => entry.bashoId !== resetData.basho.id)
  ) {
    throw new Error("Demo reset data must be scoped to one demo basho.");
  }

  const teamIds = new Set(resetData.fantasyTeams.map((team) => team.id));
  if (resetData.fantasyPicks.some((pick) => !teamIds.has(pick.teamId))) {
    throw new Error("Demo reset picks must belong to demo reset teams.");
  }
}

function toBasho(row: typeof sqlite.basho.$inferSelect): Basho {
  return {
    id: row.id,
    isDemo: row.isDemo,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    ...(row.currentDay === null ? {} : { currentDay: row.currentDay }),
  };
}

function toOptionalBasho(
  row: typeof sqlite.basho.$inferSelect | undefined,
): Basho | undefined {
  return row === undefined ? undefined : toBasho(row);
}

function toRikishiRow(entry: Rikishi) {
  return {
    ...entry,
    heya: entry.heya ?? null,
  };
}

function toRikishi(row: typeof sqlite.rikishi.$inferSelect): Rikishi {
  return {
    id: row.id,
    shikona: row.shikona,
    ...(row.heya === null ? {} : { heya: row.heya }),
  };
}

function toFantasyTeamRow(entry: FantasyTeam) {
  return {
    ...entry,
    ownerName: entry.ownerName ?? null,
    createdAt: entry.createdAt ?? null,
    lockedAt: entry.lockedAt ?? null,
  };
}

function toFantasyTeam(
  row: typeof sqlite.fantasyTeams.$inferSelect,
): FantasyTeam {
  return {
    id: row.id,
    bashoId: row.bashoId,
    displayName: row.displayName,
    ...(row.ownerName === null ? {} : { ownerName: row.ownerName }),
    ...(row.createdAt === null ? {} : { createdAt: row.createdAt }),
    ...(row.lockedAt === null ? {} : { lockedAt: row.lockedAt }),
  };
}

function toFantasyPick(
  row: typeof sqlite.fantasyPicks.$inferSelect,
): FantasyPick {
  return {
    id: row.id,
    teamId: row.teamId,
    rikishiId: row.rikishiId,
  };
}

function toFantasyPickRow(entry: FantasyPick) {
  return {
    id: entry.id ?? `${entry.teamId}-${entry.rikishiId}`,
    teamId: entry.teamId,
    rikishiId: entry.rikishiId,
  };
}

function toBoutResultRow(entry: BoutResult) {
  return {
    ...entry,
    kimarite: entry.kimarite ?? null,
    winnerAbsent: entry.winnerAbsent ?? false,
    loserAbsent: entry.loserAbsent ?? false,
  };
}

function toBoutResult(row: typeof sqlite.boutResults.$inferSelect): BoutResult {
  return {
    id: row.id,
    bashoId: row.bashoId,
    day: row.day,
    winnerRikishiId: row.winnerRikishiId,
    loserRikishiId: row.loserRikishiId,
    ...(row.kimarite === null ? {} : { kimarite: row.kimarite }),
    ...(row.winnerAbsent ? { winnerAbsent: true } : {}),
    ...(row.loserAbsent ? { loserAbsent: true } : {}),
  };
}
