CREATE TABLE `challenges` (
	`did` text PRIMARY KEY NOT NULL,
	`nonce` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`did`) REFERENCES `identities`(`did`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `entry_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`did` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entry_nodes_url_unique` ON `entry_nodes` (`url`);--> statement-breakpoint
CREATE TABLE `identities` (
	`did` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`legal_information` text NOT NULL,
	`license_id` text,
	`license` text
);
