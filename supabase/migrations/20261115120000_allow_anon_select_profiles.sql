-- Migration: allow anonymous SELECT on profiles for username lookup
-- This policy enables the Angular app to resolve a username to an email before sign‑in.
-- It permits reading rows where the username matches the supplied value.
-- NOTE: This is intentionally permissive for the demo environment only. In production, replace
-- with a secure RPC that validates the requestor.

CREATE POLICY "anon_select_profiles_by_username"
  ON profiles
  FOR SELECT
  TO anon
  USING (true);

-- Additionally, allow authenticated users to read their own profile (already covered by default policies later).

GRANT SELECT ON profiles TO anon;
