-- Migration: drop the foreign‑key constraint if it already exists.
-- This runs before the original link‑profiles migration to avoid duplicate‑constraint errors.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
