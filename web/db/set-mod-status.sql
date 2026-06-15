-- Grant / revoke moderator status.
--
-- SECURITY: mod status lives in app_metadata (raw_app_meta_data), NOT user_metadata.
-- app_metadata can only be changed by the service role / SQL — users CANNOT edit it
-- themselves (unlike user_metadata, which any signed-in user can self-edit via
-- auth.updateUser). Always store the mod flag here.

-- Make a user a moderator (replace the email):
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{is_mod}',
  'true'::jsonb
)
WHERE email = 'USER_EMAIL_HERE';

-- Remove moderator status:
-- UPDATE auth.users
-- SET raw_app_meta_data = raw_app_meta_data - 'is_mod' - 'isMod'
-- WHERE email = 'USER_EMAIL_HERE';

-- Verify:
-- SELECT id, email, raw_app_meta_data FROM auth.users WHERE email = 'USER_EMAIL_HERE';

-- ---------------------------------------------------------------------------
-- ONE-TIME MIGRATION: move any existing mods from the old (insecure)
-- user_metadata.is_mod / isMod flag into app_metadata, then strip the old flag.
-- Run this once after deploying the security fix.
-- ---------------------------------------------------------------------------
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{is_mod}', 'true'::jsonb)
WHERE COALESCE((raw_user_meta_data ->> 'is_mod')::boolean, (raw_user_meta_data ->> 'isMod')::boolean, false) = true;

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'is_mod' - 'isMod'
WHERE (raw_user_meta_data ? 'is_mod') OR (raw_user_meta_data ? 'isMod');

-- Affected users must sign out/in (or refresh their token) for the new
-- app_metadata claim to appear in their JWT.
