-- Supabase migration: allow pre-auth username lookup on profiles (phase 2b).
--
-- Staff sign-in accepts an email or a username. For a username we must resolve
-- it to the account's email before calling Supabase Auth's password grant, but
-- that lookup reads `profiles` while no session exists yet, i.e. as `anon`.
-- Every existing profiles policy is `TO authenticated`, so `anon` is denied and
-- username login always fails before reaching Supabase Auth.
--
-- `authenticated_read_all_profiles` already lets any logged-in user read all
-- profiles, so extending the same read to `anon` adds no new exposure in this
-- dev project (fake/seed data only). It is required purely so the pre-auth
-- email resolution for username sign-in can complete.
CREATE POLICY "anon_read_profiles_for_signin" ON profiles
  FOR SELECT TO anon
  USING (true);
