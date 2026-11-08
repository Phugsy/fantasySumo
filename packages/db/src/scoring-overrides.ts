import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { ScoringMode } from "@fantasy-sumo/domain";
import type { AppDatabase } from "./client.js";
import * as sqlite from "./schema.js";
import * as pg from "./schema.pg.js";

export interface ScoringOverrideInput {
  actorUserId: string;
  reason: string;
  changedAt: string;
  expectedMode: ScoringMode;
}
export interface ScoringOverrideEntry extends ScoringOverrideInput {
  id: string;
  bashoId: string;
  fromMode: ScoringMode;
  toMode: ScoringMode;
}
export interface ScoringOverrideRepositories {
  overrideBashoScoringMode: (
    id: string,
    mode: ScoringMode,
    input: ScoringOverrideInput,
  ) => Promise<"updated" | "unchanged" | "conflict" | "not-found">;
  listBashoScoringOverrides: (
    id: string,
  ) => Promise<Omit<ScoringOverrideEntry, "expectedMode">[]>;
}

export function createScoringOverrideRepositories(
  database: AppDatabase,
): ScoringOverrideRepositories {
  if (database.provider === "sqlite") {
    const db = database.db;
    return {
      listBashoScoringOverrides: async (id) =>
        db
          .select()
          .from(sqlite.bashoScoringOverrides)
          .where(eq(sqlite.bashoScoringOverrides.bashoId, id))
          .orderBy(
            desc(sqlite.bashoScoringOverrides.changedAt),
            desc(sqlite.bashoScoringOverrides.id),
          )
          .limit(20)
          .all(),
      overrideBashoScoringMode: async (id, mode, input) =>
        db.transaction(
          (tx) => {
            validate(mode, input);
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
            if (config.mode === mode) return "unchanged";
            if (config.mode !== input.expectedMode) return "conflict";
            tx.update(sqlite.bashoScoringConfig)
              .set({ mode })
              .where(eq(sqlite.bashoScoringConfig.bashoId, id))
              .run();
            tx.update(sqlite.bashoJokerTrial)
              .set({ baseMode: mode })
              .where(eq(sqlite.bashoJokerTrial.bashoId, id))
              .run();
            tx.update(sqlite.bashoLiveJokerTrial)
              .set({ baseMode: mode })
              .where(eq(sqlite.bashoLiveJokerTrial.bashoId, id))
              .run();
            tx.insert(sqlite.bashoScoringOverrides)
              .values(event(id, config.mode, mode, input))
              .run();
            return "updated";
          },
          { behavior: "immediate" },
        ),
    };
  }
  const db = database.db;
  return {
    listBashoScoringOverrides: async (id) =>
      db
        .select()
        .from(pg.bashoScoringOverrides)
        .where(eq(pg.bashoScoringOverrides.bashoId, id))
        .orderBy(
          desc(pg.bashoScoringOverrides.changedAt),
          desc(pg.bashoScoringOverrides.id),
        )
        .limit(20),
    overrideBashoScoringMode: async (id, mode, input) =>
      db.transaction(async (tx) => {
        validate(mode, input);
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
        if (config.mode === mode) return "unchanged";
        if (config.mode !== input.expectedMode) return "conflict";
        await tx
          .update(pg.bashoScoringConfig)
          .set({ mode })
          .where(eq(pg.bashoScoringConfig.bashoId, id));
        await tx
          .update(pg.bashoJokerTrial)
          .set({ baseMode: mode })
          .where(eq(pg.bashoJokerTrial.bashoId, id));
        await tx
          .update(pg.bashoLiveJokerTrial)
          .set({ baseMode: mode })
          .where(eq(pg.bashoLiveJokerTrial.bashoId, id));
        await tx
          .insert(pg.bashoScoringOverrides)
          .values(event(id, config.mode, mode, input));
        return "updated";
      }),
  };
}

function validate(mode: ScoringMode, input: ScoringOverrideInput) {
  if (
    !["wins-v0", "achievements-v1"].includes(mode) ||
    !["wins-v0", "achievements-v1"].includes(input.expectedMode) ||
    !input.actorUserId.trim() ||
    input.reason.trim().length < 8 ||
    input.reason.length > 500 ||
    !Number.isFinite(Date.parse(input.changedAt))
  )
    throw new Error("Invalid owner scoring override.");
}
function event(
  bashoId: string,
  fromMode: ScoringMode,
  toMode: ScoringMode,
  input: ScoringOverrideInput,
) {
  return {
    id: randomUUID(),
    bashoId,
    fromMode,
    toMode,
    actorUserId: input.actorUserId,
    reason: input.reason.trim(),
    changedAt: input.changedAt,
  };
}
