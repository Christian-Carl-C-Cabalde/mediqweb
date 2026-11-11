-- File: supabase/migrations/20261121200000_fix_message_rls_policies.sql
-- Purpose: Fix RLS policies on message_threads and messages tables.
--          The policies reference auth_user_id column which doesn't exist.
--          Fix to use id = auth.uid()::VARCHAR since auth.uid() returns UUID
--          but users.id is VARCHAR.
-- ========================================================================

-- Fix message_threads policies
DROP POLICY IF EXISTS "participants_read_own_threads" ON message_threads;
CREATE POLICY "participants_read_own_threads" ON message_threads
  FOR SELECT TO authenticated
  USING (
    patient_id = (SELECT id FROM users WHERE id = auth.uid()::VARCHAR)
    OR doctor_id = (SELECT id FROM users WHERE id = auth.uid()::VARCHAR)
  );

DROP POLICY IF EXISTS "participants_create_own_threads" ON message_threads;
CREATE POLICY "participants_create_own_threads" ON message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    patient_id = (SELECT id FROM users WHERE id = auth.uid()::VARCHAR)
    OR doctor_id = (SELECT id FROM users WHERE id = auth.uid()::VARCHAR)
  );

-- Allow secretaries and admins to create/read all threads
DROP POLICY IF EXISTS "secretaries_admins_all_threads" ON message_threads;
CREATE POLICY "secretaries_admins_all_threads" ON message_threads
  FOR ALL TO authenticated
  USING (
    mediq_current_role() IN ('SECRETARY', 'ADMIN')
  )
  WITH CHECK (
    mediq_current_role() IN ('SECRETARY', 'ADMIN')
  );

-- Fix messages policies
DROP POLICY IF EXISTS "participants_read_own_messages" ON messages;
CREATE POLICY "participants_read_own_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    author_id = (SELECT id FROM users WHERE id = auth.uid()::VARCHAR)
    OR conversation_id IN (
      SELECT id FROM message_threads
      WHERE patient_id = (SELECT id FROM users WHERE id = auth.uid()::VARCHAR)
         OR doctor_id = (SELECT id FROM users WHERE id = auth.uid()::VARCHAR)
    )
  );

DROP POLICY IF EXISTS "participants_create_own_messages" ON messages;
CREATE POLICY "participants_create_own_messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT id FROM users WHERE id = auth.uid()::VARCHAR)
    AND conversation_id IN (
      SELECT id FROM message_threads
      WHERE patient_id = (SELECT id FROM users WHERE id = auth.uid()::VARCHAR)
         OR doctor_id = (SELECT id FROM users WHERE id = auth.uid()::VARCHAR)
    )
  );

-- Allow secretaries and admins to read/write all messages
DROP POLICY IF EXISTS "secretaries_admins_all_messages" ON messages;
CREATE POLICY "secretaries_admins_all_messages" ON messages
  FOR ALL TO authenticated
  USING (
    mediq_current_role() IN ('SECRETARY', 'ADMIN')
  )
  WITH CHECK (
    mediq_current_role() IN ('SECRETARY', 'ADMIN')
  );
