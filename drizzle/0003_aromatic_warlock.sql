CREATE TABLE `community_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`banner_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`banner_id`) REFERENCES `community_images`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `community_reports` (
	`user_id` text NOT NULL,
	`review_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	`handled_at` integer,
	PRIMARY KEY(`user_id`, `review_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`review_id`) REFERENCES `community_reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `community_reports_queue` ON `community_reports` (`review_id`,`handled_at`);