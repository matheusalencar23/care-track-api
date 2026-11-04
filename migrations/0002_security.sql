GRANT USAGE ON SCHEMA public TO care_track_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON users TO care_track_app;
--> statement-breakpoint
GRANT UPDATE (password_hash, email_verified_at, password_changed_at, updated_at) ON users TO care_track_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON email_verification_tokens, password_reset_tokens TO care_track_app;
--> statement-breakpoint
GRANT UPDATE (used_at) ON email_verification_tokens, password_reset_tokens TO care_track_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON patients TO care_track_app;
--> statement-breakpoint
GRANT UPDATE (name, search_name, birth_date, cpf, cns, phone, archived_at, updated_at) ON patients TO care_track_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON consents TO care_track_app;
--> statement-breakpoint
GRANT UPDATE (status, revoked_at, revocation_reason, updated_at) ON consents TO care_track_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON audit_logs TO care_track_app;
--> statement-breakpoint

CREATE FUNCTION reject_audit_log_change() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are append-only'
    USING ERRCODE = 'insufficient_privilege';
END
$$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION reject_audit_log_change();
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_log_change();
--> statement-breakpoint

CREATE FUNCTION reject_owner_change() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'The owner of a % cannot change', TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER patients_owner_immutable
BEFORE UPDATE ON patients
FOR EACH ROW EXECUTE FUNCTION reject_owner_change();
--> statement-breakpoint

CREATE FUNCTION protect_consent() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'revoked' THEN
    RAISE EXCEPTION 'A revoked consent cannot be changed or reactivated'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF (NEW.id, NEW.owner_id, NEW.patient_id, NEW.type, NEW.method, NEW.grantor,
      NEW.representative_name, NEW.collected_at, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.owner_id, OLD.patient_id, OLD.type, OLD.method, OLD.grantor,
      OLD.representative_name, OLD.collected_at, OLD.created_at) THEN
    RAISE EXCEPTION 'The data of a consent cannot change'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER consents_protect
BEFORE UPDATE ON consents
FOR EACH ROW EXECUTE FUNCTION protect_consent();
