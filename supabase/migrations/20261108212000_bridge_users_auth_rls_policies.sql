-- Supabase migration: bridge Ktor users to Supabase Auth + RLS policies (phase 3a).
--
-- Adds auth_user_id (UUID -> auth.users.id) to the Ktor `users` table so RLS
-- policies can match appointments/messages to the currently authenticated user.
-- Backfills the 5 demo accounts already linked via profiles.
--
-- Then adds RLS policies using mediq_current_role() for role-based access:
--   PATIENT   : own appointments, own messages, own profile/users row
--   DOCTOR    : own appointments, own messages
--   SECRETARY : all appointments, all message threads
--   ADMIN     : all rows on appointments, message threads
--
-- Tables not listed below keep RLS enabled with no policies (deny-all) until
-- their policies are added in a later step. Ktor connects as table owner and
-- bypasses RLS, so existing Angular/Ktor surface is unaffected.

-- 1. Add auth_user_id bridge column to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- 2. Backfill demo accounts: match users.email -> profiles.email -> profiles.user_id (auth.users.id)
UPDATE users u
SET auth_user_id = p.user_id
FROM profiles p
WHERE p.email = u.email
  AND u.email IN (
    'dr.smith@mediq.app', 'dr.chen@mediq.app', 'sec.jones@mediq.app',
    'dr.garcia@mediq.app', 'admin@mediq.app'
  )
  AND u.auth_user_id IS NULL;

-- 3. Index for RLS lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- ===== profiles =====
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "authenticated_read_all_profiles" ON profiles;
CREATE POLICY "authenticated_read_all_profiles" ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- ===== users =====
DROP POLICY IF EXISTS "users_read_own_row" ON users;
CREATE POLICY "users_read_own_row" ON users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_read_all_users" ON users;
CREATE POLICY "authenticated_read_all_users" ON users
  FOR SELECT TO authenticated
  USING (true);

-- ===== appointments =====
DROP POLICY IF EXISTS "patients_read_own_appointments" ON appointments;
CREATE POLICY "patients_read_own_appointments" ON appointments
  FOR SELECT TO authenticated
  USING (
    mediq_current_role() = 'PATIENT'
    AND patient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "patients_create_own_appointments" ON appointments;
CREATE POLICY "patients_create_own_appointments" ON appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    mediq_current_role() = 'PATIENT'
    AND patient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "doctors_read_own_appointments" ON appointments;
CREATE POLICY "doctors_read_own_appointments" ON appointments
  FOR SELECT TO authenticated
  USING (
    mediq_current_role() = 'DOCTOR'
    AND doctor_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "doctors_update_own_appointments" ON appointments;
CREATE POLICY "doctors_update_own_appointments" ON appointments
  FOR UPDATE TO authenticated
  USING (
    mediq_current_role() = 'DOCTOR'
    AND doctor_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    mediq_current_role() = 'DOCTOR'
    AND doctor_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "secretaries_admins_all_appointments" ON appointments;
CREATE POLICY "secretaries_admins_all_appointments" ON appointments
  FOR ALL TO authenticated
  USING (
    mediq_current_role() IN ('SECRETARY', 'ADMIN')
  )
  WITH CHECK (
    mediq_current_role() IN ('SECRETARY', 'ADMIN')
  );

-- ===== message_threads =====
DROP POLICY IF EXISTS "participants_read_own_threads" ON message_threads;
CREATE POLICY "participants_read_own_threads" ON message_threads
  FOR SELECT TO authenticated
  USING (
    patient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR doctor_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "participants_create_own_threads" ON message_threads;
CREATE POLICY "participants_create_own_threads" ON message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    patient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR doctor_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "secretaries_admins_all_threads" ON message_threads;
CREATE POLICY "secretaries_admins_all_threads" ON message_threads
  FOR SELECT TO authenticated
  USING (
    mediq_current_role() IN ('SECRETARY', 'ADMIN')
  );

-- ===== messages =====
DROP POLICY IF EXISTS "participants_read_own_messages" ON messages;
CREATE POLICY "participants_read_own_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    author_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR conversation_id IN (
      SELECT id FROM message_threads
      WHERE patient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
         OR doctor_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "participants_create_own_messages" ON messages;
CREATE POLICY "participants_create_own_messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    AND conversation_id IN (
      SELECT id FROM message_threads
      WHERE patient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
         OR doctor_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- ===== doctors =====
DROP POLICY IF EXISTS "authenticated_read_all_doctors" ON doctors;
CREATE POLICY "authenticated_read_all_doctors" ON doctors
  FOR SELECT TO authenticated
  USING (true);

-- ===== availabilities =====
DROP POLICY IF EXISTS "authenticated_read_all_availabilities" ON availabilities;
CREATE POLICY "authenticated_read_all_availabilities" ON availabilities
  FOR SELECT TO authenticated
  USING (true);
