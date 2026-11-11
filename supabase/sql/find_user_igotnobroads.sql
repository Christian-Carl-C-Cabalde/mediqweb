-- Find user igotnobroads@gmail.com in Supabase Auth
-- Run this in the Supabase SQL Editor with service_role or as an authenticated admin

-- 1. Find the auth user by email
SELECT id, email, created_at, raw_user_meta_data, last_sign_in_at
FROM auth.users
WHERE email = 'igotnobroads@gmail.com';

-- 2. If found, link to profiles table by user_id
SELECT p.id, p.username, p.full_name, p.email, p.mobile_number, p.role, p.status, p.created_at
FROM profiles p
JOIN auth.users u ON p.user_id = u.id
WHERE u.email = 'igotnobroads@gmail.com';

-- 3. Also check legacy users table (if it exists)
-- SELECT * FROM users WHERE email = 'igotnobroads@gmail.com';
