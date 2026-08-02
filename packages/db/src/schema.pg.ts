import {
  integer,
  pgTable,
  text,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";

export const basho = pgTable("basho", {
  id: text("id").primaryKey(),
  isDemo: boolean("is_demo").notNull().default(false),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status", {
    enum: ["upcoming", "locked", "active", "complete"],
  }).notNull(),
  currentDay: integer("current_day"),
});

export const rikishi = pgTable("rikishi", {
  id: text("id").primaryKey(),
  shikona: text("shikona").notNull(),
  heya: text("heya"),
});

export const banzukeEntries = pgTable(
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

export const fantasyTeams = pgTable(
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

export const fantasyPicks = pgTable(
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

export const boutResults = pgTable("bout_results", {
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
  winnerAbsent: boolean("winner_absent").notNull().default(false),
  loserAbsent: boolean("loser_absent").notNull().default(false),
});
