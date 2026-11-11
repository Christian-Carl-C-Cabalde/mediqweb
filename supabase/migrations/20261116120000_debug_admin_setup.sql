-- Migration: ensure critical RLS policies and admin profile exist (idempotent).
-- This migration can be re‑run safely; it drops any existing policies for the
-- `profiles` table and recreates them, then upserts the admin demo profile.

-- 1. Drop existing policies (if they exist)
DROP POLICY IF EXISTS anon_select_profiles_by_username ON profiles;
DROP POLICY IF EXISTS auth_select_own_profile ON profiles;

-- 2. Re‑create the anonymous SELECT policy (used for username → email lookup)
CREATE POLICY anon_select_profiles_by_username
  ON profiles
  FOR SELECT
  TO anon
  USING (true);

-- 3. Re‑create the authenticated‑user SELECT‑own‑profile policy
CREATE POLICY auth_select_own_profile
  ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 4. Upsert the admin demo profile (links to Supabase Auth user)
INSERT INTO profiles (user_id, username, full_name, email, role, status)
SELECT au.id,
       'admin' AS username,
       'Admin' AS full_name,
       'admin@mediq.app' AS email,
       'ADMIN' AS role,
       'ACTIVE' AS status
FROM auth.users au
WHERE au.email = 'admin@mediq.app'
ON CONFLICT (user_id) DO UPDATE
  SET username = EXCLUDED.username,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      status = EXCLUDED.status;
