CREATE TABLE "basho" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "start_date" text NOT NULL,
  "end_date" text NOT NULL,
  "status" text NOT NULL,
  "current_day" integer
);

CREATE TABLE "rikishi" (
  "id" text PRIMARY KEY NOT NULL,
  "shikona" text NOT NULL,
  "heya" text
);

CREATE TABLE "banzuke_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "basho_id" text NOT NULL REFERENCES "basho"("id") ON DELETE cascade,
  "rikishi_id" text NOT NULL REFERENCES "rikishi"("id") ON DELETE cascade,
  "rank" text NOT NULL,
  "rank_order" integer NOT NULL
);

CREATE UNIQUE INDEX "banzuke_entries_basho_rikishi_idx"
  ON "banzuke_entries" ("basho_id", "rikishi_id");

CREATE TABLE "fantasy_teams" (
  "id" text PRIMARY KEY NOT NULL,
  "basho_id" text NOT NULL REFERENCES "basho"("id") ON DELETE cascade,
  "display_name" text NOT NULL,
  "owner_name" text,
  "created_at" text,
  "locked_at" text
);

CREATE TABLE "fantasy_picks" (
  "id" text PRIMARY KEY NOT NULL,
  "team_id" text NOT NULL REFERENCES "fantasy_teams"("id") ON DELETE cascade,
  "rikishi_id" text NOT NULL REFERENCES "rikishi"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX "fantasy_picks_team_rikishi_idx"
  ON "fantasy_picks" ("team_id", "rikishi_id");

CREATE TABLE "bout_results" (
  "id" text PRIMARY KEY NOT NULL,
  "basho_id" text NOT NULL REFERENCES "basho"("id") ON DELETE cascade,
  "day" integer NOT NULL,
  "winner_rikishi_id" text NOT NULL REFERENCES "rikishi"("id") ON DELETE cascade,
  "loser_rikishi_id" text NOT NULL REFERENCES "rikishi"("id") ON DELETE cascade,
  "kimarite" text,
  "winner_absent" boolean DEFAULT false NOT NULL,
  "loser_absent" boolean DEFAULT false NOT NULL
);
