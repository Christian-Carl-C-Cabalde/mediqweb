-- Supabase migration: seed 190 users (30 doctors, 20 secretaries, 150 patients).
-- Mirrors server/src/main/resources/db/seed/seed_data.sql but adapted for Supabase
-- (pgcrypto for gen_random_uuid, generate_series for bulk inserts).
--
-- Runs AFTER supabase/migrations/V2__seed_demo_data.sql so the 7 demo accounts
-- (demo_patient, dr.smith, dr.chen, dr.garcia, sec.jones, admin, demo_patient2)
-- and the 6 specializations already exist. This migration adds 190 additional
-- users and does NOT touch the demo accounts.
--
-- Intended for fresh/empty databases. Guarded with WHERE NOT EXISTS so it is
-- safe to re-apply on an empty schema, but do not run against a populated
-- Supabase project (it would duplicate rows).
--
-- Demo accounts (password: demo12345, from V2__seed_demo_data.sql):
--   demo_patient / demo_patient2   (patients)
--   dr.smith, dr.chen, dr.gancia   (doctors)
--   sec.jones                      (secretary)
--   admin                          (admin)

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------
-- 0. Reuse existing 6 specializations (from V2__seed_demo_data.sql)
-- spec-1 Cardiology, spec-2 Dermatology, spec-3 Pediatrics,
-- spec-4 Orthopedics, spec-5 Neurology, spec-6 Psychiatry
-- -------------------------------------------------------

-- -------------------------------------------------------
-- 1. 30 doctors (users + doctors rows) — chained in one CTE
--    so doctors only reference users that were actually inserted.
-- -------------------------------------------------------
WITH docs AS (
  SELECT generate_series(1, 30) AS seq,
         gen_random_uuid()::text AS user_id,
         gen_random_uuid()::text AS doctor_id,
         (SELECT id FROM specializations ORDER BY random() LIMIT 1) AS spec_id
),
ins_users AS (
  INSERT INTO users (id, username, full_name, email, mobile_number, date_of_birth, role, status, doctor_id, created_at, updated_at)
  SELECT user_id,
         'doc' || seq,
         'Dr. ' || md5(random()::text) AS full_name,
         'doc' || seq || '@mediq.local',
         '555-01' || lpad(seq::text, 2, '0'),
         '1970-01-01',
         'DOCTOR',
         'ACTIVE',
         doctor_id,
         now(),
         now()
  FROM docs
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'doc' || seq)
  RETURNING id AS user_id, doctor_id
)
INSERT INTO doctors (id, user_id, full_name, specialty, specialization_id, license_number, years_of_experience, fee_centavos, bio, building, floor, room, languages, status, created_at, updated_at)
SELECT iu.doctor_id,
       iu.user_id,
       'Dr. ' || md5(random()::text),
       s.name,
       d.spec_id,
       'LIC' || lpad(d.seq::text, 4, '0'),
       (floor(random() * 30) + 1)::int,
       (floor(random() * 20000) + 5000)::bigint,
       'Experienced professional.',
       'Main Building',
       (floor(random() * 5) + 1)::text,
       'Room ' || lpad(d.seq::text, 2, '0'),
       'English,Spanish',
       'ACTIVE',
       now(),
       now()
FROM ins_users iu
JOIN docs d ON d.doctor_id = iu.doctor_id
JOIN specializations s ON s.id = d.spec_id;

-- -------------------------------------------------------
-- 2. 20 secretaries (users rows, each assigned to a random doctor)
-- -------------------------------------------------------
WITH secs AS (
  SELECT generate_series(1, 20) AS seq,
         gen_random_uuid()::text AS user_id,
         (SELECT id FROM doctors ORDER BY random() LIMIT 1) AS assigned_doc_id
)
INSERT INTO users (id, username, full_name, email, mobile_number, date_of_birth, role, status, assigned_doctor_id, created_at, updated_at)
SELECT user_id,
       'sec' || seq,
       'Sec ' || md5(random()::text),
       'sec' || seq || '@mediq.local',
       '555-02' || lpad(seq::text, 2, '0'),
       '1985-01-01',
       'SECRETARY',
       'ACTIVE',
       assigned_doc_id,
       now(),
       now()
FROM secs
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'sec' || seq);

-- -------------------------------------------------------
-- 3. 150 patients (users rows)
-- -------------------------------------------------------
WITH pats AS (
  SELECT generate_series(1, 150) AS seq,
         gen_random_uuid()::text AS user_id
)
INSERT INTO users (id, username, full_name, email, mobile_number, date_of_birth, role, status, created_at, updated_at)
SELECT user_id,
       'pat' || seq,
       'Patient ' || md5(random()::text),
       'pat' || seq || '@mediq.local',
       '555-03' || lpad(seq::text, 2, '0'),
       (date '1990-01-01' + (seq % 30) * interval '1 year')::date,
       'PATIENT',
       'ACTIVE',
       now(),
       now()
FROM pats
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'pat' || seq);

-- -------------------------------------------------------
-- 4. 200 appointments with varied status
-- -------------------------------------------------------
WITH appts AS (
  SELECT generate_series(1, 200) AS seq,
         (SELECT id FROM users WHERE role = 'PATIENT' ORDER BY random() LIMIT 1) AS patient_id,
         (SELECT id FROM users WHERE role = 'DOCTOR' ORDER BY random() LIMIT 1) AS doctor_id,
         (now() - (floor(random() * 30)::int) * interval '1 day') + (floor(random() * 8)::int * interval '1 hour') AS start_time,
         (floor(random() * 3) + 1) * 15 AS duration,
         CASE
           WHEN random() < 0.1 THEN 'CANCELLED'
           WHEN random() < 0.15 THEN 'NO_SHOW'
           WHEN random() < 0.5 THEN 'BOOKED'
           ELSE 'COMPLETED'
         END AS status,
         'General consultation' AS reason
)
INSERT INTO appointments (id, patient_id, doctor_id, starts_at, duration_minutes, status, reason, created_at, updated_at, completed_at, outcome)
SELECT gen_random_uuid()::text,
       patient_id,
       doctor_id,
       start_time,
       duration,
       status,
       reason,
       now(),
       now(),
       CASE WHEN status = 'COMPLETED' THEN start_time + (duration || ' minutes')::interval ELSE NULL END,
       CASE WHEN status = 'COMPLETED' THEN 'SUCCESS' ELSE NULL END
FROM appts;

-- -------------------------------------------------------
-- 5. Update specialization doctor_count
-- -------------------------------------------------------
UPDATE specializations s
SET doctor_count = sub.cnt
FROM (
  SELECT specialization_id AS spec_id, count(*) AS cnt
  FROM doctors
  GROUP BY specialization_id
) sub
WHERE s.id = sub.spec_id;

-- Seed complete: 190 users + 200 appointments
