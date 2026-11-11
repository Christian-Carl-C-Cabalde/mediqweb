-- File: supabase/migrations/20261121140000_book_appointment_doctor_secretary.sql
-- Purpose: Allow DOCTOR and SECRETARY roles to book appointments via
--          book_appointment, in addition to PATIENT.
--          When PATIENT books, the patient is resolved from auth.uid() (existing
--          behaviour). When DOCTOR or SECRETARY books, p_patient_id identifies
--          the patient the appointment is for.
--          Idempotent: uses CREATE OR REPLACE FUNCTION.

CREATE OR REPLACE FUNCTION public.book_appointment(
    p_patient_id VARCHAR,
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
    v_patient_id VARCHAR;
    v_conflict INTEGER;
    v_avail INTEGER;
    v_new_id UUID := gen_random_uuid();
    v_role VARCHAR;
BEGIN
    v_role := mediq_current_role();

    -- Only patients, doctors, and secretaries can book
    IF v_role NOT IN ('PATIENT', 'DOCTOR', 'SECRETARY') THEN
        RAISE EXCEPTION 'Only patients, doctors, and secretaries can book appointments';
    END IF;

    -- Resolve the patient id
    IF v_role = 'PATIENT' THEN
        -- Patients book for themselves
        SELECT id INTO v_patient_id
        FROM users
        WHERE auth_user_id = auth.uid();
        IF v_patient_id IS NULL THEN
            RAISE EXCEPTION 'Authenticated user has no patient record';
        END IF;
    ELSE
        -- Doctors and secretaries book on behalf of a specified patient
        v_patient_id := p_patient_id;
        IF v_patient_id IS NULL THEN
            RAISE EXCEPTION 'Patient id is required';
        END IF;
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
