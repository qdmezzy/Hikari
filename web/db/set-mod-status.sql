-- SQL script to set a user as a mod
-- Replace 'USER_EMAIL_HERE' with the email of the user you want to make a mod

-- Option 1: Update user metadata directly (recommended)
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{is_mod}',
  'true'::jsonb
)
WHERE email = 'USER_EMAIL_HERE';

-- Option 2: If you want to use isMod instead of is_mod
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{isMod}',
  'true'::jsonb
)
WHERE email = 'USER_EMAIL_HERE';

-- To check if it worked, run:
-- SELECT id, email, raw_user_meta_data FROM auth.users WHERE email = 'USER_EMAIL_HERE';

-- To remove mod status:
-- UPDATE auth.users
-- SET raw_user_meta_data = raw_user_meta_data - 'is_mod' - 'isMod'
-- WHERE email = 'USER_EMAIL_HERE';
