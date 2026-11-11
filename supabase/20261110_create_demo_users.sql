-- Create missing 4 demo users with demo12345 password
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES 
  (gen_random_uuid(), 'dr.smith@mediq.app', crypt('demo12345', gen_salt('bf')), now(), now(), now(), '{"full_name": "Dr. Sarah Smith", "role": "DOCTOR"}'),
  (gen_random_uuid(), 'dr.chen@mediq.app', crypt('demo12345', gen_salt('bf')), now(), now(), now(), '{"full_name": "Dr. Michael Chen", "role": "DOCTOR"}'),
  (gen_random_uuid(), 'sec.jones@mediq.app', crypt('demo12345', gen_salt('bf')), now(), now(), now(), '{"full_name": "Secretary Jane Jones", "role": "SECRETARY"}'),
  (gen_random_uuid(), 'dr.garcia@mediq.app', crypt('demo12345', gen_salt('bf')), now(), now(), now(), '{"full_name": "Dr. Maria Garcia", "role": "DOCTOR"}');

-- Update admin@mediq.app password to demo12345
UPDATE auth.users 
SET encrypted_password = crypt('demo12345', gen_salt('bf'))
WHERE email = 'admin@mediq.app';

-- Verify all 5 users exist with confirmed emails
SELECT id, email, email_confirmed_at FROM auth.users WHERE email LIKE '%@mediq.app';