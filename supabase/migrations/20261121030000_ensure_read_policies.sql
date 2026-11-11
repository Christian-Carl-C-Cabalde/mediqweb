-- File: supabase/migrations/20261121030000_ensure_read_policies.sql
-- Purpose: Ensure RLS policies allow authenticated users to read users, doctors,
--          and specializations tables (needed by admin staff directory).
--          Idempotent: DROP IF EXISTS + CREATE is safe to re-run.

DROP POLICY IF EXISTS authenticated_read_all_users ON users;
CREATE POLICY authenticated_read_all_users
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS authenticated_read_all_doctors ON doctors;
CREATE POLICY authenticated_read_all_doctors
  ON doctors
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS authenticated_read_all_specializations ON specializations;
CREATE POLICY authenticated_read_all_specializations
  ON specializations
  FOR SELECT
  TO authenticated
  USING (true);
