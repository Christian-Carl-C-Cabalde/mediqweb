-- Bulk add 5 demo accounts to profiles table
-- Assumes auth.users already have these IDs (created during migration)
-- Run via: supabase db query --linked -f supabase/20261110_bulk_demo_profiles.sql

-- ============================================
-- 1. Insert profiles linked to auth.users
-- ============================================

INSERT INTO profiles (user_id, username, full_name, email, role, status)
SELECT 
  au.id,
  CASE 
    WHEN au.email = 'dr.smith@mediq.app' THEN 'dr.smith'
    WHEN au.email = 'dr.chen@mediq.app' THEN 'dr.chen'
    WHEN au.email = 'sec.jones@mediq.app' THEN 'sec.jones'
    WHEN au.email = 'dr.garcia@mediq.app' THEN 'dr.garcia'
    WHEN au.email = 'admin@mediq.app' THEN 'admin'
    ELSE 'unknown'
  END,
  CASE
    WHEN au.email = 'dr.smith@mediq.app' THEN 'Dr. Sarah Smith'
    WHEN au.email = 'dr.chen@mediq.app' THEN 'Dr. Michael Chen'
    WHEN au.email = 'sec.jones@mediq.app' THEN 'Secretary Jane Jones'
    WHEN au.email = 'dr.garcia@mediq.app' THEN 'Dr. Maria Garcia'
    WHEN au.email = 'admin@mediq.app' THEN 'Admin User'
    ELSE 'Unknown'
  END,
  au.email,
  CASE
    WHEN au.email IN ('dr.smith@mediq.app', 'dr.chen@mediq.app', 'dr.garcia@mediq.app') THEN 'DOCTOR'
    WHEN au.email = 'sec.jones@mediq.app' THEN 'SECRETARY'
    WHEN au.email = 'admin@mediq.app' THEN 'ADMIN'
    ELSE 'PATIENT'
  END,
  'ACTIVE'
FROM auth.users au
WHERE au.email IN ('dr.smith@mediq.app', 'dr.chen@mediq.app', 'sec.jones@mediq.app', 'dr.garcia@mediq.app', 'admin@mediq.app')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 2. Verify the profiles were created
-- ============================================
-- Uncomment to verify:
-- SELECT id, email, role, status FROM profiles WHERE email LIKE '%@mediq%';