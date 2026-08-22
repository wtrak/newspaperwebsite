CREATE TABLE `newspaper_issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`publication_id` integer NOT NULL,
	`issue_date` text NOT NULL,
	`decade` text NOT NULL,
	`edition` text DEFAULT '' NOT NULL,
	`headline` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`occasion` text DEFAULT 'History' NOT NULL,
	`keywords` text DEFAULT '[]' NOT NULL,
	`rights_status` text DEFAULT 'Rights review' NOT NULL,
	`asset_status` text DEFAULT 'Source requested' NOT NULL,
	`source_reference` text DEFAULT '' NOT NULL,
	`preview_asset_key` text,
	`print_asset_key` text,
	`featured` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`publication_id`) REFERENCES `publications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_newspaper_issues_slug` ON `newspaper_issues` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_newspaper_issues_publication_date_edition` ON `newspaper_issues` (`publication_id`,`issue_date`,`edition`);--> statement-breakpoint
CREATE INDEX `idx_newspaper_issues_date` ON `newspaper_issues` (`issue_date`);--> statement-breakpoint
CREATE INDEX `idx_newspaper_issues_decade_occasion` ON `newspaper_issues` (`decade`,`occasion`);--> statement-breakpoint
CREATE INDEX `idx_newspaper_issues_asset_status` ON `newspaper_issues` (`asset_status`);--> statement-breakpoint
CREATE TABLE `print_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`items_json` text NOT NULL,
	`estimated_subtotal` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_print_requests_status_created` ON `print_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `publications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`region` text NOT NULL,
	`country` text DEFAULT 'United States' NOT NULL,
	`language` text DEFAULT 'English' NOT NULL,
	`coverage_start` text,
	`coverage_end` text,
	`archive_source` text DEFAULT '' NOT NULL,
	`rights_notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_publications_slug` ON `publications` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_publications_location` ON `publications` (`country`,`region`,`city`);--> statement-breakpoint
PRAGMA optimize;
