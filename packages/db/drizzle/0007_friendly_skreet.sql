CREATE TABLE `basho_scoring_config` (
	`basho_id` text PRIMARY KEY NOT NULL,
	`mode` text DEFAULT 'wins-v0' NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`basho_id`) REFERENCES `basho`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `special_prize_snapshots` (
	`basho_id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`fetched_at` text NOT NULL,
	`awards_json` text NOT NULL,
	FOREIGN KEY (`basho_id`) REFERENCES `basho`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO basho_scoring_config (basho_id, mode, locked)
SELECT id, 'wins-v0', status <> 'upcoming' OR EXISTS (SELECT 1 FROM fantasy_teams WHERE basho_id = basho.id AND locked_at IS NOT NULL) FROM basho;
--> statement-breakpoint
CREATE TRIGGER basho_scoring_create AFTER INSERT ON basho BEGIN
  INSERT INTO basho_scoring_config (basho_id, mode, locked) VALUES (NEW.id, 'wins-v0', NEW.status <> 'upcoming');
END;
--> statement-breakpoint
CREATE TRIGGER basho_scoring_lock AFTER UPDATE OF status ON basho WHEN NEW.status <> 'upcoming' BEGIN
  UPDATE basho_scoring_config SET locked = 1 WHERE basho_id = NEW.id;
END;
