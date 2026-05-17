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
  return {
    insertBasho: (entry: Basho) => db.insert(basho).values(entry).run(),
    listBashos: () => db.select().from(basho).orderBy(basho.startDate).all(),
    getBasho: (id: Basho["id"]) =>
      db.select().from(basho).where(eq(basho.id, id)).get(),

    insertRikishi: (entry: Rikishi) =>
      db.insert(rikishi).values(toRikishiRow(entry)).run(),
    listRikishi: () =>
      db.select().from(rikishi).orderBy(rikishi.shikona).all().map(toRikishi),

    insertBanzukeEntry: (entry: BanzukeEntry) =>
      db.insert(banzukeEntries).values(entry).run(),
    listBanzukeEntriesForBasho: (bashoId: Basho["id"]) =>
      db
        .select()
        .from(banzukeEntries)
        .where(eq(banzukeEntries.bashoId, bashoId))
        .orderBy(banzukeEntries.rankOrder)
        .all(),

    insertFantasyTeam: (entry: FantasyTeam) =>
      db.insert(fantasyTeams).values(toFantasyTeamRow(entry)).run(),
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

    insertBoutResult: (entry: BoutResult) =>
      db.insert(boutResults).values(toBoutResultRow(entry)).run(),
    listBoutResultsForBasho: (bashoId: Basho["id"]) =>
      db
        .select()
        .from(boutResults)
        .where(eq(boutResults.bashoId, bashoId))
        .orderBy(boutResults.day)
        .all()
        .map(toBoutResult),
  };
}

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
