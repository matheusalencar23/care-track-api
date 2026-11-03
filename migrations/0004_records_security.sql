GRANT SELECT, INSERT ON records, record_versions TO care_track_app;
--> statement-breakpoint

CREATE FUNCTION set_record_server_time() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.created_at := now();

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER records_server_time
BEFORE INSERT ON records
FOR EACH ROW EXECUTE FUNCTION set_record_server_time();
--> statement-breakpoint

CREATE TRIGGER records_owner_immutable
BEFORE UPDATE ON records
FOR EACH ROW EXECUTE FUNCTION reject_owner_change();
--> statement-breakpoint

CREATE FUNCTION protect_record() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.id, NEW.patient_id, NEW.author_id, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.patient_id, OLD.author_id, OLD.created_at) THEN
    RAISE EXCEPTION 'The identity of a record cannot change'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER records_protect
BEFORE UPDATE ON records
FOR EACH ROW EXECUTE FUNCTION protect_record();
--> statement-breakpoint

CREATE FUNCTION require_record_version() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM record_versions WHERE record_id = NEW.id) THEN
    RAISE EXCEPTION 'A record needs its first version in the same transaction'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER records_require_version
AFTER INSERT ON records
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION require_record_version();
--> statement-breakpoint

CREATE FUNCTION set_record_version() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.created_at := now();
  NEW.version := coalesce(
    (SELECT max(version) FROM record_versions WHERE record_id = NEW.record_id),
    0
  ) + 1;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER record_versions_set_version
BEFORE INSERT ON record_versions
FOR EACH ROW EXECUTE FUNCTION set_record_version();
--> statement-breakpoint

CREATE FUNCTION reject_append_only_change() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Rows of % are append-only', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END
$$;
--> statement-breakpoint
CREATE TRIGGER record_versions_append_only
BEFORE UPDATE OR DELETE ON record_versions
FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
CREATE TRIGGER record_versions_no_truncate
BEFORE TRUNCATE ON record_versions
FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();
