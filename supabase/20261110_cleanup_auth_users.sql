-- Delete the fake auth.users entries I created via SQL
DELETE FROM auth.users WHERE email LIKE '%@mediq.app';

-- Verify deletion
SELECT id, email FROM auth.users WHERE email LIKE '%@mediq.app';