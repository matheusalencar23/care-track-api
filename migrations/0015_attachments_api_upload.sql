ALTER TABLE "attachments" DROP CONSTRAINT "attachments_linked_after_upload";--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "sha256" text NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "uploaded_at";