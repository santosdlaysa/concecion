CREATE TABLE `listing_metrics` (
	`listing_id` text PRIMARY KEY NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`whatsapp_clicks` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `sellers` ADD `store_slug` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sellers` ADD `plan` text DEFAULT 'free' NOT NULL;