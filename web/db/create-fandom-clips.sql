-- Store fandom-submitted clips for Discover
CREATE TABLE IF NOT EXISTS public.fandom_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id BIGINT NOT NULL,
    media_title TEXT NOT NULL,
    clip_title TEXT,
    video_url TEXT NOT NULL,
    video_site TEXT NOT NULL,
    video_id TEXT NOT NULL,
    user_display_name TEXT,
    user_handle TEXT,
    user_avatar_url TEXT,
    thumbnail_url TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    spoiler_level TEXT NOT NULL DEFAULT 'None' CHECK (spoiler_level IN ('None', 'Mild', 'Heavy')),
    spoiler_episode INTEGER,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending')),
    is_removed BOOLEAN NOT NULL DEFAULT FALSE,
    removed_at TIMESTAMPTZ,
    removed_by UUID REFERENCES auth.users(id),
    removed_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure expected columns exist even if the table was created earlier
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS media_id BIGINT;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS media_title TEXT;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS clip_title TEXT;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS video_site TEXT;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS video_id TEXT;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS user_display_name TEXT;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS user_handle TEXT;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS user_avatar_url TEXT;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS spoiler_level TEXT;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS spoiler_episode INTEGER;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS is_removed BOOLEAN;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS removed_by UUID;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS removed_reason TEXT;
ALTER TABLE public.fandom_clips ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Enable Row Level Security
ALTER TABLE public.fandom_clips ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read approved fandom clips
DROP POLICY IF EXISTS "Fandom clips are viewable by everyone" ON public.fandom_clips;
CREATE POLICY "Fandom clips are viewable by everyone"
ON public.fandom_clips
FOR SELECT
TO anon, authenticated
USING (status = 'approved');

-- Policy: Authenticated users can insert their own fandom clips
DROP POLICY IF EXISTS "Users can insert fandom clips" ON public.fandom_clips;
CREATE POLICY "Users can insert fandom clips"
ON public.fandom_clips
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own fandom clips
DROP POLICY IF EXISTS "Users can delete fandom clips" ON public.fandom_clips;
CREATE POLICY "Users can delete fandom clips"
ON public.fandom_clips
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Mods can update fandom clips
DROP POLICY IF EXISTS "Mods can update fandom clips" ON public.fandom_clips;
CREATE POLICY "Mods can update fandom clips"
ON public.fandom_clips
FOR UPDATE
TO authenticated
USING (
  COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_mod')::boolean, false)
  OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'isMod')::boolean, false)
)
WITH CHECK (
  COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_mod')::boolean, false)
  OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'isMod')::boolean, false)
);

-- Indexes for faster lookup
CREATE INDEX IF NOT EXISTS idx_fandom_clips_media_id ON public.fandom_clips(media_id);
CREATE INDEX IF NOT EXISTS idx_fandom_clips_video_id ON public.fandom_clips(video_id);
CREATE INDEX IF NOT EXISTS idx_fandom_clips_status ON public.fandom_clips(status);
CREATE INDEX IF NOT EXISTS idx_fandom_clips_created_at ON public.fandom_clips(created_at);
CREATE INDEX IF NOT EXISTS idx_fandom_clips_removed ON public.fandom_clips(is_removed);
