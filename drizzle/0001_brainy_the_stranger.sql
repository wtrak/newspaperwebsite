ALTER TABLE `newspaper_issues` ADD `month_day` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `newspaper_issues` ADD `source_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `newspaper_issues` ADD `source_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `newspaper_issues` ADD `rights_basis` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `newspaper_issues` ADD `rights_checked_at` text;--> statement-breakpoint
ALTER TABLE `newspaper_issues` ADD `commercial_use_status` text DEFAULT 'Unreviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE `newspaper_issues` ADD `catalog_status` text DEFAULT 'Archive lead' NOT NULL;--> statement-breakpoint
UPDATE `newspaper_issues` SET `month_day` = substr(`issue_date`, 6, 5) WHERE `month_day` = '';--> statement-breakpoint
CREATE INDEX `idx_newspaper_issues_month_day` ON `newspaper_issues` (`month_day`);--> statement-breakpoint
CREATE INDEX `idx_newspaper_issues_headline` ON `newspaper_issues` (`headline`);--> statement-breakpoint
PRAGMA optimize;
