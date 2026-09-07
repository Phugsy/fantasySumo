CREATE TABLE basho_scoring_config (
  basho_id text PRIMARY KEY REFERENCES basho(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'wins-v0',
  locked boolean NOT NULL DEFAULT false
);
CREATE TABLE special_prize_snapshots (
  basho_id text PRIMARY KEY REFERENCES basho(id) ON DELETE CASCADE,
  source text NOT NULL,
  fetched_at text NOT NULL,
  awards_json text NOT NULL
);
INSERT INTO basho_scoring_config (basho_id, mode, locked)
SELECT id, 'wins-v0', status <> 'upcoming' OR EXISTS (SELECT 1 FROM fantasy_teams WHERE basho_id = basho.id AND locked_at IS NOT NULL) FROM basho;
-- Keep the function on one line: the migration runner splits at semicolon/newline boundaries.
CREATE FUNCTION maintain_basho_scoring_config() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP = 'INSERT' THEN INSERT INTO basho_scoring_config (basho_id, mode, locked) VALUES (NEW.id, 'wins-v0', NEW.status <> 'upcoming'); ELSIF NEW.status <> 'upcoming' THEN UPDATE basho_scoring_config SET locked = true WHERE basho_id = NEW.id; END IF; RETURN NEW; END; $$;
CREATE TRIGGER basho_scoring_create AFTER INSERT ON basho FOR EACH ROW EXECUTE FUNCTION maintain_basho_scoring_config();
CREATE TRIGGER basho_scoring_lock AFTER UPDATE OF status ON basho FOR EACH ROW EXECUTE FUNCTION maintain_basho_scoring_config();
