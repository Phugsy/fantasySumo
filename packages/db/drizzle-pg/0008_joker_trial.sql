CREATE TABLE "basho_joker_trial" (
  "basho_id" text PRIMARY KEY REFERENCES "basho"("id") ON DELETE CASCADE,
  "preset" text NOT NULL CHECK ("preset" = 'three-joker-v1'),
  "base_mode" text NOT NULL CHECK ("base_mode" IN ('wins-v0', 'achievements-v1')),
  "clock" text NOT NULL,
  "clock_set_at" text NOT NULL
);
CREATE TABLE "joker_allocations" (
  "basho_id" text NOT NULL REFERENCES "basho"("id") ON DELETE CASCADE,
  "team_id" text NOT NULL REFERENCES "fantasy_teams"("id") ON DELETE CASCADE,
  "day" integer NOT NULL CHECK ("day" BETWEEN 1 AND 15),
  "payload_json" text NOT NULL,
  PRIMARY KEY ("team_id", "day")
);
CREATE TABLE "joker_events" (
  "id" text PRIMARY KEY NOT NULL,
  "basho_id" text NOT NULL REFERENCES "basho"("id") ON DELETE CASCADE,
  "team_id" text NOT NULL REFERENCES "fantasy_teams"("id") ON DELETE CASCADE,
  "request_id" text,
  "fingerprint" text NOT NULL,
  "payload_json" text NOT NULL,
  "created_at" text NOT NULL,
  UNIQUE ("team_id", "request_id")
);

CREATE FUNCTION reject_joker_event_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Joker events are immutable'; END $$;
CREATE TRIGGER joker_events_no_update BEFORE UPDATE ON joker_events FOR EACH ROW EXECUTE FUNCTION reject_joker_event_update();
