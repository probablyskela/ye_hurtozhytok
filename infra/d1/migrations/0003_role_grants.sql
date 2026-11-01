CREATE TABLE `role_grants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`granted_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`granted_by`) REFERENCES `residents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_grants_email_role_idx` ON `role_grants` (`email`,`role`);--> statement-breakpoint
-- Keep today's student council: their role moves to role_grants by email.
INSERT INTO `role_grants` (`email`, `role`, `granted_by`, `created_at`)
SELECT lower(`email`), 'council', NULL, CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `residents` WHERE `role` = 'council';--> statement-breakpoint
ALTER TABLE `residents` DROP COLUMN `role`;