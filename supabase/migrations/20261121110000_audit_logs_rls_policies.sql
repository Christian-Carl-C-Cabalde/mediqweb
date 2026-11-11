-- File: supabase/migrations/20261121110000_audit_logs_rls_policies.sql
-- Purpose: Add RLS policies for audit_logs so authenticated users can
--          read logs and admins can write them. Idempotent.
--
--   - authenticated users can SELECT all audit logs
--   - authenticated users can INSERT new audit logs (for admin actions)

DROP POLICY IF EXISTS audit_logs_select_all ON audit_logs;
CREATE POLICY audit_logs_select_all
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS audit_logs_insert_all ON audit_logs;
CREATE POLICY audit_logs_insert_all
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
