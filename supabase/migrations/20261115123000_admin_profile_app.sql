-- Migration: ensure admin demo account (admin@mediq.app) has a linked profile.
-- This fixes the login flow for the admin user whose email differs from the \"local\" demo seed data.
-- The admin email used by the Angular web app is "admin@mediq.app" (see AGENTS.md).
-- We insert or update a profile row linked to the corresponding auth.users entry.

INSERT INTO profiles (user_id, username, full_name, email, role, status)
SELECT au.id,
       'admin' AS username,
       'Admin'  AS full_name,
       'admin@mediq.app' AS email,
       'ADMIN'  AS role,
       'ACTIVE' AS status
FROM auth.users au
WHERE au.email = 'admin@mediq.app'
ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      username = EXCLUDED.username,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      status = EXCLUDED.status;
