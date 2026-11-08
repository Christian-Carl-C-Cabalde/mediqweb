-- Supabase migration: RLS policies on remaining tables (phase 3b).
--
-- Tables: clinic_hours, notifications, otp_codes, refresh_tokens, specializations
--
-- Access model:
--   clinic_hours   : doctors own (read/write), authenticated read all
--   notifications  : users read own only
--   otp_codes      : deny-all (no public policy; service role via Ktor/Edge Functions)
--   refresh_tokens : deny-all (no public policy; service role via Ktor/Edge Functions)
--   specializations: authenticated read all
--
-- Ktor connects as table owner and bypasses RLS, so existing surface is unaffected.

-- ===== clinic_hours =====
DROP POLICY IF EXISTS "doctors_own_clinic_hours" ON clinic_hours;
CREATE POLICY "doctors_own_clinic_hours" ON clinic_hours
  FOR ALL TO authenticated
  USING (
    mediq_current_role() = 'DOCTOR'
    AND doctor_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    mediq_current_role() = 'DOCTOR'
    AND doctor_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "authenticated_read_all_clinic_hours" ON clinic_hours;
CREATE POLICY "authenticated_read_all_clinic_hours" ON clinic_hours
  FOR SELECT TO authenticated
  USING (true);

-- ===== notifications =====
DROP POLICY IF EXISTS "users_read_own_notifications" ON notifications;
CREATE POLICY "users_read_own_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- ===== otp_codes =====
-- No public policies: deny-all for anon/authenticated.
-- OTP is issued/verified via Supabase Auth or Edge Function (service role).

-- ===== refresh_tokens =====
-- No public policies: deny-all for anon/authenticated.
-- Refresh tokens managed via Ktor or Supabase Auth (service role).

-- ===== specializations =====
DROP POLICY IF EXISTS "authenticated_read_all_specializations" ON specializations;
CREATE POLICY "authenticated_read_all_specializations" ON specializations
  FOR SELECT TO authenticated
  USING (true);
