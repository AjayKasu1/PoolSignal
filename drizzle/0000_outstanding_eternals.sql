CREATE TABLE `agent_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` text NOT NULL,
	`status` text NOT NULL,
	`trace_json` text DEFAULT '[]' NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `review_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`qi_id` text NOT NULL,
	`brand` text NOT NULL,
	`product_name` text NOT NULL,
	`stage` text DEFAULT 'review' NOT NULL,
	`priority` integer NOT NULL,
	`public_list_match` text NOT NULL,
	`evidence_json` text DEFAULT '[]' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` text NOT NULL,
	`decision` text NOT NULL,
	`rationale` text DEFAULT '' NOT NULL,
	`actor` text DEFAULT 'authenticated-reviewer' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
