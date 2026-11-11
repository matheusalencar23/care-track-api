ALTER TABLE "attachments" DROP CONSTRAINT "attachments_thumbnail_storage_key_unique";--> statement-breakpoint
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_thumbnail_only_images";--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "thumbnail_storage_key";