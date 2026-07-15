CREATE TABLE `source_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text NOT NULL,
	`checksum` text NOT NULL,
	`captured_at` text NOT NULL,
	`status` text NOT NULL,
	`record_count` integer DEFAULT 0 NOT NULL,
	`retained_count` integer DEFAULT 0 NOT NULL,
	`newest_record_at` text,
	`detail_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `source_snapshots_source_time_idx` ON `source_snapshots` (`source_name`,`captured_at`);
--> statement-breakpoint
CREATE TABLE `live_products` (
	`qi_id` text PRIMARY KEY NOT NULL,
	`brand` text NOT NULL,
	`product_name` text NOT NULL,
	`part_number` text NOT NULL,
	`product_type` text NOT NULL,
	`power_profile` text NOT NULL,
	`load_power` real NOT NULL,
	`version` text NOT NULL,
	`certification_date` text NOT NULL,
	`source_url` text NOT NULL,
	`source_checksum` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `live_products_certification_idx` ON `live_products` (`certification_date`);
--> statement-breakpoint
CREATE TABLE `via_public_entities` (
	`normalized_name` text PRIMARY KEY NOT NULL,
	`public_name` text NOT NULL,
	`source_checksum` text NOT NULL,
	`source_url` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `via_public_entities_active_idx` ON `via_public_entities` (`active`,`normalized_name`);
--> statement-breakpoint
CREATE TABLE `entity_resolution_cache` (
	`query_key` text PRIMARY KEY NOT NULL,
	`query_text` text NOT NULL,
	`result_json` text DEFAULT '[]' NOT NULL,
	`result_count` integer DEFAULT 0 NOT NULL,
	`retrieved_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `entity_resolution_cache_expiry_idx` ON `entity_resolution_cache` (`expires_at`);
