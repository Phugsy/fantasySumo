CREATE TABLE "basho_live_joker_trial" (
  "basho_id" text PRIMARY KEY REFERENCES "basho"("id") ON DELETE CASCADE,
  "preset" text NOT NULL CHECK ("preset" = 'three-joker-v1'),
  "base_mode" text NOT NULL CHECK ("base_mode" IN ('wins-v0', 'achievements-v1')),
  "enabled_at" text NOT NULL,
  "enabled_by" text NOT NULL
);
