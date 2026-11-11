-- Set demo12345 password for all demo accounts
UPDATE auth.users 
SET encrypted_password = crypt('demo12345', gen_salt('bf')),
    email_confirmed_at = now()
WHERE email IN (
  'dr.smith@mediq.app',
  'dr.chen@mediq.app',
  'sec.jones@mediq.app',
  'dr.garcia@mediq.app',
  'admin@mediq.app',
  'demo@mediq.app'
);

-- Verify
SELECT id, email, email_confirmed_at FROM auth.users WHERE email LIKE '%@mediq.app' ORDER BY email;