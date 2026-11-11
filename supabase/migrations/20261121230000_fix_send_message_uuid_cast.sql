-- File: supabase/migrations/20261121220000_fix_send_message_rpc.sql
-- Purpose: Fix send_message RPC - gen_random_uuid() returns UUID but messages.id
--          is VARCHAR. Cast to VARCHAR explicitly.
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

    SELECT id INTO v_author_id FROM users WHERE id = auth.uid()::VARCHAR;
    IF v_author_id IS NULL THEN
        RAISE EXCEPTION 'Authenticated user has no record';
    END IF;

    SELECT patient_id, doctor_id INTO v_thread_patient, v_thread_doctor
    FROM message_threads WHERE id = p_conversation_id;

    IF v_thread_patient IS NULL THEN
        RAISE EXCEPTION 'Conversation not found';
    END IF;

    IF v_author_id <> v_thread_patient AND v_author_id <> v_thread_doctor THEN
        RAISE EXCEPTION 'Not a participant in this conversation';
    END IF;

    INSERT INTO messages (id, conversation_id, author_id, author_role, body, sent_at)
    VALUES (v_new_id::VARCHAR, p_conversation_id, v_author_id, v_role, p_body, NOW());

    UPDATE message_threads
    SET last_message_at = NOW(),
        unread_count = unread_count + 1,
        awaiting_action = TRUE
    WHERE id = p_conversation_id;

    RETURN v_new_id;
END;
$$;
