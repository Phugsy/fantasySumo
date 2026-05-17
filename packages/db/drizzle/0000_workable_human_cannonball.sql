CREATE TABLE `banzuke_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`basho_id` text NOT NULL,
	`rikishi_id` text NOT NULL,
	`rank` text NOT NULL,
	`rank_order` integer NOT NULL,
	FOREIGN KEY (`basho_id`) REFERENCES `basho`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rikishi_id`) REFERENCES `rikishi`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `banzuke_entries_basho_rikishi_idx` ON `banzuke_entries` (`basho_id`,`rikishi_id`);--> statement-breakpoint
CREATE TABLE `basho` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bout_results` (
	`id` text PRIMARY KEY NOT NULL,
	`basho_id` text NOT NULL,
	`day` integer NOT NULL,
	`winner_rikishi_id` text NOT NULL,
	`loser_rikishi_id` text NOT NULL,
	`kimarite` text,
	`winner_absent` integer DEFAULT false NOT NULL,
	`loser_absent` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`basho_id`) REFERENCES `basho`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`winner_rikishi_id`) REFERENCES `rikishi`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`loser_rikishi_id`) REFERENCES `rikishi`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fantasy_picks` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`rikishi_id` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `fantasy_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rikishi_id`) REFERENCES `rikishi`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fantasy_picks_team_rikishi_idx` ON `fantasy_picks` (`team_id`,`rikishi_id`);--> statement-breakpoint
CREATE TABLE `fantasy_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`basho_id` text NOT NULL,
	`display_name` text NOT NULL,
	`owner_name` text,
	`created_at` text,
	`locked_at` text,
	FOREIGN KEY (`basho_id`) REFERENCES `basho`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rikishi` (
	`id` text PRIMARY KEY NOT NULL,
	`shikona` text NOT NULL,
	`heya` text
);
