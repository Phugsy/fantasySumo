-- Expand mode constraints without changing existing rules or audit history.
CREATE TABLE basho_joker_trial_expanded (
  basho_id text PRIMARY KEY NOT NULL REFERENCES basho(id) ON DELETE CASCADE,
  preset text NOT NULL CHECK (preset = 'three-joker-v1'),
  base_mode text NOT NULL CHECK (base_mode IN ('wins-v0', 'achievements-v1', 'achievements-v2')),
  clock text NOT NULL, clock_set_at text NOT NULL
);
--> statement-breakpoint
INSERT INTO basho_joker_trial_expanded (basho_id, preset, base_mode, clock, clock_set_at) SELECT basho_id, preset, base_mode, clock, clock_set_at FROM basho_joker_trial;
--> statement-breakpoint
DROP TABLE basho_joker_trial;
--> statement-breakpoint
ALTER TABLE basho_joker_trial_expanded RENAME TO basho_joker_trial;
--> statement-breakpoint
CREATE TABLE basho_live_joker_trial_expanded (
  basho_id text PRIMARY KEY NOT NULL REFERENCES basho(id) ON DELETE CASCADE,
  preset text NOT NULL CHECK (preset = 'three-joker-v1'),
  base_mode text NOT NULL CHECK (base_mode IN ('wins-v0', 'achievements-v1', 'achievements-v2')),
  enabled_at text NOT NULL, enabled_by text NOT NULL
);
--> statement-breakpoint
INSERT INTO basho_live_joker_trial_expanded (basho_id, preset, base_mode, enabled_at, enabled_by) SELECT basho_id, preset, base_mode, enabled_at, enabled_by FROM basho_live_joker_trial;
--> statement-breakpoint
DROP TABLE basho_live_joker_trial;
--> statement-breakpoint
ALTER TABLE basho_live_joker_trial_expanded RENAME TO basho_live_joker_trial;
--> statement-breakpoint
CREATE TABLE basho_scoring_overrides_expanded (
  id text PRIMARY KEY NOT NULL,
  basho_id text NOT NULL REFERENCES basho(id) ON DELETE CASCADE,
  from_mode text NOT NULL CHECK (from_mode IN ('wins-v0', 'achievements-v1', 'achievements-v2')),
  to_mode text NOT NULL CHECK (to_mode IN ('wins-v0', 'achievements-v1', 'achievements-v2')),
  actor_user_id text NOT NULL, reason text NOT NULL, changed_at text NOT NULL
);
--> statement-breakpoint
INSERT INTO basho_scoring_overrides_expanded (id, basho_id, from_mode, to_mode, actor_user_id, reason, changed_at) SELECT id, basho_id, from_mode, to_mode, actor_user_id, reason, changed_at FROM basho_scoring_overrides;
--> statement-breakpoint
DROP TABLE basho_scoring_overrides;
--> statement-breakpoint
ALTER TABLE basho_scoring_overrides_expanded RENAME TO basho_scoring_overrides;
