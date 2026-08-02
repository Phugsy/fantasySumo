ALTER TABLE `fantasy_teams` ADD `owner_user_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `fantasy_teams_basho_owner_user_idx` ON `fantasy_teams` (`basho_id`,`owner_user_id`);
