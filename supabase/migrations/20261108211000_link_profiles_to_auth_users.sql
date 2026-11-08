-- Supabase migration: link profiles to Supabase Auth users (phase 2a).
--
-- Adds a foreign key from profiles.user_id to auth.users.id so each profile
-- is owned by a Supabase Auth account. Backfills profiles for the 5 demo
-- accounts that exist in both the Ktor `users` table and auth.users (matched
-- by email). Adds a trigger that auto-creates a profile when a new user signs
-- up via Supabase Auth.
--
-- RLS remains enable-all/deny (no policies) until the CRUD-with-policies
-- phase. Ktor connects as table owner and bypasses RLS, so this change is
-- transparent to the existing Angular/Ktor surface.

-- 1. Foreign key: profiles.user_id -> auth.users.id
ALTER TABLE profiles
  ADD CONSTRAINT profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Backfill profiles for demo accounts matched by email between users and auth.users
INSERT INTO profiles (user_id, username, full_name, email, role, status)
SELECT au.id, u.username, u.full_name, u.email, u.role, u.status
FROM users u
JOIN auth.users au ON au.email = u.email
WHERE u.email IN (
  'dr.smith@mediq.app', 'dr.chen@mediq.app', 'sec.jones@mediq.app',
  'dr.garcia@mediq.app', 'admin@mediq.app'
)
ON CONFLICT (user_id) DO NOTHING;

-- 3. Trigger function: auto-create profile on Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO profiles (user_id, username, full_name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'PATIENT'),
    'ACTIVE'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 4. Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
