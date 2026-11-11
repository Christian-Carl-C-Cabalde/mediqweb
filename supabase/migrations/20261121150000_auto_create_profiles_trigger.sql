-- File: supabase/migrations/20261121150000_auto_create_profiles_trigger.sql
-- Purpose: Auto-create profiles and users rows when a new Supabase Auth user
--          signs up, so patients (and any role) can self-register and log in
--          immediately without admin intervention.
--          Idempotent: DROP IF EXISTS + CREATE.

-- 1. Function that inserts a profiles row for a new auth user
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into profiles (idempotent via ON CONFLICT)
  INSERT INTO public.profiles (user_id, username, full_name, email, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'PATIENT',
    'ACTIVE',
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert into users table (Ktor domain model) if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    INSERT INTO public.users (id, username, full_name, email, mobile_number, date_of_birth, role, status, doctor_id, assigned_doctor_id, created_at, updated_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.email,
      '',
      '',
      'PATIENT',
      'ACTIVE',
      NULL,
      NULL,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
