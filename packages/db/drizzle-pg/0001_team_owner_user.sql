ALTER TABLE "fantasy_teams" ADD COLUMN "owner_user_id" text;

CREATE UNIQUE INDEX "fantasy_teams_basho_owner_user_idx"
  ON "fantasy_teams" ("basho_id", "owner_user_id");
