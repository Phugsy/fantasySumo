CREATE TABLE `basho_game_config` (
	`basho_id` text PRIMARY KEY NOT NULL,
	`team_size` integer DEFAULT 2 NOT NULL,
	FOREIGN KEY (`basho_id`) REFERENCES `basho`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "basho_game_config_team_size_positive" CHECK("basho_game_config"."team_size" > 0)
);
