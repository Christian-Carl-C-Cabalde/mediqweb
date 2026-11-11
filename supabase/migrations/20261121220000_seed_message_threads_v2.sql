-- File: supabase/migrations/20261121220000_seed_message_threads_v2.sql
-- Purpose: Seed message_threads for doctor-patient pairs.
--          Corrects previous migration which used doctors.id instead of doctors.user_id.
--          message_threads.doctor_id references users.id, which equals doctors.user_id.
-- ========================================================================

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
