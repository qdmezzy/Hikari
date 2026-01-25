-- Enforce unique profile handles (case-insensitive) in auth.users metadata.
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_unique_username
ON auth.users (lower((raw_user_meta_data->>'username')))
WHERE (raw_user_meta_data->>'username') IS NOT NULL
  AND (raw_user_meta_data->>'username') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_unique_handle
ON auth.users (lower((raw_user_meta_data->>'handle')))
WHERE (raw_user_meta_data->>'handle') IS NOT NULL
  AND (raw_user_meta_data->>'handle') <> '';
