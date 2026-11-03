CREATE TABLE "record_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content" text,
	"author_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_versions_record_id_version_unique" UNIQUE("record_id","version"),
	CONSTRAINT "record_versions_content_not_blank" CHECK ("record_versions"."content" is null or btrim("record_versions"."content") <> ''),
	CONSTRAINT "record_versions_reason_not_blank" CHECK ("record_versions"."reason" is null or btrim("record_versions"."reason") <> ''),
	CONSTRAINT "record_versions_first_without_reason" CHECK ("record_versions"."version" > 1 or "record_versions"."reason" is null)
);
--> statement-breakpoint
ALTER TABLE "record_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "records" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "records_owner_id_id_unique" UNIQUE("owner_id","id")
);
--> statement-breakpoint
ALTER TABLE "records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "record_versions" ADD CONSTRAINT "record_versions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_versions" ADD CONSTRAINT "record_versions_record_fk" FOREIGN KEY ("owner_id","record_id") REFERENCES "public"."records"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_patient_fk" FOREIGN KEY ("owner_id","patient_id") REFERENCES "public"."patients"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "records_timeline_index" ON "records" USING btree ("owner_id","patient_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "record_versions_owner_isolation" ON "record_versions" AS PERMISSIVE FOR ALL TO "care_track_app" USING (owner_id = app_current_owner_id()) WITH CHECK (owner_id = app_current_owner_id());--> statement-breakpoint
CREATE POLICY "records_owner_isolation" ON "records" AS PERMISSIVE FOR ALL TO "care_track_app" USING (owner_id = app_current_owner_id()) WITH CHECK (owner_id = app_current_owner_id());