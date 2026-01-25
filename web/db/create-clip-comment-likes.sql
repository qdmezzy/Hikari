-- Store likes for clip comments
CREATE TABLE IF NOT EXISTS public.clip_comment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    comment_id UUID NOT NULL REFERENCES public.clip_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure expected columns exist even if the table was created earlier
ALTER TABLE public.clip_comment_likes ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.clip_comment_likes ADD COLUMN IF NOT EXISTS comment_id UUID;
ALTER TABLE public.clip_comment_likes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Prevent duplicates (one like per user per comment)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'clip_comment_likes_user_comment_unique'
          AND conrelid = 'public.clip_comment_likes'::regclass
    ) THEN
        ALTER TABLE public.clip_comment_likes
        ADD CONSTRAINT clip_comment_likes_user_comment_unique UNIQUE (user_id, comment_id);
    END IF;
END
$$;

-- Enable Row Level Security
ALTER TABLE public.clip_comment_likes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read likes
DROP POLICY IF EXISTS "Clip comment likes are viewable by everyone" ON public.clip_comment_likes;
CREATE POLICY "Clip comment likes are viewable by everyone"
ON public.clip_comment_likes
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy: Authenticated users can like comments
DROP POLICY IF EXISTS "Users can insert clip comment likes" ON public.clip_comment_likes;
CREATE POLICY "Users can insert clip comment likes"
ON public.clip_comment_likes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can remove their likes
DROP POLICY IF EXISTS "Users can delete clip comment likes" ON public.clip_comment_likes;
CREATE POLICY "Users can delete clip comment likes"
ON public.clip_comment_likes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Indexes for faster lookup
CREATE INDEX IF NOT EXISTS idx_clip_comment_likes_user_id ON public.clip_comment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_clip_comment_likes_comment_id ON public.clip_comment_likes(comment_id);
