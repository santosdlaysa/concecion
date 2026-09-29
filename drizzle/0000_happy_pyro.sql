CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_id` text NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`year` integer NOT NULL,
	`mileage` integer NOT NULL,
	`price` integer NOT NULL,
	`location` text NOT NULL,
	`image` text,
	`description` text,
	`whatsapp` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_listings_recent` ON `listings` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_listings_make` ON `listings` (`make`);--> statement-breakpoint
CREATE INDEX `idx_listings_seller` ON `listings` (`seller_id`);--> statement-breakpoint
CREATE TABLE `sellers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sellers_email_unique` ON `sellers` (`email`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`seller_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_seller` ON `sessions` (`seller_id`);