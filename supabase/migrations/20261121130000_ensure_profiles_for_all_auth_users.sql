-- File: supabase/migrations/20261121130000_ensure_profiles_for_all_auth_users.sql
-- Purpose: Ensure every Supabase Auth user has a profile row in public.profiles.
--          Sign-in falls back to a PATIENT profile when no profile exists, which
--          gives the wrong role and breaks doctor/secretary/admin flows.
--          Idempotent: only inserts rows for auth users that lack a profile.
--          Names are derived from email; role defaults to PATIENT.

BEGIN;

INSERT INTO public.profiles (user_id, username, full_name, email, role, status)
SELECT
    au.id,
    split_part(au.email, '@', 1),
    CASE
        WHEN au.email ILIKE '%@mediq.app' THEN initcap(split_part(au.email, '@', 1))
        ELSE split_part(au.email, '@', 1)
    END,
    au.email,
    'PATIENT',
    'ACTIVE'
FROM auth.users au
LEFT JOIN public.profiles p ON p.user_id = au.id
WHERE p.user_id IS NULL
  AND au.email IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
