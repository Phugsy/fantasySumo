CREATE TABLE "basho_game_config" (
  "basho_id" text PRIMARY KEY NOT NULL REFERENCES "basho"("id") ON DELETE CASCADE,
  "team_size" integer DEFAULT 2 NOT NULL,
  CONSTRAINT "basho_game_config_team_size_positive" CHECK ("team_size" > 0)
);
