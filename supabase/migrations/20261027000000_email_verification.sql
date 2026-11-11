-- Supabase migration: email verification support.
-- Mirrors server/src/main/resources/db/migration/V3__email_verification.sql (Flyway)
-- so the Supabase schema stays in sync with the Ktor domain entities.
--
-- Adds a UNIQUE index on users.email and a per-account verification status column.
-- Existing phone-only accounts keep their rows unchanged: their email is NULL,
-- so the UNIQUE index does not affect them, and they continue to sign in with
-- username and password. New email registrations start unverified.

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_status VARCHAR(50) NOT NULL DEFAULT 'unverified';
