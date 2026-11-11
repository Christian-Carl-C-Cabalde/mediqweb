-- Migration: add the foreign‑key constraint for profiles (idempotent via prior drop).
BEGIN;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
COMMIT;
