-- 013_audit_append_only.sql
-- Enforce append-only on activity_logs at the database level.
-- REVOKE alone cannot enforce this: the app connects as the table owner,
-- and owners bypass grant checks. A trigger that raises on any mutation
-- is the reliable boundary — corrections happen by inserting new rows.

CREATE OR REPLACE FUNCTION activity_logs_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'raise_exception';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_logs_no_update
  BEFORE UPDATE ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION activity_logs_append_only();

CREATE TRIGGER activity_logs_no_delete
  BEFORE DELETE ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION activity_logs_append_only();

CREATE TRIGGER activity_logs_no_truncate
  BEFORE TRUNCATE ON activity_logs
  FOR EACH STATEMENT EXECUTE FUNCTION activity_logs_append_only();
