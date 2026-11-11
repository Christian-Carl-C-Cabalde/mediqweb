-- File: supabase/migrations/20261121190000_fix_send_message_and_seed_threads.sql
-- Purpose: Fix the broken send_message RPC and seed message_threads so
--          messaging works end-to-end between patients and doctors.
--          Idempotent: DROP IF EXISTS + CREATE.

-- ========================================================================
-- 1. Fix send_message RPC
--    The RPC references auth_user_id and author_id columns that don't exist
--    on the users table. The users table uses id as PK. Fix to use id.
-- ========================================================================

DROP FUNCTION IF EXISTS public.send_message(VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION public.send_message(
    p_conversation_id VARCHAR,
    p_body TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role VARCHAR;
    v_author_id VARCHAR;
    v_thread_patient VARCHAR;
    v_thread_doctor VARCHAR;
    v_new_id UUID := gen_random_uuid();
BEGIN
    v_role := mediq_current_role();

    -- Get the authenticated user's id from users table (id matches auth.uid())
    SELECT id INTO v_author_id FROM users WHERE id = auth.uid();
    IF v_author_id IS NULL THEN
        RAISE EXCEPTION 'Authenticated user has no record';
    END IF;

    SELECT patient_id, doctor_id INTO v_thread_patient, v_thread_doctor
    FROM message_threads WHERE id = p_conversation_id;

    IF v_thread_patient IS NULL THEN
        RAISE EXCEPTION 'Conversation not found';
    END IF;

    -- Only participants can send
    IF v_author_id <> v_thread_patient AND v_author_id <> v_thread_doctor THEN
        RAISE EXCEPTION 'Not a participant in this conversation';
    END IF;

    INSERT INTO messages (id, conversation_id, author_id, author_role, body, sent_at)
    VALUES (v_new_id, p_conversation_id, v_author_id, v_role, p_body, NOW());

    UPDATE message_threads
    SET last_message_at = NOW(),
        unread_count = unread_count + 1,
        awaiting_action = TRUE
    WHERE id = p_conversation_id;

    RETURN v_new_id;
END;
$$;

-- ========================================================================
-- 2. Create message_threads for doctor-patient pairs
--    Assign a few patients to doctors so messaging has something to show.
-- ========================================================================

-- Assign some patients to doctors (using subquery to avoid LIMIT on UPDATE)
UPDATE public.users
SET assigned_doctor_id = 'b5a53f20-9010-4728-8601-0ec8e4c4257b'  -- Dr. Smith
WHERE id IN (
    SELECT id FROM users WHERE role = 'PATIENT' AND assigned_doctor_id IS NULL LIMIT 5
);

UPDATE public.users
SET assigned_doctor_id = 'c4ac0ade-222b-46ad-8730-30c063c81d37'  -- Dr. Chen
WHERE id IN (
    SELECT id FROM users WHERE role = 'PATIENT' AND assigned_doctor_id IS NULL LIMIT 5
);

UPDATE public.users
SET assigned_doctor_id = '417575a0-4984-40ad-9004-1ea19b0e8b66'  -- Dr. Garcia
WHERE id IN (
    SELECT id FROM users WHERE role = 'PATIENT' AND assigned_doctor_id IS NULL LIMIT 5
);

-- Also update profiles table if it has assigned_doctor_id column
-- Use subquery instead of LIMIT on UPDATE for PostgreSQL compatibility
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'assigned_doctor_id') THEN
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
    END IF;
END $$;

-- Insert message_threads for doctor-patient pairs that now exist
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
  AND EXISTS (SELECT 1 FROM doctors d WHERE d.id = u.assigned_doctor_id)
  AND NOT EXISTS (
      SELECT 1 FROM message_threads mt
      WHERE mt.patient_id = u.id AND mt.doctor_id = u.assigned_doctor_id
    );

-- Verify
SELECT 'message_threads created:' as check_type, count(*) FROM message_threads
UNION ALL
SELECT 'users with assigned doctor:', count(*) FROM users WHERE role = 'PATIENT' AND assigned_doctor_id IS NOT NULL;
