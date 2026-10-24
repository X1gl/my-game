CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`red_token` text NOT NULL,
	`blue_token` text,
	`created_at` integer NOT NULL
);
