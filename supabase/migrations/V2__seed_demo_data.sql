-- MediQ seed demo data for Supabase.
-- Mirrors server/src/main/kotlin/com/example/mediq/server/jdbc/DatabaseSeeder.kt
--
-- Intended for fresh databases. Each INSERT block is guarded by
-- WHERE NOT EXISTS (SELECT 1 FROM table) so the entire block is skipped
-- if its target table already has any rows. This is table-level, not
-- row-level, idempotency: re-running on a populated database skips tables
-- that already contain data but still attempts to insert into empty ones.
-- It is not designed for safe partial reruns. Supabase runs each migration
-- file inside a transaction, so the whole seed is atomic.
--
-- Do NOT run against a connected or populated Supabase project.
--
-- Demo accounts (password: demo12345, BCrypt cost 12):
--   demo_patient / demo_patient2   (patients)
--   dr.smith, dr.chen, dr.garcia   (doctors)
--   sec.jones                      (secretary)
--   admin                          (admin)

-- -------------------------------------------------------
-- specializations (6)
-- -------------------------------------------------------
INSERT INTO specializations (id, name, description, doctor_count)
SELECT * FROM (VALUES
  ('spec-1', 'Cardiology', 'Heart and cardiovascular system', 0),
  ('spec-2', 'Dermatology', 'Skin, hair, and nails', 0),
  ('spec-3', 'Pediatrics', 'Children's health', 0),
  ('spec-4', 'Orthopedics', 'Bones, joints, and muscles', 0),
  ('spec-5', 'Neurology', 'Nervous system disorders', 0),
  ('spec-6', 'Psychiatry', 'Mental health', 0)
) AS v(id, name, description, doctor_count)
WHERE NOT EXISTS (SELECT 1 FROM specializations);

-- -------------------------------------------------------
-- users (7) + password_hashes (7, all share hash of demo12345)
-- -------------------------------------------------------
INSERT INTO users (id, username, full_name, email, mobile_number, date_of_birth, role, status, doctor_id, assigned_doctor_id, created_at, updated_at)
SELECT * FROM (VALUES
  ('doc-1', 'dr.smith', 'Dr. Sarah Smith', 'dr.smith@mediq.local', '+639171234567', '1980-05-15', 'DOCTOR', 'ACTIVE', 'doc-1', NULL, NOW(), NOW()),
  ('doc-2', 'dr.chen', 'Dr. Michael Chen', 'dr.chen@mediq.local', '+639172345678', '1975-11-22', 'DOCTOR', 'ACTIVE', 'doc-2', NULL, NOW(), NOW()),
  ('sec-1', 'sec.jones', 'Secretary Jane Jones', 'sec.jones@mediq.local', '+639173456789', '1990-03-10', 'SECRETARY', 'ACTIVE', NULL, 'doc-1', NOW(), NOW()),
  ('admin-1', 'admin', 'Admin User', 'admin@mediq.local', '+639170000000', '1985-01-01', 'ADMIN', 'ACTIVE', NULL, NULL, NOW(), NOW()),
  ('doc-3', 'dr.garcia', 'Dr. Maria Garcia', 'dr.garcia@mediq.local', '+639173456789', '1982-08-30', 'DOCTOR', 'ACTIVE', 'doc-3', NULL, NOW(), NOW()),
  ('pat-1', 'demo_patient', 'Demo Patient', 'demo@mediq.local', '+639181111111', '1995-07-20', 'PATIENT', 'ACTIVE', NULL, NULL, NOW(), NOW()),
  ('pat-2', 'demo_patient2', 'Maria Santos', 'maria@mediq.local', '+639182222222', '1988-12-05', 'PATIENT', 'ACTIVE', NULL, NULL, NOW(), NOW())
) AS v(id, username, full_name, email, mobile_number, date_of_birth, role, status, doctor_id, assigned_doctor_id, created_at, updated_at)
WHERE NOT EXISTS (SELECT 1 FROM users);

INSERT INTO password_hashes (user_id, hash)
SELECT * FROM (VALUES
  ('doc-1', '$2b$12$gUrxhjBF6l8HH2wPyrnrQ.mc5Jbcgo3dkwPXqdittSNvxy1b5jceS'),
  ('doc-2', '$2b$12$gUrxhjBF6l8HH2wPyrnrQ.mc5Jbcgo3dkwPXqdittSNvxy1b5jceS'),
  ('sec-1', '$2b$12$gUrxhjBF6l8HH2wPyrnrQ.mc5Jbcgo3dkwPXqdittSNvxy1b5jceS'),
  ('admin-1', '$2b$12$gUrxhjBF6l8HH2wPyrnrQ.mc5Jbcgo3dkwPXqdittSNvxy1b5jceS'),
  ('doc-3', '$2b$12$gUrxhjBF6l8HH2wPyrnrQ.mc5Jbcgo3dkwPXqdittSNvxy1b5jceS'),
  ('pat-1', '$2b$12$gUrxhjBF6l8HH2wPyrnrQ.mc5Jbcgo3dkwPXqdittSNvxy1b5jceS'),
  ('pat-2', '$2b$12$gUrxhjBF6l8HH2wPyrnrQ.mc5Jbcgo3dkwPXqdittSNvxy1b5jceS')
) AS v(user_id, hash)
WHERE NOT EXISTS (SELECT 1 FROM password_hashes);

-- -------------------------------------------------------
-- doctors (3)
-- -------------------------------------------------------
INSERT INTO doctors (id, user_id, full_name, specialty, specialization_id, license_number, years_of_experience, fee_centavos, bio, building, floor, room, languages, status, created_at, updated_at)
SELECT * FROM (VALUES
  ('doc-1', 'doc-1', 'Dr. Sarah Smith', 'Cardiology', 'spec-1', 'PHYS-12345', 15, 150000, 'Board-certified cardiologist.', 'MediQ Medical Center', '3', '301', '["en","tl"]', 'ACTIVE', NOW(), NOW()),
  ('doc-2', 'doc-2', 'Dr. Michael Chen', 'Dermatology', 'spec-2', 'PHYS-23456', 12, 120000, 'Dermatologist specializing in medical and cosmetic dermatology.', 'MediQ Medical Center', '2', '205', '["en","zh"]', 'ACTIVE', NOW(), NOW()),
  ('doc-3', 'doc-3', 'Dr. Maria Garcia', 'Pediatrics', 'spec-3', 'PHYS-34567', 10, 100000, 'Pediatrician with focus on developmental pediatrics.', 'MediQ Medical Center', '1', '110', '["en","tl","es"]', 'ACTIVE', NOW(), NOW())
) AS v(id, user_id, full_name, specialty, specialization_id, license_number, years_of_experience, fee_centavos, bio, building, floor, room, languages, status, created_at, updated_at)
WHERE NOT EXISTS (SELECT 1 FROM doctors);

-- -------------------------------------------------------
-- clinic_hours (15: 3 doctors x Mon-Fri 09:00-17:00)
-- -------------------------------------------------------
-- No natural unique key on (doctor_id, day_of_week) in this schema,
-- so table-level WHERE NOT EXISTS is used instead of ON CONFLICT.
INSERT INTO clinic_hours (doctor_id, day_of_week, start_time, end_time, is_closed)
SELECT * FROM (VALUES
  ('doc-1', 1, '09:00', '17:00', FALSE),
  ('doc-1', 2, '09:00', '17:00', FALSE),
  ('doc-1', 3, '09:00', '17:00', FALSE),
  ('doc-1', 4, '09:00', '17:00', FALSE),
  ('doc-1', 5, '09:00', '17:00', FALSE),
  ('doc-2', 1, '09:00', '17:00', FALSE),
  ('doc-2', 2, '09:00', '17:00', FALSE),
  ('doc-2', 3, '09:00', '17:00', FALSE),
  ('doc-2', 4, '09:00', '17:00', FALSE),
  ('doc-2', 5, '09:00', '17:00', FALSE),
  ('doc-3', 1, '09:00', '17:00', FALSE),
  ('doc-3', 2, '09:00', '17:00', FALSE),
  ('doc-3', 3, '09:00', '17:00', FALSE),
  ('doc-3', 4, '09:00', '17:00', FALSE),
  ('doc-3', 5, '09:00', '17:00', FALSE)
) AS v(doctor_id, day_of_week, start_time, end_time, is_closed)
WHERE NOT EXISTS (SELECT 1 FROM clinic_hours);

-- -------------------------------------------------------
-- message_threads (2)
-- -------------------------------------------------------
INSERT INTO message_threads (id, patient_id, doctor_id, subject, last_message_at, unread_count, awaiting_action)
SELECT * FROM (VALUES
  ('conv-1', 'pat-1', 'doc-1', 'Appointment follow-up', NOW(), 1, FALSE),
  ('conv-2', 'pat-2', 'doc-2', 'Lab results inquiry', NOW(), 0, FALSE)
) AS v(id, patient_id, doctor_id, subject, last_message_at, unread_count, awaiting_action)
WHERE NOT EXISTS (SELECT 1 FROM message_threads);

-- -------------------------------------------------------
-- messages (6 across 2 threads)
-- -------------------------------------------------------
INSERT INTO messages (id, conversation_id, author_id, author_role, body, sent_at, read_at)
SELECT * FROM (VALUES
  ('msg-1', 'conv-1', 'pat-1', 'PATIENT', 'Good morning! Is Dr. Smith still available this Friday afternoon?', NOW(), NOW()),
  ('msg-2', 'conv-1', 'sec-1', 'SECRETARY', 'Good morning! Dr. Smith has two open slots on Friday, 1:00 PM and 2:30 PM. You may reserve either one in the app.', NOW(), NOW()),
  ('msg-3', 'conv-1', 'pat-1', 'PATIENT', 'Thank you! Do I need to bring my previous laboratory results?', NOW(), NOW()),
  ('msg-4', 'conv-1', 'sec-1', 'SECRETARY', 'Yes please, bring your latest CBC and lipid profile. Arrive 15 minutes before your slot for registration.', NOW(), NULL),
  ('msg-5', 'conv-2', 'pat-2', 'PATIENT', 'Hello, I would like to ask about my recent lab results.', NOW(), NOW()),
  ('msg-6', 'conv-2', 'doc-2', 'DOCTOR', 'Hello! Your results are ready. Let''s schedule a follow-up to discuss them.', NOW(), NULL)
) AS v(id, conversation_id, author_id, author_role, body, sent_at, read_at)
WHERE NOT EXISTS (SELECT 1 FROM messages);

-- -------------------------------------------------------
-- appointments (6: 5 completed past, 1 upcoming)
-- -------------------------------------------------------
INSERT INTO appointments (id, patient_id, doctor_id, starts_at, duration_minutes, status, reason, created_at, updated_at, completed_at, outcome)
SELECT * FROM (VALUES
  ('appt-100', 'pat-1', 'doc-1', NOW() - INTERVAL '1 day' + INTERVAL '9 hour', 30, 'COMPLETED', 'Follow-up: blood pressure review', NOW(), NOW(), NULL, NULL),
  ('appt-101', 'pat-2', 'doc-2', NOW() - INTERVAL '2 days' + INTERVAL '10 hour' + INTERVAL '30 minute', 45, 'COMPLETED', 'Follow-up: knee rehabilitation', NOW(), NOW(), NULL, NULL),
  ('appt-102', 'pat-1', 'doc-3', NOW() - INTERVAL '3 days' + INTERVAL '15 hour', 20, 'COMPLETED', 'Child wellness check', NOW(), NOW(), NULL, NULL),
  ('appt-103', 'pat-2', 'doc-1', NOW() - INTERVAL '5 days' + INTERVAL '11 hour', 30, 'COMPLETED', 'Hypertension check', NOW(), NOW(), NULL, NULL),
  ('appt-104', 'pat-1', 'doc-2', NOW() - INTERVAL '7 days' + INTERVAL '14 hour', 30, 'COMPLETED', 'ECG reading and review', NOW(), NOW(), NULL, NULL),
  ('appt-106', 'pat-2', 'doc-3', NOW() + INTERVAL '2 days' + INTERVAL '9 hour', 30, 'CONFIRMED', 'Dermatology consult', NOW(), NOW(), NULL, NULL)
) AS v(id, patient_id, doctor_id, starts_at, duration_minutes, status, reason, created_at, updated_at, completed_at, outcome)
WHERE NOT EXISTS (SELECT 1 FROM appointments);

-- -------------------------------------------------------
-- audit_logs (8)
-- -------------------------------------------------------
-- Requires the audit_logs table (created by supabase migration
-- 20261025000000_audit_logs.sql, mirroring Flyway V2__audit_logs.sql).
INSERT INTO audit_logs (id, actor, action, target, at, severity, created_at)
SELECT * FROM (VALUES
  ('log-1', 'Alex Rivera', 'Deactivated account', 'Dr. Oscar Dela Cruz', NOW() - INTERVAL '3 days', 'WARNING', NOW()),
  ('log-2', 'Alex Rivera', 'Created secretary account', 'Carla Bautista', NOW() - INTERVAL '4 days', 'INFO', NOW()),
  ('log-3', 'Grace Lim', 'Updated patient contact number', 'Maria Concepcion', NOW() - INTERVAL '5 days', 'INFO', NOW()),
  ('log-4', 'System', 'Rejected sign-in attempt', 'unknown@mediq.ph', NOW() - INTERVAL '6 days', 'ERROR', NOW()),
  ('log-5', 'Alex Rivera', 'Added specialization', 'Psychiatry', NOW() - INTERVAL '7 days', 'INFO', NOW()),
  ('log-6', 'Alex Rivera', 'Reactivated account', 'Dennis Ocampo', NOW() - INTERVAL '8 days', 'INFO', NOW()),
  ('log-7', 'System', 'Failed to export audit log', 'retention job', NOW() - INTERVAL '9 days', 'WARNING', NOW()),
  ('log-8', 'Alex Rivera', 'Changed clinic contact email', 'Clinic settings', NOW() - INTERVAL '10 days', 'INFO', NOW())
) AS v(id, actor, action, target, at, severity, created_at)
WHERE NOT EXISTS (SELECT 1 FROM audit_logs);
