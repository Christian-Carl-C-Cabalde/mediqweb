-- File: supabase/migrations/20261121210000_seed_message_threads.sql
-- Purpose: Seed message_threads for doctor-patient pairs so messaging works
--          out of the box. Runs as table owner, bypassing RLS.
-- ========================================================================

-- Assign patients to doctors (update users table)
UPDATE public.users
SET assigned_doctor_id = 'b5a53f20-9010-4728-8601-0ec8e4c4257b'  -- Dr. Smith's user_id
WHERE id IN (
    SELECT id FROM users WHERE role = 'PATIENT' AND assigned_doctor_id IS NULL LIMIT 5
);

UPDATE public.users
SET assigned_doctor_id = 'c4ac0ade-222b-46ad-8730-30c063c81d37'  -- Dr. Chen's user_id
WHERE id IN (
    SELECT id FROM users WHERE role = 'PATIENT' AND assigned_doctor_id IS NULL LIMIT 5
);

UPDATE public.users
SET assigned_doctor_id = '417575a0-4984-40ad-9004-1ea19b0e8b66'  -- Dr. Garcia's user_id
WHERE id IN (
    SELECT id FROM users WHERE role = 'PATIENT' AND assigned_doctor_id IS NULL LIMIT 5
);

-- Also update profiles table assigned_doctor_id
UPDATE public.profiles
SET assigned_doctor_id = 'b5a53f20-9010-4728-8601-0ec8e4c4257b'
WHERE id IN (
    SELECT id FROM public.profiles WHERE role = 'PATIENT' AND assigned_doctor_id IS NULL LIMIT 5
);

UPDATE public.profiles
SET assigned_doctor_id = 'c4ac0ade-222b-46ad-8730-30c063c81d37'
WHERE id IN (
    SELECT id FROM public.profiles WHERE role = 'PATIENT' AND assigned_doctor_id IS NULL LIMIT 5
);

UPDATE public.profiles
SET assigned_doctor_id = '417575a0-4984-40ad-9004-1ea19b0e8b66'
WHERE id IN (
    SELECT id FROM public.profiles WHERE role = 'PATIENT' AND assigned_doctor_id IS NULL LIMIT 5
);

-- Insert message_threads for patient-doctor pairs
-- Note: message_threads.doctor_id references users.id, NOT doctors.id
-- users.assigned_doctor_id stores users.id of the doctor, which matches doctors.user_id
INSERT INTO message_threads (id, patient_id, doctor_id, subject, last_message_at, unread_count, awaiting_action)
SELECT
    gen_random_uuid()::VARCHAR,
    u.id,
    u.assigned_doctor_id,
    'Initial consultation',
    NOW(),
    0,
    FALSE
FROM users u
WHERE u.role = 'PATIENT'
  AND u.assigned_doctor_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM doctors d WHERE d.user_id = u.assigned_doctor_id)
  AND NOT EXISTS (
      SELECT 1 FROM message_threads mt
      WHERE mt.patient_id = u.id AND mt.doctor_id = u.assigned_doctor_id
    );

-- Verify
SELECT 'message_threads created:' as check_type, count(*) FROM message_threads;
