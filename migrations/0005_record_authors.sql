ALTER TYPE "public"."audit_action" ADD VALUE 'record.create';--> statement-breakpoint
ALTER TYPE "public"."audit_resource_type" ADD VALUE 'record';--> statement-breakpoint
ALTER TABLE "record_versions" ADD COLUMN "author_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "record_versions" ADD COLUMN "author_coren" text NOT NULL;--> statement-breakpoint
ALTER TABLE "record_versions" ADD COLUMN "author_coren_state" "brazilian_state" NOT NULL;