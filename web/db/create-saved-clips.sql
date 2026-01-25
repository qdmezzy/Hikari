-- Store saved trailers/clips from Discover
CREATE TABLE IF NOT EXISTS public.saved_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id BIGINT NOT NULL,
    trailer_id TEXT NOT NULL,
    media_title TEXT,
    thumbnail_url TEXT,
    clip_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure expected columns exist even if the table was created earlier
ALTER TABLE public.saved_clips ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.saved_clips ADD COLUMN IF NOT EXISTS media_id BIGINT;
ALTER TABLE public.saved_clips ADD COLUMN IF NOT EXISTS trailer_id TEXT;
ALTER TABLE public.saved_clips ADD COLUMN IF NOT EXISTS media_title TEXT;
ALTER TABLE public.saved_clips ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.saved_clips ADD COLUMN IF NOT EXISTS clip_type TEXT;
ALTER TABLE public.saved_clips ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Prevent duplicates (one save per user per media)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'saved_clips_user_media_unique'
          AND conrelid = 'public.saved_clips'::regclass
    ) THEN
        ALTER TABLE public.saved_clips
        ADD CONSTRAINT saved_clips_user_media_unique UNIQUE (user_id, media_id);
    END IF;
END
$$;

-- Enable Row Level Security
ALTER TABLE public.saved_clips ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own saved clips
DROP POLICY IF EXISTS "Saved clips are viewable by owner" ON public.saved_clips;
CREATE POLICY "Saved clips are viewable by owner"
ON public.saved_clips
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own saved clips
DROP POLICY IF EXISTS "Users can insert saved clips" ON public.saved_clips;
CREATE POLICY "Users can insert saved clips"
ON public.saved_clips
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own saved clips
DROP POLICY IF EXISTS "Users can delete saved clips" ON public.saved_clips;
CREATE POLICY "Users can delete saved clips"
ON public.saved_clips
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Indexes for faster lookup
CREATE INDEX IF NOT EXISTS idx_saved_clips_user_id ON public.saved_clips(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_clips_media_id ON public.saved_clips(media_id);
