GRANT SELECT, INSERT ON terms_acceptances TO care_track_app;
--> statement-breakpoint

CREATE FUNCTION set_terms_acceptance_server_time() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.accepted_at := now();

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER terms_acceptances_server_time
BEFORE INSERT ON terms_acceptances
FOR EACH ROW EXECUTE FUNCTION set_terms_acceptance_server_time();
--> statement-breakpoint
CREATE TRIGGER terms_acceptances_append_only
BEFORE UPDATE OR DELETE ON terms_acceptances
FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
CREATE TRIGGER terms_acceptances_no_truncate
BEFORE TRUNCATE ON terms_acceptances
FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();
