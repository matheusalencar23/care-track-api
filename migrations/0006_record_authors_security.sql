CREATE FUNCTION check_record_version_author() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = NEW.author_id
      AND name = NEW.author_name
      AND coren = NEW.author_coren
      AND coren_state = NEW.author_coren_state
  ) THEN
    RAISE EXCEPTION 'The author of a record version must match the current data of the user'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER record_versions_check_author
BEFORE INSERT ON record_versions
FOR EACH ROW EXECUTE FUNCTION check_record_version_author();
