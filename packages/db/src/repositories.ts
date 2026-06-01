import { eq } from "drizzle-orm";
import type {
  BanzukeEntry,
  Basho,
  BoutResult,
  FantasyPick,
  FantasyTeam,
  Rikishi,
} from "@fantasy-sumo/domain";
import type { SqliteDatabase } from "./client.js";
import {
  banzukeEntries,
  basho,
  boutResults,
  fantasyPicks,
  fantasyTeams,
  rikishi,
} from "./schema.js";

export function createRepositories(db: SqliteDatabase) {
  const repositories = {
    insertBasho: (entry: Basho) => db.insert(basho).values(entry).run(),
    upsertBasho: (entry: Basho) =>
      db
        .insert(basho)
        .values(entry)
        .onConflictDoUpdate({
          target: basho.id,
          set: entry,
        })
        .run(),
    listBashos: () => db.select().from(basho).orderBy(basho.startDate).all(),
    getBasho: (id: Basho["id"]) =>
      db.select().from(basho).where(eq(basho.id, id)).get(),

    insertRikishi: (entry: Rikishi) =>
      db.insert(rikishi).values(toRikishiRow(entry)).run(),
    upsertRikishi: (entry: Rikishi) =>
      db
        .insert(rikishi)
        .values(toRikishiRow(entry))
        .onConflictDoUpdate({
          target: rikishi.id,
          set: toRikishiRow(entry),
        })
        .run(),
    listRikishi: () =>
      db.select().from(rikishi).orderBy(rikishi.shikona).all().map(toRikishi),

    insertBanzukeEntry: (entry: BanzukeEntry) =>
      db.insert(banzukeEntries).values(entry).run(),
    upsertBanzukeEntry: (entry: BanzukeEntry) =>
      db
        .insert(banzukeEntries)
        .values(entry)
        .onConflictDoUpdate({
          target: banzukeEntries.id,
          set: entry,
        })
        .run(),
    listBanzukeEntriesForBasho: (bashoId: Basho["id"]) =>
      db
        .select()
        .from(banzukeEntries)
        .where(eq(banzukeEntries.bashoId, bashoId))
        .orderBy(banzukeEntries.rankOrder)
        .all(),

    insertFantasyTeam: (entry: FantasyTeam) =>
      db.insert(fantasyTeams).values(toFantasyTeamRow(entry)).run(),
    insertFantasyTeamWithPicks: (
      team: FantasyTeam,
      picks: readonly FantasyPick[],
    ) =>
      db.transaction((transaction) => {
        transaction.insert(fantasyTeams).values(toFantasyTeamRow(team)).run();

        for (const pick of picks) {
          transaction.insert(fantasyPicks).values(toFantasyPickRow(pick)).run();
        }
      }),
    getFantasyTeam: (id: FantasyTeam["id"]) => {
      const row = db
        .select()
        .from(fantasyTeams)
        .where(eq(fantasyTeams.id, id))
        .get();

      return row === undefined ? undefined : toFantasyTeam(row);
    },
    listFantasyTeamsForBasho: (bashoId: Basho["id"]) =>
      db
        .select()
        .from(fantasyTeams)
        .where(eq(fantasyTeams.bashoId, bashoId))
        .orderBy(fantasyTeams.displayName)
        .all()
        .map(toFantasyTeam),

    insertFantasyPick: (entry: FantasyPick) =>
      db.insert(fantasyPicks).values(toFantasyPickRow(entry)).run(),
    listFantasyPicksForTeam: (teamId: FantasyTeam["id"]) =>
      db
        .select()
        .from(fantasyPicks)
        .where(eq(fantasyPicks.teamId, teamId))
        .orderBy(fantasyPicks.id)
        .all()
        .map(toFantasyPick),
    listFantasyPicksForBasho: (bashoId: Basho["id"]) =>
      repositories
        .listFantasyTeamsForBasho(bashoId)
        .flatMap((team) => repositories.listFantasyPicksForTeam(team.id)),

    insertBoutResult: (entry: BoutResult) =>
      db.insert(boutResults).values(toBoutResultRow(entry)).run(),
    upsertBoutResult: (entry: BoutResult) =>
      db
        .insert(boutResults)
        .values(toBoutResultRow(entry))
        .onConflictDoUpdate({
          target: boutResults.id,
          set: toBoutResultRow(entry),
        })
        .run(),
    listBoutResultsForBasho: (bashoId: Basho["id"]) =>
      db
        .select()
        .from(boutResults)
        .where(eq(boutResults.bashoId, bashoId))
        .orderBy(boutResults.day)
        .all()
        .map(toBoutResult),
    applyBanzukeImport: (importData: {
      basho: Basho;
      rikishi: readonly Rikishi[];
      banzukeEntries: readonly BanzukeEntry[];
    }) =>
      db.transaction((transaction) => {
        transaction
          .insert(basho)
          .values(importData.basho)
          .onConflictDoUpdate({
            target: basho.id,
            set: importData.basho,
          })
          .run();

        for (const entry of importData.rikishi) {
          transaction
            .insert(rikishi)
            .values(toRikishiRow(entry))
            .onConflictDoUpdate({
              target: rikishi.id,
              set: toRikishiRow(entry),
            })
            .run();
        }

        for (const entry of importData.banzukeEntries) {
          transaction
            .insert(banzukeEntries)
            .values(entry)
            .onConflictDoUpdate({
              target: banzukeEntries.id,
              set: entry,
            })
            .run();
        }
      }),
    applyBoutResultsImport: (results: readonly BoutResult[]) =>
      db.transaction((transaction) => {
        for (const entry of results) {
          transaction
            .insert(boutResults)
            .values(toBoutResultRow(entry))
            .onConflictDoUpdate({
              target: boutResults.id,
              set: toBoutResultRow(entry),
            })
            .run();
        }
      }),
  };

  return repositories;
}

export type Repositories = ReturnType<typeof createRepositories>;

function toRikishiRow(entry: Rikishi) {
  return {
    ...entry,
    heya: entry.heya ?? null,
  };
}

function toRikishi(row: typeof rikishi.$inferSelect): Rikishi {
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

function toFantasyTeam(row: typeof fantasyTeams.$inferSelect): FantasyTeam {
  return {
    id: row.id,
    bashoId: row.bashoId,
    displayName: row.displayName,
    ...(row.ownerName === null ? {} : { ownerName: row.ownerName }),
    ...(row.createdAt === null ? {} : { createdAt: row.createdAt }),
    ...(row.lockedAt === null ? {} : { lockedAt: row.lockedAt }),
  };
}

function toFantasyPick(row: typeof fantasyPicks.$inferSelect): FantasyPick {
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

function toBoutResult(row: typeof boutResults.$inferSelect): BoutResult {
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
