-- File: supabase/migrations/20261121100000_fix_missing_profiles.sql
-- Purpose: Insert missing profiles row for igotnobroads@gmail.com which has a
--          users table row but no profiles row, blocking login. Idempotent.
--          Uses auth.users.id (UUID) for profiles.user_id FK compatibility.

INSERT INTO profiles (user_id, username, full_name, email, role, status, created_at, updated_at)
SELECT au.id, 'boscine', 'boscine', 'igotnobroads@gmail.com', 'SECRETARY', 'ACTIVE', NOW(), NOW()
FROM auth.users au
WHERE au.email = 'igotnobroads@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
