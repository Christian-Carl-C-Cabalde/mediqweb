-- Supabase migration: seed additional secretaries and patients + booking history.
--
-- Adds 30 secretaries (sec101-sec130) and 20 patients (pat151-pat170), all with
-- password_hashes for demo12345, plus ~150 appointments with varied statuses so
-- secretaries + patients total >= 200. Secretaries keep role='SECRETARY' and can
-- still appear as patient_id in appointments (no duplicate PATIENT row).
--
-- Runs AFTER supabase/migrations/20261030000001_seed_190_users.sql.
-- Intended for fresh/empty databases. Username-level WHERE NOT EXISTS guards make
-- user inserts idempotent on partial re-runs. Do not run against a populated
-- Supabase project.
--
-- No new doctors or specializations are created (existing ones are reused).

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------
-- 1. 30 secretaries (sec101-sec130) + password_hashes
-- -------------------------------------------------------
WITH ins_secs AS (
  INSERT INTO users (id, username, full_name, email, mobile_number, date_of_birth, role, status, assigned_doctor_id, created_at, updated_at)
  SELECT
    gen_random_uuid()::text,
    'sec' || g.seq,
    'Secretary User ' || g.seq,
    'sec' || g.seq || '@mediq.local',
    '+63917' || lpad(g.seq::text, 7, '0'),
    to_char(date '1970-01-01' + (g.seq % 40) * interval '1 year', 'YYYY-MM-DD'),
    'SECRETARY',
    'ACTIVE',
    (SELECT id FROM doctors ORDER BY random() LIMIT 1),
    now(),
    now()
  FROM generate_series(101, 130) AS g(seq)
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'sec' || g.seq)
  RETURNING id AS user_id
)
INSERT INTO password_hashes (user_id, hash)
SELECT user_id, '$2b$12$gUrxhjBF6l8HH2wPyrnrQ.mc5Jbcgo3dkwPXqdittSNvxy1b5jceS'
FROM ins_secs;

-- -------------------------------------------------------
-- 2. 20 patients (pat151-pat170) + password_hashes
-- -------------------------------------------------------
WITH ins_pats AS (
  INSERT INTO users (id, username, full_name, email, mobile_number, date_of_birth, role, status, created_at, updated_at)
  SELECT
    gen_random_uuid()::text,
    'pat' || g.seq,
    'Patient User ' || g.seq,
    'pat' || g.seq || '@mediq.local',
    '+63918' || lpad(g.seq::text, 7, '0'),
    to_char(date '1970-01-01' + (g.seq % 40) * interval '1 year', 'YYYY-MM-DD'),
    'PATIENT',
    'ACTIVE',
    now(),
    now()
  FROM generate_series(151, 170) AS g(seq)
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'pat' || g.seq)
  RETURNING id AS user_id
)
INSERT INTO password_hashes (user_id, hash)
SELECT user_id, '$2b$12$gUrxhjBF6l8HH2wPyrnrQ.mc5Jbcgo3dkwPXqdittSNvxy1b5jceS'
FROM ins_pats;

-- -------------------------------------------------------
-- 3. ~150 appointments across patient-role users
--    patient_id from users WHERE role IN ('PATIENT','SECRETARY')
--    doctor_id from users WHERE role = 'DOCTOR'
-- -------------------------------------------------------
WITH appts AS (
  SELECT
    gen_random_uuid()::text AS id,
    (SELECT id FROM users WHERE role IN ('PATIENT','SECRETARY') ORDER BY random() LIMIT 1) AS patient_id,
    (SELECT id FROM users WHERE role = 'DOCTOR' ORDER BY random() LIMIT 1) AS doctor_id,
    CASE WHEN random() < 0.5
      THEN now() - (floor(random() * 60)::int) * interval '1 day' + (floor(random() * 12)::int) * interval '1 hour'
      ELSE now() + (floor(random() * 14)::int) * interval '1 day' + (floor(random() * 12)::int) * interval '1 hour'
    END AS starts_at,
    (floor(random() * 3) + 1) * 15 AS duration_minutes,
    CASE
      WHEN random() < 0.30 THEN 'COMPLETED'
      WHEN random() < 0.50 THEN 'BOOKED'
      WHEN random() < 0.65 THEN 'CONFIRMED'
      WHEN random() < 0.85 THEN 'CANCELLED'
      ELSE 'NO_SHOW'
    END AS status,
    'Consultation: ' || (SELECT name FROM specializations ORDER BY random() LIMIT 1) AS reason
  FROM generate_series(1, 150) AS g(seq)
)
INSERT INTO appointments (id, patient_id, doctor_id, starts_at, duration_minutes, status, reason, created_at, updated_at, completed_at, outcome)
SELECT
  id,
  patient_id,
  doctor_id,
  starts_at,
  duration_minutes,
  status,
  reason,
  now(),
  now(),
  CASE WHEN status IN ('COMPLETED','NO_SHOW') THEN starts_at + (duration_minutes || ' minutes')::interval ELSE NULL END,
  CASE WHEN status = 'COMPLETED' THEN 'SUCCESS' WHEN status = 'NO_SHOW' THEN 'NO_SHOW' ELSE NULL END
FROM appts;

-- Seed complete: +50 users + 150 appointments
