-- File: supabase/migrations/20261121020000_seed_demo_doctors_specializations.sql
-- Purpose: Insert demo specializations, users, and doctors into cloud so the
--          admin staff directory can show doctors with their specialties.
--          Idempotent: uses ON CONFLICT DO NOTHING so it can be re-run safely.

-- 1. Specializations (6 demo clinics)
DELETE FROM specializations WHERE id IN ('spec-001','spec-002','spec-003','spec-004','spec-005','spec-006');
INSERT INTO specializations (id, name, description, doctor_count) VALUES
  ('spec-001', 'Cardiology', 'Heart and cardiovascular care', 0),
  ('spec-002', 'Dermatology', 'Skin, hair and nail conditions', 0),
  ('spec-003', 'General Practice', 'Primary care and general medicine', 0),
  ('spec-004', 'Pediatrics', 'Child and adolescent health', 0),
  ('spec-005', 'Orthopedics', 'Bones, joints and muscles', 0),
  ('spec-006', 'Neurology', 'Brain and nervous system disorders', 0);

-- 2. Users (Ktor domain model) — same IDs as Supabase Auth users so profiles link up
-- Null out circular FKs (users.doctor_id -> doctors.id) before deleting
UPDATE users SET doctor_id = NULL, assigned_doctor_id = NULL
  WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo');
-- Delete all dependent rows referencing users.id
DELETE FROM password_hashes WHERE user_id IN (
  SELECT id FROM users WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo')
);
DELETE FROM appointments WHERE patient_id IN (
  SELECT id FROM users WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo')
) OR doctor_id IN (
  SELECT id FROM users WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo')
);
DELETE FROM messages WHERE conversation_id IN (
  SELECT id FROM message_threads WHERE patient_id IN (
    SELECT id FROM users WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo')
  ) OR doctor_id IN (
    SELECT id FROM users WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo')
  )
);
DELETE FROM message_threads WHERE patient_id IN (
  SELECT id FROM users WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo')
) OR doctor_id IN (
  SELECT id FROM users WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo')
);
DELETE FROM messages WHERE author_id IN (
  SELECT id FROM users WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo')
);
DELETE FROM notifications WHERE user_id IN (
  SELECT id FROM users WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo')
);
DELETE FROM refresh_tokens WHERE user_id IN (
  SELECT id FROM users WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo')
);
-- Delete doctors and their dependents
DELETE FROM clinic_hours WHERE doctor_id IN (
  SELECT id FROM doctors WHERE user_id IN (
    SELECT id FROM users WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo')
  )
);
DELETE FROM availabilities WHERE doctor_id IN (
  SELECT id FROM doctors WHERE user_id IN (
    SELECT id FROM users WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo')
  )
);
DELETE FROM doctors WHERE user_id IN (
  SELECT id FROM users WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo')
);
DELETE FROM users WHERE username IN ('dr.smith','dr.chen','dr.garcia','sec.jones','admin','demo');
INSERT INTO users (id, username, full_name, email, mobile_number, date_of_birth, role, status, doctor_id, assigned_doctor_id, created_at, updated_at) VALUES
  ('b5a53f20-9010-4728-8601-0ec8e4c4257b', 'dr.smith', 'Dr. Smith', 'dr.smith@mediq.app', '+1-555-0101', '1980-03-15', 'DOCTOR', 'ACTIVE', NULL, NULL, NOW(), NOW()),
  ('c4ac0ade-222b-46ad-8730-30c063c81d37', 'dr.chen', 'Dr. Chen', 'dr.chen@mediq.app', '+1-555-0102', '1982-07-22', 'DOCTOR', 'ACTIVE', NULL, NULL, NOW(), NOW()),
  ('417575a0-4984-40ad-9004-1ea19b0e8b66', 'dr.garcia', 'Dr. Garcia', 'dr.garcia@mediq.app', '+1-555-0103', '1979-11-08', 'DOCTOR', 'ACTIVE', NULL, NULL, NOW(), NOW()),
  ('ac37065e-a4ac-4cbb-92da-cf7ea98eba54', 'sec.jones', 'Sec. Jones', 'sec.jones@mediq.app', '+1-555-0201', '1985-05-10', 'SECRETARY', 'ACTIVE', NULL, NULL, NOW(), NOW()),
  ('b4be8326-de22-4fd8-9447-5bfcca01a2d2', 'admin', 'Admin', 'admin@mediq.app', '+1-555-0301', '1975-01-01', 'ADMIN', 'ACTIVE', NULL, NULL, NOW(), NOW()),
  ('6c5bf620-f5a5-4b45-a96c-dfd5d723bb7a', 'demo', 'Demo Patient', 'demo@mediq.app', '+1-555-0401', '1990-09-30', 'PATIENT', 'ACTIVE', NULL, NULL, NOW(), NOW());

-- 3. Doctors (links users to specializations)
DELETE FROM doctors WHERE id IN ('doc-001','doc-002','doc-003');
INSERT INTO doctors (id, user_id, full_name, specialty, specialization_id, license_number, years_of_experience, fee_centavos, bio, building, floor, room, languages, status, created_at, updated_at) VALUES
  ('doc-001', 'b5a53f20-9010-4728-8601-0ec8e4c4257b', 'Dr. Smith', 'Cardiologist', 'spec-001', 'LIC-1001', 12, 25000, 'Experienced cardiologist specializing in preventive and interventional cardiology.', 'Main Building', '2', '201', 'English', 'ACTIVE', NOW(), NOW()),
  ('doc-002', 'c4ac0ade-222b-46ad-8730-30c063c81d37', 'Dr. Chen', 'Pediatrician', 'spec-004', 'LIC-1002', 8, 20000, 'Gentle pediatrician with experience in child development and vaccinations.', 'East Wing', '1', '105', 'English, Mandarin', 'ACTIVE', NOW(), NOW()),
  ('doc-003', '417575a0-4984-40ad-9004-1ea19b0e8b66', 'Dr. Garcia', 'Dermatologist', 'spec-002', 'LIC-1003', 15, 22000, 'Board-certified dermatologist treating skin, hair and nail conditions.', 'West Wing', '3', '302', 'English, Spanish', 'ACTIVE', NOW(), NOW());

-- 4. Update specialization doctor counts
UPDATE specializations s
SET doctor_count = (
  SELECT count(*) FROM doctors d WHERE d.specialization_id = s.id
)
WHERE s.id IN ('spec-001', 'spec-002', 'spec-004');

-- 5. Clinic hours (Mon-Fri 09:00-17:00 for each doctor)
DELETE FROM clinic_hours WHERE doctor_id IN ('doc-001','doc-002','doc-003');
INSERT INTO clinic_hours (doctor_id, day_of_week, start_time, end_time, is_closed) SELECT
  unnest(ARRAY['doc-001','doc-001','doc-001','doc-001','doc-001',
               'doc-002','doc-002','doc-002','doc-002','doc-002',
               'doc-003','doc-003','doc-003','doc-003','doc-003']),
  unnest(ARRAY[1,2,3,4,5,1,2,3,4,5,1,2,3,4,5]),
  unnest(ARRAY['09:00','09:00','09:00','09:00','09:00',
               '09:00','09:00','09:00','09:00','09:00',
               '09:00','09:00','09:00','09:00','09:00']),
  unnest(ARRAY['17:00','17:00','17:00','17:00','17:00',
               '17:00','17:00','17:00','17:00','17:00',
               '17:00','17:00','17:00','17:00','17:00']),
  unnest(ARRAY[FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE]);
