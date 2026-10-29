CREATE TABLE "rikishi_source_identities" (
  "source" text NOT NULL CHECK ("source" IN ('jsa', 'sumo-api')),
  "source_rikishi_id" text NOT NULL,
  "rikishi_id" text NOT NULL REFERENCES "rikishi"("id")
);
CREATE UNIQUE INDEX "rikishi_source_identity_idx" ON "rikishi_source_identities" ("source", "source_rikishi_id");
CREATE UNIQUE INDEX "rikishi_source_canonical_idx" ON "rikishi_source_identities" ("source", "rikishi_id");
