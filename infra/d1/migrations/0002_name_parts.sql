ALTER TABLE `residents` ADD `first_name` text;--> statement-breakpoint
ALTER TABLE `residents` ADD `last_name` text;--> statement-breakpoint
ALTER TABLE `residents` ADD `patronymic` text;--> statement-breakpoint
-- Existing rows hold «Імʼя Прізвище»; the patronymic arrives at the next sign-in.
UPDATE `residents` SET
  `first_name` = CASE WHEN instr(`name`, ' ') > 0 THEN substr(`name`, 1, instr(`name`, ' ') - 1) ELSE `name` END,
  `last_name` = CASE WHEN instr(`name`, ' ') > 0 THEN substr(`name`, instr(`name`, ' ') + 1) ELSE '' END
WHERE `first_name` IS NULL;
