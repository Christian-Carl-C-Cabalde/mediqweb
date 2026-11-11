-- Delete ALL fake users I inserted into auth.users
DELETE FROM auth.users WHERE email LIKE '%@mediq.app';
DELETE FROM profiles WHERE email LIKE '%@mediq.app';

-- Verify cleanup
SELECT id, email FROM auth.users WHERE email LIKE '%@mediq.app';
SELECT id, user_id, email FROM profiles WHERE email LIKE '%@mediq.app';