-- Expand mode constraints without changing existing rules or audit history.
ALTER TABLE basho_joker_trial DROP CONSTRAINT basho_joker_trial_base_mode_check;
ALTER TABLE basho_joker_trial ADD CONSTRAINT basho_joker_trial_base_mode_check CHECK (base_mode IN ('wins-v0', 'achievements-v1', 'achievements-v2'));
ALTER TABLE basho_live_joker_trial DROP CONSTRAINT basho_live_joker_trial_base_mode_check;
ALTER TABLE basho_live_joker_trial ADD CONSTRAINT basho_live_joker_trial_base_mode_check CHECK (base_mode IN ('wins-v0', 'achievements-v1', 'achievements-v2'));
ALTER TABLE basho_scoring_overrides DROP CONSTRAINT basho_scoring_overrides_from_mode_check;
ALTER TABLE basho_scoring_overrides ADD CONSTRAINT basho_scoring_overrides_from_mode_check CHECK (from_mode IN ('wins-v0', 'achievements-v1', 'achievements-v2'));
ALTER TABLE basho_scoring_overrides DROP CONSTRAINT basho_scoring_overrides_to_mode_check;
ALTER TABLE basho_scoring_overrides ADD CONSTRAINT basho_scoring_overrides_to_mode_check CHECK (to_mode IN ('wins-v0', 'achievements-v1', 'achievements-v2'));
