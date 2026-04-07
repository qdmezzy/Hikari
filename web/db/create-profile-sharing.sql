-- Public profile directory + shareable anime list controls

CREATE TABLE IF NOT EXISTS public.public_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    handle TEXT NOT NULL UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    bio TEXT,
    location TEXT,
    website TEXT,
    joined_at TIMESTAMPTZ,
    show_online_status BOOLEAN NOT NULL DEFAULT TRUE,
    show_watch_activity BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS handle TEXT;
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ;
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN DEFAULT TRUE;
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS show_watch_activity BOOLEAN DEFAULT TRUE;
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.public_profiles pp
SET joined_at = au.created_at
FROM auth.users au
WHERE pp.user_id = au.id
  AND pp.joined_at IS NULL;

ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.public_profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.public_profiles
FOR SELECT
TO anon, authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Users can insert their public profile" ON public.public_profiles;
CREATE POLICY "Users can insert their public profile"
ON public.public_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their public profile" ON public.public_profiles;
CREATE POLICY "Users can update their public profile"
ON public.public_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their public profile" ON public.public_profiles;
CREATE POLICY "Users can delete their public profile"
ON public.public_profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_public_profiles_handle ON public.public_profiles(handle);
CREATE INDEX IF NOT EXISTS idx_public_profiles_watch_visibility ON public.public_profiles(show_watch_activity);

CREATE OR REPLACE FUNCTION update_public_profiles_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_public_profiles_updated_at ON public.public_profiles;
CREATE TRIGGER update_public_profiles_updated_at
    BEFORE UPDATE ON public.public_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_public_profiles_updated_at_column();

-- Per-entry visibility toggle for profile sharing.
ALTER TABLE public.list_entries
ADD COLUMN IF NOT EXISTS hide_from_profile BOOLEAN NOT NULL DEFAULT FALSE;

-- Public read policy for shared anime lists:
-- only when the user opted in and the entry is not hidden.
DROP POLICY IF EXISTS "Public can view shared list entries" ON public.list_entries;
CREATE POLICY "Public can view shared list entries"
ON public.list_entries
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.public_profiles pp
        WHERE pp.user_id = list_entries.user_id
          AND pp.show_watch_activity = TRUE
    )
    AND list_entries.hide_from_profile = FALSE
);
