-- Store likes for trailers/clips in Discover
CREATE TABLE IF NOT EXISTS public.clip_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id BIGINT NOT NULL,
    trailer_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure expected columns exist even if the table was created earlier
ALTER TABLE public.clip_likes ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.clip_likes ADD COLUMN IF NOT EXISTS media_id BIGINT;
ALTER TABLE public.clip_likes ADD COLUMN IF NOT EXISTS trailer_id TEXT;
ALTER TABLE public.clip_likes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Prevent duplicates (one like per user per clip)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'clip_likes_user_clip_unique'
          AND conrelid = 'public.clip_likes'::regclass
    ) THEN
        ALTER TABLE public.clip_likes
        ADD CONSTRAINT clip_likes_user_clip_unique UNIQUE (user_id, media_id, trailer_id);
    END IF;
END
$$;

-- Enable Row Level Security
ALTER TABLE public.clip_likes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read likes
DROP POLICY IF EXISTS "Clip likes are viewable by everyone" ON public.clip_likes;
CREATE POLICY "Clip likes are viewable by everyone"
ON public.clip_likes
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy: Authenticated users can like clips
DROP POLICY IF EXISTS "Users can insert clip likes" ON public.clip_likes;
CREATE POLICY "Users can insert clip likes"
ON public.clip_likes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can remove their likes
DROP POLICY IF EXISTS "Users can delete clip likes" ON public.clip_likes;
CREATE POLICY "Users can delete clip likes"
ON public.clip_likes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Indexes for faster lookup
CREATE INDEX IF NOT EXISTS idx_clip_likes_user_id ON public.clip_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_clip_likes_media_id ON public.clip_likes(media_id);
CREATE INDEX IF NOT EXISTS idx_clip_likes_trailer_id ON public.clip_likes(trailer_id);
