-- File: supabase/migrations/20261121000000_create_demo_profiles.sql
-- Purpose: Create profile rows for the 6 demo Supabase Auth users so that
--          mediq_current_role() resolves and login redirects to the correct dashboard.
--          Idempotent: can be re-run safely.

BEGIN;

INSERT INTO profiles (user_id, username, full_name, email, role, status)
SELECT au.id,
       CASE au.email
         WHEN 'dr.smith@mediq.app' THEN 'dr.smith'
         WHEN 'dr.chen@mediq.app'  THEN 'dr.chen'
         WHEN 'dr.garcia@mediq.app' THEN 'dr.garcia'
         WHEN 'sec.jones@mediq.app' THEN 'sec.jones'
         WHEN 'admin@mediq.app'    THEN 'admin'
         WHEN 'demo@mediq.app'     THEN 'demo'
       END AS username,
       CASE au.email
         WHEN 'dr.smith@mediq.app' THEN 'Dr. Smith'
         WHEN 'dr.chen@mediq.app'  THEN 'Dr. Chen'
         WHEN 'dr.garcia@mediq.app' THEN 'Dr. Garcia'
         WHEN 'sec.jones@mediq.app' THEN 'Sec. Jones'
         WHEN 'admin@mediq.app'    THEN 'Admin'
         WHEN 'demo@mediq.app'     THEN 'Demo Patient'
       END AS full_name,
       au.email,
       CASE au.email
         WHEN 'dr.smith@mediq.app' THEN 'DOCTOR'
         WHEN 'dr.chen@mediq.app'  THEN 'DOCTOR'
         WHEN 'dr.garcia@mediq.app' THEN 'DOCTOR'
         WHEN 'sec.jones@mediq.app' THEN 'SECRETARY'
         WHEN 'admin@mediq.app'    THEN 'ADMIN'
         WHEN 'demo@mediq.app'     THEN 'PATIENT'
       END AS role,
       'ACTIVE' AS status
FROM auth.users au
WHERE au.email IN (
  'dr.smith@mediq.app', 'dr.chen@mediq.app', 'dr.garcia@mediq.app',
  'sec.jones@mediq.app', 'admin@mediq.app', 'demo@mediq.app'
)
ON CONFLICT (user_id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  status = EXCLUDED.status;

COMMIT;
