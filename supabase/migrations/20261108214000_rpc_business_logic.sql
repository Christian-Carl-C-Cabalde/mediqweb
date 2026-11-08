-- Supabase migration: RPC business logic functions (phase 4).
--
-- SECURITY DEFINER functions that bypass RLS but enforce authorization
-- via mediq_current_role() and auth.uid() checks inside the body.
-- All business logic runs in a single transaction.
--
-- Functions:
--   book_appointment(doctor_id, starts_at, duration_minutes, reason) -> uuid
--   confirm_appointment(appointment_id) -> void
--   cancel_appointment(appointment_id) -> void
--   record_outcome(appointment_id, outcome) -> void
--   send_message(conversation_id, body) -> uuid
--   doctor_availability(doctor_id, date) -> json

CREATE OR REPLACE FUNCTION public.book_appointment(
    p_doctor_id VARCHAR,
    p_starts_at TIMESTAMP,
    p_duration_minutes INTEGER,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_patient_user_id UUID;
    v_patient_id VARCHAR;
    v_conflict INTEGER;
    v_avail INTEGER;
    v_new_id UUID := gen_random_uuid();
BEGIN
    -- Only patients can book
    IF mediq_current_role() <> 'PATIENT' THEN
        RAISE EXCEPTION 'Only patients can book appointments';
    END IF;

    -- Resolve patient id from auth
    SELECT id INTO v_patient_id FROM users WHERE auth_user_id = auth.uid();
    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'Authenticated user has no patient record';
    END IF;

    -- Conflict check: doctor already has a non-cancelled appointment overlapping
    SELECT COUNT(*) INTO v_conflict
    FROM appointments
    WHERE doctor_id = p_doctor_id
      AND status <> 'CANCELLED'
      AND starts_at < p_starts_at + (p_duration_minutes || ' minutes')::interval
      AND starts_at + (p_duration_minutes || ' minutes')::interval > p_starts_at;

    IF v_conflict > 0 THEN
        RAISE EXCEPTION 'Doctor already has an appointment at that time';
    END IF;

    -- Availability check: doctor must have clinic hours / availability for that slot
    SELECT COUNT(*) INTO v_avail
    FROM availabilities
    WHERE doctor_id = p_doctor_id
      AND date = p_starts_at::date;

    IF v_avail = 0 THEN
        RAISE EXCEPTION 'Doctor is not available on that date';
    END IF;

    INSERT INTO appointments (id, patient_id, doctor_id, starts_at, duration_minutes, status, reason, created_at, updated_at)
    VALUES (v_new_id, v_patient_id, p_doctor_id, p_starts_at, p_duration_minutes, 'BOOKED', p_reason, NOW(), NOW());

    RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_appointment(
    p_appointment_id VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role VARCHAR;
    v_patient_id VARCHAR;
    v_doctor_id VARCHAR;
BEGIN
    v_role := mediq_current_role();

    SELECT patient_id, doctor_id INTO v_patient_id, v_doctor_id
    FROM appointments WHERE id = p_appointment_id;

    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;

    -- Patient/doctor own it, or secretary/admin
    IF v_role = 'PATIENT' THEN
        IF v_patient_id <> (SELECT id FROM users WHERE auth_user_id = auth.uid()) THEN
            RAISE EXCEPTION 'Not your appointment';
        END IF;
    ELSIF v_role = 'DOCTOR' THEN
        IF v_doctor_id <> (SELECT id FROM users WHERE auth_user_id = auth.uid()) THEN
            RAISE EXCEPTION 'Not your appointment';
        END IF;
    ELSIF v_role IN ('SECRETARY', 'ADMIN') THEN
        -- allowed
    ELSE
        RAISE EXCEPTION 'Insufficient role';
    END IF;

    UPDATE appointments SET status = 'CONFIRMED', updated_at = NOW() WHERE id = p_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_appointment_id VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role VARCHAR;
    v_patient_id VARCHAR;
    v_doctor_id VARCHAR;
BEGIN
    v_role := mediq_current_role();

    SELECT patient_id, doctor_id INTO v_patient_id, v_doctor_id
    FROM appointments WHERE id = p_appointment_id;

    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;

    IF v_role = 'PATIENT' THEN
        IF v_patient_id <> (SELECT id FROM users WHERE auth_user_id = auth.uid()) THEN
            RAISE EXCEPTION 'Not your appointment';
        END IF;
    ELSIF v_role = 'DOCTOR' THEN
        IF v_doctor_id <> (SELECT id FROM users WHERE auth_user_id = auth.uid()) THEN
            RAISE EXCEPTION 'Not your appointment';
        END IF;
    ELSIF v_role IN ('SECRETARY', 'ADMIN') THEN
        -- allowed
    ELSE
        RAISE EXCEPTION 'Insufficient role';
    END IF;

    UPDATE appointments SET status = 'CANCELLED', updated_at = NOW() WHERE id = p_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_outcome(
    p_appointment_id VARCHAR,
    p_outcome VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role VARCHAR;
    v_doctor_id VARCHAR;
BEGIN
    v_role := mediq_current_role();

    IF v_role <> 'DOCTOR' THEN
        RAISE EXCEPTION 'Only doctors can record outcomes';
    END IF;

    SELECT doctor_id INTO v_doctor_id FROM appointments WHERE id = p_appointment_id;

    IF v_doctor_id IS NULL THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;

    IF v_doctor_id <> (SELECT id FROM users WHERE auth_user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not your appointment';
    END IF;

    UPDATE appointments
    SET outcome = p_outcome,
        status = 'COMPLETED',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_appointment_id;
END;
$$;

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

    SELECT author_id INTO v_author_id FROM users WHERE auth_user_id = auth.uid();
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

CREATE OR REPLACE FUNCTION public.doctor_availability(
    p_doctor_id VARCHAR,
    p_date DATE
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
SELECT json_build_object(
    'doctor_id', p_doctor_id,
    'date', p_date,
    'sessions', COALESCE((
        SELECT sessions FROM availabilities
        WHERE doctor_id = p_doctor_id AND date::date = p_date
    ), '[]')
);
$$;
