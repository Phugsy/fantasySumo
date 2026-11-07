CREATE TABLE basho_scoring_overrides (
  id text PRIMARY KEY NOT NULL,
  basho_id text NOT NULL REFERENCES basho(id) ON DELETE CASCADE,
  from_mode text NOT NULL CHECK (from_mode IN ('wins-v0', 'achievements-v1')),
  to_mode text NOT NULL CHECK (to_mode IN ('wins-v0', 'achievements-v1')),
  actor_user_id text NOT NULL,
  reason text NOT NULL,
  changed_at text NOT NULL
);
