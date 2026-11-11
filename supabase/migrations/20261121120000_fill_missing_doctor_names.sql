-- File: supabase/migrations/20261121120000_fill_missing_doctor_names.sql
-- Purpose: Generate display names for doctors whose full_name is NULL or empty
--          so the Android app shows a name instead of crashing or showing blank.
--          Safe to re-run: only updates rows where full_name IS NULL OR
--          full_name = ''.

BEGIN;

UPDATE doctors d
SET full_name = 'Dr. ' || u.username,
    updated_at = NOW()
FROM users u
WHERE d.user_id = u.id
  AND (d.full_name IS NULL OR d.full_name = '');

-- Doctors without a linked user: derive a name from their own id.
UPDATE doctors
SET full_name = 'Dr. ' || substring(id from 1 for 8),
    updated_at = NOW()
WHERE full_name IS NULL OR full_name = '';

COMMIT;
