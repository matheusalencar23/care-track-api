GRANT SELECT, INSERT ON attachments TO care_track_app;
--> statement-breakpoint
GRANT UPDATE (record_id, uploaded_at) ON attachments TO care_track_app;
--> statement-breakpoint

CREATE FUNCTION set_attachment_defaults() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.created_at := now();
  NEW.uploaded_at := NULL;
  NEW.record_id := NULL;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER attachments_set_defaults
BEFORE INSERT ON attachments
FOR EACH ROW EXECUTE FUNCTION set_attachment_defaults();
--> statement-breakpoint

CREATE TRIGGER attachments_owner_immutable
BEFORE UPDATE ON attachments
FOR EACH ROW EXECUTE FUNCTION reject_owner_change();
--> statement-breakpoint

CREATE FUNCTION protect_attachment() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.id, NEW.patient_id, NEW.author_id, NEW.file_name, NEW.content_type,
      NEW.size, NEW.storage_key, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.patient_id, OLD.author_id, OLD.file_name, OLD.content_type,
      OLD.size, OLD.storage_key, OLD.created_at) THEN
    RAISE EXCEPTION 'The data of an attachment cannot change'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.record_id IS NOT NULL AND NEW.record_id IS DISTINCT FROM OLD.record_id THEN
    RAISE EXCEPTION 'An attachment cannot move to another record'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.uploaded_at IS NOT NULL THEN
    IF NEW.uploaded_at IS DISTINCT FROM OLD.uploaded_at THEN
      RAISE EXCEPTION 'The upload time of an attachment cannot change'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NEW.uploaded_at IS NOT NULL THEN
    NEW.uploaded_at := now();
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER attachments_protect
BEFORE UPDATE ON attachments
FOR EACH ROW EXECUTE FUNCTION protect_attachment();
