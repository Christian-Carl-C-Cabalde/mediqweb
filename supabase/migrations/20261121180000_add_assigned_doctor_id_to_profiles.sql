-- File: supabase/migrations/20261121180000_add_assigned_doctor_id_to_profiles.sql
-- Purpose: Add assigned_doctor_id column to profiles table so secretary-to-doctor
--          assignments can be stored on profiles (not just users table).
--          Idempotent: ALTER TABLE ... ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS assigned_doctor_id text;

-- Index for lookups by assigned doctor
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_doctor_id
ON public.profiles(assigned_doctor_id);
