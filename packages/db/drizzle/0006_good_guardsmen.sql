ALTER TABLE `banzuke_entries` ADD `shikona` text;--> statement-breakpoint
ALTER TABLE `banzuke_entries` ADD `heya` text;--> statement-breakpoint
UPDATE `banzuke_entries`
SET
	`shikona` = (
		SELECT `rikishi`.`shikona`
		FROM `rikishi`
		WHERE `rikishi`.`id` = `banzuke_entries`.`rikishi_id`
	),
	`heya` = (
		SELECT `rikishi`.`heya`
		FROM `rikishi`
		WHERE `rikishi`.`id` = `banzuke_entries`.`rikishi_id`
	);
