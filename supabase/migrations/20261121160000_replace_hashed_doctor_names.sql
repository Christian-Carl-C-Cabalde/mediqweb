-- File: supabase/migrations/20261121150000_replace_hashed_doctor_names.sql
-- Purpose: Replace hashed doctor full_name values with readable names.
--          Doctors linked to a users row get "Dr. <username>".
--          Orphaned doctors get "Dr. Doctor <first-8-chars-of-id>".
--          Idempotent: only updates rows where full_name matches the hashed
--          pattern "Dr. <32 hex chars>" or is NULL or empty.
--          Safe to re-run: already-fixed names don't match the pattern.

BEGIN;

-- Doctors linked to users: replace hashed name with Dr. <username>
UPDATE doctors d
SET full_name = 'Dr. ' || u.username,
    updated_at = NOW()
FROM users u
WHERE d.user_id = u.id
  AND (
    d.full_name IS NULL
    OR d.full_name = ''
    OR d.full_name ~ '^Dr\. [0-9a-f]{32}$'
  );

-- Orphaned doctors (no linked user): derive name from doctor id
UPDATE doctors
SET full_name = 'Dr. Doctor ' || substring(id from 1 for 8),
    updated_at = NOW()
WHERE user_id IS NULL
  AND (
    full_name IS NULL
    OR full_name = ''
    OR full_name ~ '^Dr\. [0-9a-f]{32}$'
  );

COMMIT;
