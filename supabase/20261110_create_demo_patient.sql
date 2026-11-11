-- Create/update demo_patient / demo@mediq.app / demo12345 in Supabase Auth
UPDATE auth.users 
SET encrypted_password = crypt('demo12345', gen_salt('bf')),
    email_confirmed_at = now()
WHERE email = 'demo@mediq.app';

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
SELECT gen_random_uuid(), 'demo@mediq.app', crypt('demo12345', gen_salt('bf')), now(), now(), now(), '{"full_name": "Demo Patient", "role": "PATIENT"}'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo@mediq.app');

-- Create profile for demo@mediq.app if not exists
INSERT INTO profiles (user_id, username, full_name, email, role, status)
SELECT 
  au.id,
  'demo_patient',
  'Demo Patient',
  au.email,
  'PATIENT',
  'ACTIVE'
FROM auth.users au
WHERE au.email = 'demo@mediq.app'
AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.email = au.email);

-- Verify
SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'demo@mediq.app';
SELECT id, user_id, email, role, status FROM profiles WHERE email = 'demo@mediq.app';