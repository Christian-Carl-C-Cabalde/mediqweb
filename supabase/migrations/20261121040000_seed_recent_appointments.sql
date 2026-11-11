-- Seed recent appointments (last 14 days) for admin dashboard charts
DELETE FROM appointments WHERE id LIKE 'appt-new-%';

INSERT INTO appointments (id, patient_id, doctor_id, starts_at, duration_minutes, status, reason, created_at, updated_at, completed_at, outcome) VALUES
  ('appt-new-001', 'pat-1', 'f3b036aa-73f3-4f9b-87ee-efe6830dea3e', '2026-10-29T09:00:00', 30, 'COMPLETED', 'General consultation', '2026-10-29T09:00:00', '2026-10-29T09:30:00', '2026-10-29T09:30:00', 'Recovered'),
  ('appt-new-002', 'pat-2', '1ec4bf83-13b5-4acb-9573-37a044a83c6b', '2026-10-29T10:15:00', 45, 'CONFIRMED', 'Follow-up', '2026-10-29T10:15:00', '2026-10-29T10:15:00', NULL, NULL),
  ('appt-new-003', 'ed19c70f-8553-435b-b72e-84189017f8e4', '8dc80d20-fd93-4468-a376-77fea7abfb49', '2026-10-29T11:00:00', 30, 'BOOKED', 'Annual checkup', '2026-10-29T11:00:00', '2026-10-29T11:00:00', NULL, NULL),
  ('appt-new-004', '62862410-1eda-4be7-bc2c-0906feebab66', '140e574e-e941-4e30-bb3d-810f294260d4', '2026-10-29T14:00:00', 60, 'CANCELLED', 'Consultation: Cardiology', '2026-10-29T14:00:00', '2026-10-29T13:00:00', NULL, NULL),
  ('appt-new-005', 'bc559ac4-1633-46db-975f-b5882b30bd2d', '39e45a99-2b9c-4ef3-9f22-9effb69529dd', '2026-10-29T15:30:00', 30, 'NO_SHOW', 'Prescription refill', '2026-10-29T15:30:00', '2026-10-29T15:30:00', NULL, NULL),
  ('appt-new-006', '085853d1-a916-45d8-8db0-34ddc718e11f', 'f3b036aa-73f3-4f9b-87ee-efe6830dea3e', '2026-10-30T09:30:00', 30, 'COMPLETED', 'Consultation: Dermatology', '2026-10-30T09:30:00', '2026-10-30T10:00:00', '2026-10-30T10:00:00', 'Improved'),
  ('appt-new-007', '89472562-12cf-4dc0-ba8f-425f1d7b21c3', '1ec4bf83-13b5-4acb-9573-37a044a83c6b', '2026-10-30T11:00:00', 45, 'COMPLETED', 'Consultation: Pediatrics', '2026-10-30T11:00:00', '2026-10-30T11:45:00', '2026-10-30T11:45:00', 'Stable'),
  ('appt-new-008', '16e80252-d81e-4df4-9f01-2162071d2ba4', '8dc80d20-fd93-4468-a376-77fea7abfb49', '2026-10-30T13:00:00', 30, 'BOOKED', 'Vaccination', '2026-10-30T13:00:00', '2026-10-30T13:00:00', NULL, NULL),
  ('appt-new-009', '59badc3b-3e50-49e8-ba4f-4ae10279086e', '140e574e-e941-4e30-bb3d-810f294260d4', '2026-10-30T15:00:00', 30, 'CONFIRMED', 'Lab results review', '2026-10-30T15:00:00', '2026-10-30T15:00:00', NULL, NULL),
  ('appt-new-010', '85a5ffd2-c72c-45ab-8862-5a2687018cdf', '39e45a99-2b9c-4ef3-9f22-9effb69529dd', '2026-10-30T16:00:00', 45, 'COMPLETED', 'Minor procedure', '2026-10-30T16:00:00', '2026-10-30T16:45:00', '2026-10-30T16:45:00', 'Recovered'),
  ('appt-new-011', 'pat-1', 'f3b036aa-73f3-4f9b-87ee-efe6830dea3e', '2026-11-02T09:00:00', 30, 'COMPLETED', 'Follow-up', '2026-11-02T09:00:00', '2026-11-02T09:30:00', '2026-11-02T09:30:00', 'Stable'),
  ('appt-new-012', 'pat-2', '1ec4bf83-13b5-4acb-9573-37a044a83c6b', '2026-11-02T10:00:00', 30, 'BOOKED', 'General consultation', '2026-11-02T10:00:00', '2026-11-02T10:00:00', NULL, NULL),
  ('appt-new-013', 'ed19c70f-8553-435b-b72e-84189017f8e4', '8dc80d20-fd93-4468-a376-77fea7abfb49', '2026-11-02T11:30:00', 45, 'CONFIRMED', 'Annual checkup', '2026-11-02T11:30:00', '2026-11-02T11:30:00', NULL, NULL),
  ('appt-new-014', '62862410-1eda-4be7-bc2c-0906feebab66', '140e574e-e941-4e30-bb3d-810f294260d4', '2026-11-02T14:00:00', 30, 'COMPLETED', 'Consultation: Cardiology', '2026-11-02T14:00:00', '2026-11-02T14:30:00', '2026-11-02T14:30:00', 'Improved'),
  ('appt-new-015', 'bc559ac4-1633-46db-975f-b5882b30bd2d', '39e45a99-2b9c-4ef3-9f22-9effb69529dd', '2026-11-02T15:30:00', 30, 'CANCELLED', 'Prescription refill', '2026-11-02T15:30:00', '2026-11-02T15:00:00', NULL, NULL),
  ('appt-new-016', '085853d1-a916-45d8-8db0-34ddc718e11f', 'f3b036aa-73f3-4f9b-87ee-efe6830dea3e', '2026-11-03T09:15:00', 30, 'NO_SHOW', 'Consultation: Dermatology', '2026-11-03T09:15:00', '2026-11-03T09:15:00', NULL, NULL),
  ('appt-new-017', '89472562-12cf-4dc0-ba8f-425f1d7b21c3', '1ec4bf83-13b5-4acb-9573-37a044a83c6b', '2026-11-03T11:00:00', 60, 'COMPLETED', 'Consultation: Pediatrics', '2026-11-03T11:00:00', '2026-11-03T12:00:00', '2026-11-03T12:00:00', 'Recovered'),
  ('appt-new-018', '16e80252-d81e-4df4-9f01-2162071d2ba4', '8dc80d20-fd93-4468-a376-77fea7abfb49', '2026-11-03T13:30:00', 30, 'BOOKED', 'Vaccination', '2026-11-03T13:30:00', '2026-11-03T13:30:00', NULL, NULL),
  ('appt-new-019', '59badc3b-3e50-49e8-ba4f-4ae10279086e', '140e574e-e941-4e30-bb3d-810f294260d4', '2026-11-03T15:00:00', 45, 'CONFIRMED', 'Lab results review', '2026-11-03T15:00:00', '2026-11-03T15:00:00', NULL, NULL),
  ('appt-new-020', '85a5ffd2-c72c-45ab-8862-5a2687018cdf', '39e45a99-2b9c-4ef3-9f22-9effb69529dd', '2026-11-03T16:30:00', 30, 'COMPLETED', 'Minor procedure', '2026-11-03T16:30:00', '2026-11-03T17:00:00', '2026-11-03T17:00:00', 'Stable')
ON CONFLICT DO NOTHING;
