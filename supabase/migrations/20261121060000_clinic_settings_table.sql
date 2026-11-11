-- File: supabase/migrations/20261121060000_clinic_settings_table.sql
-- Purpose: Create clinic_settings table for persistent clinic-wide settings
--          used by the admin settings page. Idempotent.

CREATE TABLE IF NOT EXISTS clinic_settings (
  id VARCHAR(255) PRIMARY KEY DEFAULT 'clinic',
  clinic_name VARCHAR(255) NOT NULL DEFAULT 'MediQ Clinic',
  address VARCHAR(500) NOT NULL DEFAULT '',
  contact_email VARCHAR(255) NOT NULL DEFAULT '',
  contact_number VARCHAR(255) NOT NULL DEFAULT '',
  session_timeout_minutes INTEGER NOT NULL DEFAULT 30,
  retention_period_days INTEGER NOT NULL DEFAULT 1095,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(255) REFERENCES users(id)
);

-- Insert default row
INSERT INTO clinic_settings (id, clinic_name, address, contact_email, contact_number, session_timeout_minutes, retention_period_days)
VALUES ('clinic', 'MediQ Clinic', '12 Katipunan Avenue, Quezon City', 'hello@mediq.ph', '+63 2 8555 0100', 30, 1095)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read settings
DROP POLICY IF EXISTS authenticated_read_all_clinic_settings ON clinic_settings;
CREATE POLICY authenticated_read_all_clinic_settings
  ON clinic_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to update settings
DROP POLICY IF EXISTS admin_update_clinic_settings ON clinic_settings;
CREATE POLICY admin_update_clinic_settings
  ON clinic_settings
  FOR UPDATE
  TO authenticated
  USING (mediq_current_role() = 'ADMIN')
  WITH CHECK (mediq_current_role() = 'ADMIN');

-- Allow admins to insert settings
DROP POLICY IF EXISTS admin_insert_clinic_settings ON clinic_settings;
CREATE POLICY admin_insert_clinic_settings
  ON clinic_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (mediq_current_role() = 'ADMIN');
