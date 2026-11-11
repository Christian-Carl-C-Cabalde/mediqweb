-- File: supabase/migrations/20261121070000_allow_admin_insert_profiles.sql
-- Purpose: Allow authenticated users with ADMIN role to insert profile rows,
--          so the admin can create staff accounts through the web UI.
--          Idempotent: DROP IF EXISTS + CREATE.

DROP POLICY IF EXISTS admin_insert_profiles ON profiles;
CREATE POLICY admin_insert_profiles
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (mediq_current_role() = 'ADMIN');
