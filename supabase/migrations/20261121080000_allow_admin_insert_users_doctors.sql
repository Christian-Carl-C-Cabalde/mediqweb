-- File: supabase/migrations/20261121080000_allow_admin_insert_users_doctors.sql
-- Purpose: Allow authenticated users with ADMIN role to insert into users,
--          doctors, and profiles tables (backup for service-role client).
--          Idempotent: DROP IF EXISTS + CREATE.

-- ===== users =====
DROP POLICY IF EXISTS admin_insert_users ON users;
CREATE POLICY admin_insert_users
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (mediq_current_role() = 'ADMIN');

-- ===== doctors =====
DROP POLICY IF EXISTS admin_insert_doctors ON doctors;
CREATE POLICY admin_insert_doctors
  ON doctors
  FOR INSERT
  TO authenticated
  WITH CHECK (mediq_current_role() = 'ADMIN');
