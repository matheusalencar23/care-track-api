ALTER TYPE "public"."audit_action" ADD VALUE 'attachment.thumbnail';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'attachment.thumbnail_generate';--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "thumbnail_storage_key" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_thumbnail_storage_key_unique" UNIQUE("thumbnail_storage_key");--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_thumbnail_only_images" CHECK ("attachments"."thumbnail_storage_key" is null or "attachments"."content_type" like 'image/%');