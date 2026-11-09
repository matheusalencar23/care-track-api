CREATE OR REPLACE FUNCTION set_attachment_defaults() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.created_at := now();
  NEW.record_id := NULL;

  RETURN NEW;
END
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION protect_attachment() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.id, NEW.patient_id, NEW.author_id, NEW.file_name, NEW.content_type,
      NEW.size, NEW.sha256, NEW.storage_key, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.patient_id, OLD.author_id, OLD.file_name, OLD.content_type,
      OLD.size, OLD.sha256, OLD.storage_key, OLD.created_at) THEN
    RAISE EXCEPTION 'The data of an attachment cannot change'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.record_id IS NOT NULL AND NEW.record_id IS DISTINCT FROM OLD.record_id THEN
    RAISE EXCEPTION 'An attachment cannot move to another record'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END
$$;
