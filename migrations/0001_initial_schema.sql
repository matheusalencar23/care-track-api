CREATE TYPE "public"."audit_action" AS ENUM('auth.signin', 'auth.signout', 'auth.password_reset', 'patient.create', 'patient.list', 'patient.read', 'patient.update', 'patient.archive', 'patient.unarchive', 'consent.grant', 'consent.list', 'consent.revoke');--> statement-breakpoint
CREATE TYPE "public"."audit_resource_type" AS ENUM('user', 'patient', 'consent');--> statement-breakpoint
CREATE TYPE "public"."consent_grantor" AS ENUM('patient', 'legal_representative');--> statement-breakpoint
CREATE TYPE "public"."consent_method" AS ENUM('written', 'verbal');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('image_capture');--> statement-breakpoint
CREATE TYPE "public"."brazilian_state" AS ENUM('AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"resource_type" "audit_resource_type" NOT NULL,
	"resource_id" uuid,
	"patient_id" uuid,
	"request_id" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"type" "consent_type" NOT NULL,
	"method" "consent_method" NOT NULL,
	"grantor" "consent_grantor" NOT NULL,
	"representative_name" text,
	"collected_at" timestamp with time zone NOT NULL,
	"status" "consent_status" DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consents_representative_name" CHECK (("consents"."grantor" = 'legal_representative') = ("consents"."representative_name" is not null)),
	CONSTRAINT "consents_revocation" CHECK (("consents"."status" = 'revoked') = ("consents"."revoked_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"search_name" text NOT NULL,
	"birth_date" date NOT NULL,
	"cpf" text,
	"cns" text,
	"phone" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patients_owner_id_id_unique" UNIQUE("owner_id","id"),
	CONSTRAINT "patients_owner_id_cpf_unique" UNIQUE("owner_id","cpf"),
	CONSTRAINT "patients_owner_id_cns_unique" UNIQUE("owner_id","cns")
);
--> statement-breakpoint
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"coren" text NOT NULL,
	"coren_state" "brazilian_state" NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email"))
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_patient_fk" FOREIGN KEY ("owner_id","patient_id") REFERENCES "public"."patients"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_created_at_index" ON "audit_logs" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_patient_id_created_at_index" ON "audit_logs" USING btree ("patient_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_created_at_index" ON "password_reset_tokens" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "consents_one_active_per_type" ON "consents" USING btree ("owner_id","patient_id","type") WHERE "consents"."status" = 'active';--> statement-breakpoint
CREATE INDEX "consents_owner_id_patient_id_created_at_index" ON "consents" USING btree ("owner_id","patient_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_id_created_at_index" ON "email_verification_tokens" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "patients_owner_id_search_name_id_index" ON "patients" USING btree ("owner_id","search_name","id");--> statement-breakpoint
CREATE POLICY "consents_owner_isolation" ON "consents" AS PERMISSIVE FOR ALL TO "care_track_app" USING (owner_id = app_current_owner_id()) WITH CHECK (owner_id = app_current_owner_id());--> statement-breakpoint
CREATE POLICY "patients_owner_isolation" ON "patients" AS PERMISSIVE FOR ALL TO "care_track_app" USING (owner_id = app_current_owner_id()) WITH CHECK (owner_id = app_current_owner_id());