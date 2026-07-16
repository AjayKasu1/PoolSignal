CREATE TABLE `source_product_versions` (
	`source_name` text NOT NULL,
	`record_key` text NOT NULL,
	`record_hash` text NOT NULL,
	`canonical_json` text NOT NULL,
	`first_observed_at` text NOT NULL,
	`last_observed_at` text NOT NULL,
	PRIMARY KEY(`source_name`, `record_key`)
);
--> statement-breakpoint
CREATE INDEX `source_product_versions_observed_idx` ON `source_product_versions` (`source_name`,`last_observed_at`);
--> statement-breakpoint
CREATE TABLE `source_change_events` (
	`event_key` text PRIMARY KEY NOT NULL,
	`source_name` text NOT NULL,
	`record_key` text NOT NULL,
	`qi_id` text NOT NULL,
	`change_type` text NOT NULL,
	`before_hash` text,
	`after_hash` text NOT NULL,
	`changed_fields_json` text DEFAULT '[]' NOT NULL,
	`before_json` text,
	`after_json` text NOT NULL,
	`observed_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`processing_started_at` text,
	`next_attempt_at` text,
	`last_error` text,
	`processed_at` text,
	`agent_run_key` text
);
--> statement-breakpoint
CREATE INDEX `source_change_events_status_idx` ON `source_change_events` (`status`,`next_attempt_at`,`observed_at`);
--> statement-breakpoint
CREATE INDEX `source_change_events_qi_idx` ON `source_change_events` (`qi_id`,`observed_at`);
--> statement-breakpoint
CREATE TABLE `live_agent_runs` (
	`run_key` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL UNIQUE,
	`event_key` text NOT NULL,
	`qi_id` text NOT NULL,
	`status` text NOT NULL,
	`review_priority` integer NOT NULL,
	`requires_human` integer NOT NULL,
	`result_json` text NOT NULL,
	`agent_version` text NOT NULL,
	`policy_version` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `live_agent_runs_event_idx` ON `live_agent_runs` (`event_key`,`completed_at`);
