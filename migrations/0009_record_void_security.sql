GRANT UPDATE (voided_at, voided_by, void_reason, void_reason_details) ON records TO care_track_app;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION protect_record() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.id, NEW.patient_id, NEW.author_id, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.patient_id, OLD.author_id, OLD.created_at) THEN
    RAISE EXCEPTION 'The identity of a record cannot change'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'A voided record cannot change or be restored'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.voided_at IS NOT NULL THEN
    NEW.voided_at := now();
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint

CREATE FUNCTION reject_version_of_voided_record() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  record_voided_at timestamptz;
BEGIN
  SELECT voided_at INTO record_voided_at
  FROM records
  WHERE id = NEW.record_id
  FOR SHARE;

  IF record_voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'A voided record cannot receive new versions'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER record_versions_reject_voided
BEFORE INSERT ON record_versions
FOR EACH ROW EXECUTE FUNCTION reject_version_of_voided_record();
