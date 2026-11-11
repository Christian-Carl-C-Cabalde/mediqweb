-- Link profiles to the newly created auth user admin@mediq.app
INSERT INTO profiles (user_id, username, full_name, email, role, status)
SELECT 
  id,
  'admin',
  'Admin User',
  email,
  'ADMIN',
  'ACTIVE'
FROM auth.users
WHERE email = 'admin@mediq.app'
ON CONFLICT (user_id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  status = EXCLUDED.status;

-- Verify
SELECT p.id, p.user_id, p.email, p.role, p.status
FROM profiles p
JOIN auth.users au ON au.id = p.user_id
WHERE au.email = 'admin@mediq.app';