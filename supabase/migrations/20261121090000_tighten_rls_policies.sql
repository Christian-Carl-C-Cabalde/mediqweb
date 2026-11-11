-- File: supabase/migrations/20261121090000_tighten_rls_policies.sql
-- Purpose: Tighten RLS policies per security findings.
--   - Remove overly permissive "read all" policies on profiles and users
--   - Remove anonymous read on profiles
--   - Remove direct INSERT policies (writes go through Edge Functions)
--   - Keep: authenticated users read own profile/row; admins read all via role check
-- Idempotent: DROP IF EXISTS + CREATE pattern.

-- ===== profiles =====
-- Drop overly permissive / anonymous policies
DROP POLICY IF EXISTS anon_select_profiles_by_username ON profiles;
DROP POLICY IF EXISTS authenticated_read_all_profiles ON profiles;
DROP POLICY IF EXISTS auth_select_all_profiles_for_admin ON profiles;
DROP POLICY IF EXISTS admin_insert_profiles ON profiles;
DROP POLICY IF EXISTS users_read_own_profile ON profiles;

-- Own-profile read/update for authenticated users
DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own
  ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_select_all_admin ON profiles;
CREATE POLICY profiles_select_all_admin
  ON profiles
  FOR SELECT
  TO authenticated
  USING (mediq_current_role() = 'ADMIN');

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_update_admin ON profiles;
CREATE POLICY profiles_update_admin
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (mediq_current_role() = 'ADMIN')
  WITH CHECK (mediq_current_role() = 'ADMIN');

-- ===== users =====
-- Drop overly permissive policies
DROP POLICY IF EXISTS authenticated_read_all_users ON users;
DROP POLICY IF EXISTS admin_insert_users ON users;
DROP POLICY IF EXISTS users_read_own_row ON users;

-- Own-row read/update for authenticated users
DROP POLICY IF EXISTS users_select_own ON users;
CREATE POLICY users_select_own
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid()::text);

DROP POLICY IF EXISTS users_select_all_admin ON users;
CREATE POLICY users_select_all_admin
  ON users
  FOR SELECT
  TO authenticated
  USING (mediq_current_role() = 'ADMIN');

DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

DROP POLICY IF EXISTS users_update_admin ON users;
CREATE POLICY users_update_admin
  ON users
  FOR UPDATE
  TO authenticated
  USING (mediq_current_role() = 'ADMIN')
  WITH CHECK (mediq_current_role() = 'ADMIN');
