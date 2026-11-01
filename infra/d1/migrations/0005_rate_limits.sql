ALTER TABLE `announcements` ADD `broadcast_at` integer;--> statement-breakpoint
CREATE INDEX `announcements_author_idx` ON `announcements` (`author_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activity_actor_idx` ON `activity_log` (`actor_id`,`created_at`);--> statement-breakpoint
-- Important announcements published before this column existed were already sent.
UPDATE `announcements` SET `broadcast_at` = `published_at` WHERE `important` = 1 AND `published_at` IS NOT NULL;
