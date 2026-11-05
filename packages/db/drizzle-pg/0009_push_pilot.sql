CREATE TABLE "push_pilots" (
	"basho_id" text PRIMARY KEY NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"roster_json" text NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"day_counts_json" text DEFAULT '{}' NOT NULL,
	"decisions_json" text DEFAULT '{}' NOT NULL,
	"last_cleanup_at" text,
	FOREIGN KEY ("basho_id") REFERENCES "basho"("id") ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "push_pilot_enabled" CHECK("push_pilots"."enabled" IN (0,1)),
	CONSTRAINT "push_pilot_cap" CHECK("push_pilots"."total_attempts" BETWEEN 0 AND 300)
);

CREATE TABLE "push_openings" (
	"id" text PRIMARY KEY NOT NULL,
	"basho_id" text NOT NULL,
	"owner_key" text NOT NULL,
	"day" integer NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"attempted" integer DEFAULT 0 NOT NULL,
	"subscription_revision" text,
	"created_at" text NOT NULL,
	FOREIGN KEY ("basho_id") REFERENCES "push_pilots"("basho_id") ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "push_opening_day" CHECK("push_openings"."day" BETWEEN 1 AND 15),
	CONSTRAINT "push_opening_attempted" CHECK("push_openings"."attempted" IN (0,1))
);

CREATE TABLE "push_subscriptions" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"basho_id" text NOT NULL,
	"device_id" text NOT NULL,
	"endpoint_hash" text NOT NULL,
	"revoke_hash" text NOT NULL,
	"revision" text NOT NULL,
	"payload_json" text NOT NULL,
	"consent_at" text NOT NULL,
	FOREIGN KEY ("basho_id") REFERENCES "push_pilots"("basho_id") ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX "push_opening_unique" ON "push_openings" ("basho_id","owner_key","day");

CREATE UNIQUE INDEX "push_device_unique" ON "push_subscriptions" ("device_id");

CREATE UNIQUE INDEX "push_endpoint_unique" ON "push_subscriptions" ("endpoint_hash");
