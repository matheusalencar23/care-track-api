ALTER TYPE "public"."audit_action" ADD VALUE 'attachment.create';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'attachment.upload';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'attachment.link';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'attachment.download';--> statement-breakpoint
ALTER TYPE "public"."audit_resource_type" ADD VALUE 'attachment';--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"record_id" uuid,
	"author_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" bigint NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "attachments_size_positive" CHECK ("attachments"."size" > 0),
	CONSTRAINT "attachments_file_name_not_blank" CHECK (btrim("attachments"."file_name") <> ''),
	CONSTRAINT "attachments_linked_after_upload" CHECK ("attachments"."record_id" is null or "attachments"."uploaded_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_owner_id_patient_id_id_unique" UNIQUE("owner_id","patient_id","id");--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_patient_fk" FOREIGN KEY ("owner_id","patient_id") REFERENCES "public"."patients"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_record_fk" FOREIGN KEY ("owner_id","patient_id","record_id") REFERENCES "public"."records"("owner_id","patient_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_record_index" ON "attachments" USING btree ("owner_id","record_id");--> statement-breakpoint
CREATE POLICY "attachments_owner_isolation" ON "attachments" AS PERMISSIVE FOR ALL TO "care_track_app" USING (owner_id = app_current_owner_id()) WITH CHECK (owner_id = app_current_owner_id());