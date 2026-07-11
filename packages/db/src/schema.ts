import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const basho = sqliteTable("basho", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status", {
    enum: ["upcoming", "locked", "active", "complete"],
  }).notNull(),
  currentDay: integer("current_day"),
});

export const rikishi = sqliteTable("rikishi", {
  id: text("id").primaryKey(),
  shikona: text("shikona").notNull(),
  heya: text("heya"),
});

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
