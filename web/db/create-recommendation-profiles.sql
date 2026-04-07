-- Per-user recommendation profiles + "not interested" exclusions.
-- Used by Discover For You + AI Recommendations to sync taste across devices.

CREATE TABLE IF NOT EXISTS public.user_taste_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  genre_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  tag_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  vibe_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  format_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_taste_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their taste profile" ON public.user_taste_profiles;
CREATE POLICY "Users can view their taste profile"
ON public.user_taste_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their taste profile" ON public.user_taste_profiles;
CREATE POLICY "Users can insert their taste profile"
ON public.user_taste_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their taste profile" ON public.user_taste_profiles;
CREATE POLICY "Users can update their taste profile"
ON public.user_taste_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their taste profile" ON public.user_taste_profiles;
CREATE POLICY "Users can delete their taste profile"
ON public.user_taste_profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_user_taste_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_taste_profiles_updated_at ON public.user_taste_profiles;
CREATE TRIGGER update_user_taste_profiles_updated_at
BEFORE UPDATE ON public.user_taste_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_taste_profiles_updated_at();

-- "Not interested" exclusions by AniList media id.
CREATE TABLE IF NOT EXISTS public.user_not_interested_media (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, media_id)
);

ALTER TABLE public.user_not_interested_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their not interested list" ON public.user_not_interested_media;
CREATE POLICY "Users can view their not interested list"
ON public.user_not_interested_media
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert into their not interested list" ON public.user_not_interested_media;
CREATE POLICY "Users can insert into their not interested list"
ON public.user_not_interested_media
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete from their not interested list" ON public.user_not_interested_media;
CREATE POLICY "Users can delete from their not interested list"
ON public.user_not_interested_media
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_not_interested_media_user_id ON public.user_not_interested_media(user_id);
CREATE INDEX IF NOT EXISTS idx_user_not_interested_media_media_id ON public.user_not_interested_media(media_id);

