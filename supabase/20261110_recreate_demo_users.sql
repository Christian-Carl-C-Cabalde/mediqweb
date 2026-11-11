-- Recreate 6 demo users in Supabase Auth with demo12345 password
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES 
  ('a1111111-1111-1111-1111-111111111111', 'dr.smith@mediq.app', crypt('demo12345', gen_salt('bf')), now(), now(), now(), '{"full_name": "Dr. Sarah Smith", "role": "DOCTOR"}'),
  ('a2222222-2222-2222-2222-222222222222', 'dr.chen@mediq.app', crypt('demo12345', gen_salt('bf')), now(), now(), now(), '{"full_name": "Dr. Michael Chen", "role": "DOCTOR"}'),
  ('a3333333-3333-3333-3333-333333333333', 'sec.jones@mediq.app', crypt('demo12345', gen_salt('bf')), now(), now(), now(), '{"full_name": "Secretary Jane Jones", "role": "SECRETARY"}'),
  ('a4444444-4444-4444-4444-444444444444', 'dr.garcia@mediq.app', crypt('demo12345', gen_salt('bf')), now(), now(), now(), '{"full_name": "Dr. Maria Garcia", "role": "DOCTOR"}'),
  ('a5555555-5555-5555-5555-555555555555', 'admin@mediq.app', crypt('demo12345', gen_salt('bf')), now(), now(), now(), '{"full_name": "Admin User", "role": "ADMIN"}'),
  ('a6666666-6666-6666-6666-666666666666', 'demo@mediq.app', crypt('demo12345', gen_salt('bf')), now(), now(), now(), '{"full_name": "Demo Patient", "role": "PATIENT"}')
ON CONFLICT (email) DO UPDATE SET
  encrypted_password = crypt('demo12345', gen_salt('bf')),
  email_confirmed_at = now(),
  updated_at = now();

-- Verify
SELECT id, email, email_confirmed_at FROM auth.users WHERE email LIKE '%@mediq.app' ORDER BY email;