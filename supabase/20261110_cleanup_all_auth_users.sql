-- Delete all fake auth.users I created via SQL
DELETE FROM auth.users WHERE email LIKE '%@mediq.app';
DELETE FROM profiles WHERE email LIKE '%@mediq.app';

-- Verify clean
SELECT id, email FROM auth.users WHERE email LIKE '%@mediq.app';
SELECT id, user_id, email FROM profiles WHERE email LIKE '%@mediq.app';