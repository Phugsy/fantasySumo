import {
  check,
  primaryKey,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const basho = sqliteTable("basho", {
  id: text("id").primaryKey(),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status", {
    enum: ["upcoming", "locked", "active", "complete"],
  }).notNull(),
  currentDay: integer("current_day"),
});

export const bashoGameConfig = sqliteTable(
  "basho_game_config",
  {
    bashoId: text("basho_id")
      .primaryKey()
      .references(() => basho.id, { onDelete: "cascade" }),
    teamSize: integer("team_size").notNull().default(2),
  },
  (table) => [
    check("basho_game_config_team_size_positive", sql`${table.teamSize} > 0`),
  ],
);

export const rikishi = sqliteTable("rikishi", {
  id: text("id").primaryKey(),
  shikona: text("shikona").notNull(),
  heya: text("heya"),
});

// Local rikishi IDs are immutable; provider IDs live in this additive alias table.
export const rikishiSourceIdentities = sqliteTable(
  "rikishi_source_identities",
  {
    source: text("source", { enum: ["jsa", "sumo-api"] }).notNull(),
    sourceRikishiId: text("source_rikishi_id").notNull(),
    rikishiId: text("rikishi_id")
      .notNull()
      .references(() => rikishi.id),
  },
  (table) => [
    uniqueIndex("rikishi_source_identity_idx").on(
      table.source,
      table.sourceRikishiId,
    ),
    uniqueIndex("rikishi_source_canonical_idx").on(
      table.source,
      table.rikishiId,
    ),
    check("rikishi_source_valid", sql`${table.source} IN ('jsa', 'sumo-api')`),
  ],
);

export const banzukeEntries = sqliteTable(
  "banzuke_entries",
  {
    id: text("id").primaryKey(),
    bashoId: text("basho_id")
      .notNull()
      .references(() => basho.id, { onDelete: "cascade" }),
    rikishiId: text("rikishi_id")
      .notNull()
      .references(() => rikishi.id, { onDelete: "cascade" }),
    shikona: text("shikona"),
    heya: text("heya"),
    rank: text("rank").notNull(),
    rankOrder: integer("rank_order").notNull(),
  },
  (table) => [
    uniqueIndex("banzuke_entries_basho_rikishi_idx").on(
      table.bashoId,
      table.rikishiId,
    ),
  ],
);

export const fantasyTeams = sqliteTable(
  "fantasy_teams",
  {
    id: text("id").primaryKey(),
    bashoId: text("basho_id")
      .notNull()
      .references(() => basho.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    ownerName: text("owner_name"),
    ownerUserId: text("owner_user_id"),
    createdAt: text("created_at"),
    lockedAt: text("locked_at"),
  },
  (table) => [
    uniqueIndex("fantasy_teams_basho_owner_user_idx").on(
      table.bashoId,
      table.ownerUserId,
    ),
  ],
);

export const fantasyPicks = sqliteTable(
  "fantasy_picks",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => fantasyTeams.id, { onDelete: "cascade" }),
    rikishiId: text("rikishi_id")
      .notNull()
      .references(() => rikishi.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("fantasy_picks_team_rikishi_idx").on(
      table.teamId,
      table.rikishiId,
    ),
  ],
);

export const boutResults = sqliteTable("bout_results", {
  id: text("id").primaryKey(),
  bashoId: text("basho_id")
    .notNull()
    .references(() => basho.id, { onDelete: "cascade" }),
  day: integer("day").notNull(),
  winnerRikishiId: text("winner_rikishi_id")
    .notNull()
    .references(() => rikishi.id, { onDelete: "cascade" }),
  loserRikishiId: text("loser_rikishi_id")
    .notNull()
    .references(() => rikishi.id, { onDelete: "cascade" }),
  kimarite: text("kimarite"),
  winnerAbsent: integer("winner_absent", { mode: "boolean" })
    .notNull()
    .default(false),
  loserAbsent: integer("loser_absent", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const scheduledBoutPublications = sqliteTable(
  "scheduled_bout_publications",
  {
    id: text("id").primaryKey(),
    bashoId: text("basho_id")
      .notNull()
      .references(() => basho.id, { onDelete: "cascade" }),
    day: integer("day").notNull(),
    source: text("source").notNull(),
    publishedAt: text("published_at").notNull(),
  },
  (table) => [
    uniqueIndex("scheduled_bout_publications_basho_day_idx").on(
      table.bashoId,
      table.day,
    ),
  ],
);

export const scheduledBouts = sqliteTable("scheduled_bouts", {
  id: text("id").primaryKey(),
  bashoId: text("basho_id")
    .notNull()
    .references(() => basho.id, { onDelete: "cascade" }),
  day: integer("day").notNull(),
  eastRikishiId: text("east_rikishi_id")
    .notNull()
    .references(() => rikishi.id, { onDelete: "cascade" }),
  westRikishiId: text("west_rikishi_id")
    .notNull()
    .references(() => rikishi.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["scheduled", "cancelled"] }).notNull(),
  withdrawnRikishiId: text("withdrawn_rikishi_id").references(
    () => rikishi.id,
    { onDelete: "set null" },
  ),
});

export const bashoScoringConfig = sqliteTable("basho_scoring_config", {
  bashoId: text("basho_id")
    .primaryKey()
    .references(() => basho.id, { onDelete: "cascade" }),
  mode: text("mode", { enum: ["wins-v0", "achievements-v1"] })
    .notNull()
    .default("wins-v0"),
  locked: integer("locked", { mode: "boolean" }).notNull().default(false),
});

export const specialPrizeSnapshots = sqliteTable("special_prize_snapshots", {
  bashoId: text("basho_id")
    .primaryKey()
    .references(() => basho.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  fetchedAt: text("fetched_at").notNull(),
  awardsJson: text("awards_json").notNull(),
});

// Opt-in trial tables are additive; normal bashos have no row here.
export const bashoJokerTrial = sqliteTable(
  "basho_joker_trial",
  {
    bashoId: text("basho_id")
      .primaryKey()
      .references(() => basho.id, { onDelete: "cascade" }),
    preset: text("preset").notNull(),
    baseMode: text("base_mode").notNull(),
    clock: text("clock").notNull(),
    clockSetAt: text("clock_set_at").notNull(),
  },
  (table) => [
    check("joker_preset", sql`${table.preset} = 'three-joker-v1'`),
    check(
      "joker_base_mode",
      sql`${table.baseMode} IN ('wins-v0', 'achievements-v1')`,
    ),
  ],
);
export const jokerAllocations = sqliteTable(
  "joker_allocations",
  {
    bashoId: text("basho_id")
      .notNull()
      .references(() => basho.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => fantasyTeams.id, { onDelete: "cascade" }),
    day: integer("day").notNull(),
    payloadJson: text("payload_json").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.day] }),
    check("joker_day", sql`${table.day} BETWEEN 1 AND 15`),
  ],
);
export const jokerEvents = sqliteTable(
  "joker_events",
  {
    id: text("id").primaryKey(),
    bashoId: text("basho_id")
      .notNull()
      .references(() => basho.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => fantasyTeams.id, { onDelete: "cascade" }),
    requestId: text("request_id"),
    fingerprint: text("fingerprint").notNull(),
    payloadJson: text("payload_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("joker_event_request_idx").on(table.teamId, table.requestId),
  ],
);
