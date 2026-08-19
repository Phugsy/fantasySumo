CREATE TABLE "scheduled_bout_publications" (
  "id" text PRIMARY KEY NOT NULL,
  "basho_id" text NOT NULL,
  "day" integer NOT NULL,
  "source" text NOT NULL,
  "published_at" text NOT NULL,
  CONSTRAINT "scheduled_bout_publications_basho_id_basho_id_fk"
    FOREIGN KEY ("basho_id") REFERENCES "public"."basho"("id")
    ON DELETE cascade ON UPDATE no action
);

CREATE UNIQUE INDEX "scheduled_bout_publications_basho_day_idx"
  ON "scheduled_bout_publications" USING btree ("basho_id", "day");

CREATE TABLE "scheduled_bouts" (
  "id" text PRIMARY KEY NOT NULL,
  "basho_id" text NOT NULL,
  "day" integer NOT NULL,
  "east_rikishi_id" text NOT NULL,
  "west_rikishi_id" text NOT NULL,
  "status" text NOT NULL,
  "withdrawn_rikishi_id" text,
  CONSTRAINT "scheduled_bouts_basho_id_basho_id_fk"
    FOREIGN KEY ("basho_id") REFERENCES "public"."basho"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "scheduled_bouts_east_rikishi_id_rikishi_id_fk"
    FOREIGN KEY ("east_rikishi_id") REFERENCES "public"."rikishi"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "scheduled_bouts_west_rikishi_id_rikishi_id_fk"
    FOREIGN KEY ("west_rikishi_id") REFERENCES "public"."rikishi"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "scheduled_bouts_withdrawn_rikishi_id_rikishi_id_fk"
    FOREIGN KEY ("withdrawn_rikishi_id") REFERENCES "public"."rikishi"("id")
    ON DELETE set null ON UPDATE no action
);
