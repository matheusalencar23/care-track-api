CREATE TYPE "public"."record_void_reason" AS ENUM('wrong_patient', 'duplicate', 'other');--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'record.void';--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "voided_by" uuid;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "void_reason" "record_void_reason";--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "void_reason_details" text;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_void" CHECK (("records"."voided_at" is null) = ("records"."voided_by" is null)
        and ("records"."voided_at" is null) = ("records"."void_reason" is null));--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_void_reason_details" CHECK (("records"."void_reason" is distinct from 'other' or "records"."void_reason_details" is not null)
        and ("records"."void_reason_details" is null
          or ("records"."void_reason" is not null and btrim("records"."void_reason_details") <> '')));