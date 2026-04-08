CREATE TABLE `credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer_did` text NOT NULL,
	`subject_did` text NOT NULL,
	`type` text NOT NULL,
	`jwt` text NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`subject_did`) REFERENCES `did_documents`(`did`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `did_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`did` text NOT NULL,
	`document` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `did_documents_did_unique` ON `did_documents` (`did`);--> statement-breakpoint
CREATE TABLE `entry_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`subject_did` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`subject_did`) REFERENCES `did_documents`(`did`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entry_nodes_url_unique` ON `entry_nodes` (`url`);