CREATE TABLE `basho_joker_trial` (
	`basho_id` text PRIMARY KEY NOT NULL,
	`preset` text NOT NULL,
	`base_mode` text NOT NULL,
	`clock` text NOT NULL,
	`clock_set_at` text NOT NULL,
	FOREIGN KEY (`basho_id`) REFERENCES `basho`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "joker_preset" CHECK("basho_joker_trial"."preset" = 'three-joker-v1'),
	CONSTRAINT "joker_base_mode" CHECK("basho_joker_trial"."base_mode" IN ('wins-v0', 'achievements-v1'))
);
--> statement-breakpoint
CREATE TABLE `joker_allocations` (
	`basho_id` text NOT NULL,
	`team_id` text NOT NULL,
	`day` integer NOT NULL,
	`payload_json` text NOT NULL,
	PRIMARY KEY(`team_id`, `day`),
	FOREIGN KEY (`basho_id`) REFERENCES `basho`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `fantasy_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "joker_day" CHECK("joker_allocations"."day" BETWEEN 1 AND 15)
);
--> statement-breakpoint
CREATE TABLE `joker_events` (
	`id` text PRIMARY KEY NOT NULL,
	`basho_id` text NOT NULL,
	`team_id` text NOT NULL,
	`request_id` text,
	`fingerprint` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`basho_id`) REFERENCES `basho`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `fantasy_teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `joker_event_request_idx` ON `joker_events` (`team_id`,`request_id`);
--> statement-breakpoint
CREATE TRIGGER joker_events_no_update BEFORE UPDATE ON joker_events BEGIN SELECT RAISE(ABORT, 'Joker events are immutable'); END;
