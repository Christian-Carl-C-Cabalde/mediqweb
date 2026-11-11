-- Migration: allow authenticated users to read their own profile
-- This policy lets a signed‑in user fetch the row in `profiles` that belongs to them.
-- It is required for the Angular web app to load the profile after Supabase sign‑in.
-- In production you may tighten the check to ensure the role matches expectations.

CREATE POLICY "auth_select_own_profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Optionally allow authenticated users to update their own profile (not required for login).
-- CREATE POLICY "auth_update_own_profile"
--   ON profiles
--   FOR UPDATE
--   TO authenticated
--   USING (user_id = auth.uid())
--   WITH CHECK (user_id = auth.uid());
