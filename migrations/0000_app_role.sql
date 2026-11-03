DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'care_track_app') THEN
    CREATE ROLE care_track_app NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
CREATE FUNCTION app_current_owner_id() RETURNS uuid
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  owner_id text := current_setting('app.owner_id', true);
BEGIN
  IF owner_id IS NULL OR owner_id = '' THEN
    RAISE EXCEPTION 'Owner scope is not set'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN owner_id::uuid;
END
$$;
