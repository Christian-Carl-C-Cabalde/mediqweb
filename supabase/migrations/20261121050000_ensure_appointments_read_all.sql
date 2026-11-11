-- File: supabase/migrations/20261121050000_ensure_appointments_read_all.sql
-- Purpose: Ensure authenticated users with ADMIN role can read all appointments
--          (defense in depth alongside secretaries_admins_all_appointments).
--          Idempotent: DROP IF EXISTS + CREATE.

DROP POLICY IF EXISTS authenticated_read_all_appointments ON appointments;
CREATE POLICY authenticated_read_all_appointments
  ON appointments
  FOR SELECT
  TO authenticated
  USING (mediq_current_role() = 'ADMIN');
