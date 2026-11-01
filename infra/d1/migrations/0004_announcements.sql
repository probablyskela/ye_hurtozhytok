CREATE TABLE `announcement_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`announcement_id` integer NOT NULL,
	`key` text NOT NULL,
	`position` integer NOT NULL,
	`content_type` text NOT NULL,
	`width` integer,
	`height` integer,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `announcement_images_idx` ON `announcement_images` (`announcement_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `announcement_images_key_idx` ON `announcement_images` (`key`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_id` integer NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`place` text,
	`date` text,
	`start_min` integer,
	`important` integer DEFAULT false NOT NULL,
	`audience` text DEFAULT 'all' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reject_reason` text,
	`decided_by` integer,
	`decided_at` integer,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`author_id`) REFERENCES `residents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_by`) REFERENCES `residents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `announcements_status_date_idx` ON `announcements` (`status`,`date`);--> statement-breakpoint
CREATE INDEX `announcements_status_published_idx` ON `announcements` (`status`,`published_at`);--> statement-breakpoint
CREATE TABLE `push_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscription_id` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`url` text NOT NULL,
	`created_at` integer NOT NULL,
	`claimed_at` integer
);
--> statement-breakpoint
CREATE INDEX `push_outbox_claimed_idx` ON `push_outbox` (`claimed_at`,`id`);