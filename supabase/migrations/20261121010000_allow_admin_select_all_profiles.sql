-- File: supabase/migrations/20261121010000_allow_admin_select_all_profiles.sql
-- Purpose: Allow authenticated users with ADMIN role to read all profiles,
--          so the admin staff directory can list doctors, secretaries, and patients.
--          Idempotent: can be re-run safely.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'auth_select_all_profiles_for_admin'
  ) THEN
    CREATE POLICY auth_select_all_profiles_for_admin
      ON profiles
      FOR SELECT
      TO authenticated
      USING (mediq_current_role() = 'ADMIN');
  END IF;
END $$;
