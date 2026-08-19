CREATE TABLE `scheduled_bout_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`basho_id` text NOT NULL,
	`day` integer NOT NULL,
	`source` text NOT NULL,
	`published_at` text NOT NULL,
	FOREIGN KEY (`basho_id`) REFERENCES `basho`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scheduled_bout_publications_basho_day_idx` ON `scheduled_bout_publications` (`basho_id`,`day`);--> statement-breakpoint
CREATE TABLE `scheduled_bouts` (
	`id` text PRIMARY KEY NOT NULL,
	`basho_id` text NOT NULL,
	`day` integer NOT NULL,
	`east_rikishi_id` text NOT NULL,
	`west_rikishi_id` text NOT NULL,
	`status` text NOT NULL,
	`withdrawn_rikishi_id` text,
	FOREIGN KEY (`basho_id`) REFERENCES `basho`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`east_rikishi_id`) REFERENCES `rikishi`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`west_rikishi_id`) REFERENCES `rikishi`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`withdrawn_rikishi_id`) REFERENCES `rikishi`(`id`) ON UPDATE no action ON DELETE set null
);
