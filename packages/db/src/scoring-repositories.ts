import { eq } from "drizzle-orm";
import type { ScoringMode, SpecialPrizeAward } from "@fantasy-sumo/domain";
import type { AppDatabase } from "./client.js";
import * as sqlite from "./schema.js";
import * as pg from "./schema.pg.js";

export interface BashoScoringConfig {
  bashoId: string;
  mode: ScoringMode;
  locked: boolean;
}
export interface SpecialPrizeSnapshot {
  bashoId: string;
  source: string;
  fetchedAt: string;
  awards: SpecialPrizeAward[];
}
export interface ScoringRepositories {
  getBashoScoringConfig: (
    bashoId: string,
  ) => Promise<BashoScoringConfig | undefined>;
  setBashoScoringMode: (
    bashoId: string,
    mode: ScoringMode,
  ) => Promise<"updated" | "locked" | "not-found">;
  getSpecialPrizeSnapshot: (
    bashoId: string,
  ) => Promise<SpecialPrizeSnapshot | undefined>;
  replaceSpecialPrizeSnapshot: (
    snapshot: SpecialPrizeSnapshot,
  ) => Promise<void>;
}

export function createScoringRepositories(
  database: AppDatabase,
): ScoringRepositories {
  if (database.provider === "sqlite") {
    const db = database.db;
    return {
      getBashoScoringConfig: async (id) =>
        db
          .select()
          .from(sqlite.bashoScoringConfig)
          .where(eq(sqlite.bashoScoringConfig.bashoId, id))
          .get(),
      setBashoScoringMode: async (id, mode) =>
        db.transaction((tx) => {
          assertMode(mode);
          const basho = tx
            .select()
            .from(sqlite.basho)
            .where(eq(sqlite.basho.id, id))
            .get();
          const config = tx
            .select()
            .from(sqlite.bashoScoringConfig)
            .where(eq(sqlite.bashoScoringConfig.bashoId, id))
            .get();
          if (!basho || !config) return "not-found";
          if (
            config.mode !== mode &&
            (config.locked || basho.status !== "upcoming")
          )
            return "locked";
          tx.update(sqlite.bashoScoringConfig)
            .set({ mode })
            .where(eq(sqlite.bashoScoringConfig.bashoId, id))
            .run();
          return "updated";
        }),
      getSpecialPrizeSnapshot: async (id) =>
        decodeSnapshot(
          db
            .select()
            .from(sqlite.specialPrizeSnapshots)
            .where(eq(sqlite.specialPrizeSnapshots.bashoId, id))
            .get(),
        ),
      replaceSpecialPrizeSnapshot: async (snapshot) =>
        db.transaction((tx) => {
          const basho = tx
            .select()
            .from(sqlite.basho)
            .where(eq(sqlite.basho.id, snapshot.bashoId))
            .get();
          const banzuke = tx
            .select()
            .from(sqlite.banzukeEntries)
            .where(eq(sqlite.banzukeEntries.bashoId, snapshot.bashoId))
            .all();
          validateSnapshot(snapshot, basho?.status, banzuke);
          const existing = tx
            .select()
            .from(sqlite.specialPrizeSnapshots)
            .where(eq(sqlite.specialPrizeSnapshots.bashoId, snapshot.bashoId))
            .get();
          if (existing && existing.fetchedAt >= snapshot.fetchedAt) return;
          const row = encodeSnapshot(snapshot);
          tx.insert(sqlite.specialPrizeSnapshots)
            .values(row)
            .onConflictDoUpdate({
              target: sqlite.specialPrizeSnapshots.bashoId,
              set: row,
            })
            .run();
        }),
    };
  }
  const db = database.db;
  return {
    getBashoScoringConfig: async (id) =>
      (
        await db
          .select()
          .from(pg.bashoScoringConfig)
          .where(eq(pg.bashoScoringConfig.bashoId, id))
      )[0],
    setBashoScoringMode: async (id, mode) =>
      db.transaction(async (tx) => {
        assertMode(mode);
        const [basho] = await tx
          .select()
          .from(pg.basho)
          .where(eq(pg.basho.id, id))
          .for("update");
        const [config] = await tx
          .select()
          .from(pg.bashoScoringConfig)
          .where(eq(pg.bashoScoringConfig.bashoId, id));
        if (!basho || !config) return "not-found";
        if (
          config.mode !== mode &&
          (config.locked || basho.status !== "upcoming")
        )
          return "locked";
        await tx
          .update(pg.bashoScoringConfig)
          .set({ mode })
          .where(eq(pg.bashoScoringConfig.bashoId, id));
        return "updated";
      }),
    getSpecialPrizeSnapshot: async (id) =>
      decodeSnapshot(
        (
          await db
            .select()
            .from(pg.specialPrizeSnapshots)
            .where(eq(pg.specialPrizeSnapshots.bashoId, id))
        )[0],
      ),
    replaceSpecialPrizeSnapshot: async (snapshot) =>
      db.transaction(async (tx) => {
        const [basho] = await tx
          .select()
          .from(pg.basho)
          .where(eq(pg.basho.id, snapshot.bashoId))
          .for("update");
        const banzuke = await tx
          .select()
          .from(pg.banzukeEntries)
          .where(eq(pg.banzukeEntries.bashoId, snapshot.bashoId));
        validateSnapshot(snapshot, basho?.status, banzuke);
        const [existing] = await tx
          .select()
          .from(pg.specialPrizeSnapshots)
          .where(eq(pg.specialPrizeSnapshots.bashoId, snapshot.bashoId));
        if (existing && existing.fetchedAt >= snapshot.fetchedAt) return;
        const row = encodeSnapshot(snapshot);
        await tx
          .insert(pg.specialPrizeSnapshots)
          .values(row)
          .onConflictDoUpdate({
            target: pg.specialPrizeSnapshots.bashoId,
            set: row,
          });
      }),
  };
}

function assertMode(mode: ScoringMode) {
  if (mode !== "wins-v0" && mode !== "achievements-v1")
    throw new Error("Unknown scoring mode.");
}
function validateSnapshot(
  snapshot: SpecialPrizeSnapshot,
  status: string | undefined,
  banzuke: { rikishiId: string }[],
) {
  if (status !== "complete")
    throw new Error("Special prizes require a completed basho.");
  if (
    !snapshot.source ||
    !Number.isFinite(Date.parse(snapshot.fetchedAt)) ||
    new Date(snapshot.fetchedAt).toISOString() !== snapshot.fetchedAt
  )
    throw new Error("Invalid prize provenance.");
  const roster = new Set(banzuke.map((entry) => entry.rikishiId));
  const keys = new Set<string>();
  for (const award of snapshot.awards) {
    const key = `${award.type}:${award.rikishiId}`;
    if (
      !roster.has(award.rikishiId) ||
      !["outstanding-performance", "fighting-spirit", "technique"].includes(
        award.type,
      ) ||
      keys.has(key)
    )
      throw new Error("Invalid or duplicate special-prize award.");
    keys.add(key);
  }
}
function encodeSnapshot({ awards, ...snapshot }: SpecialPrizeSnapshot) {
  return { ...snapshot, awardsJson: JSON.stringify(awards) };
}
function decodeSnapshot(
  row: typeof sqlite.specialPrizeSnapshots.$inferSelect | undefined,
): SpecialPrizeSnapshot | undefined {
  if (!row) return undefined;
  const { awardsJson, ...snapshot } = row;
  return { ...snapshot, awards: JSON.parse(awardsJson) as SpecialPrizeAward[] };
}
