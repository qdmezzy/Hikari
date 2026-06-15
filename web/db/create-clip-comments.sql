-- Store comments for trailers/clips in Discover
CREATE TABLE IF NOT EXISTS public.clip_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id BIGINT NOT NULL,
    trailer_id TEXT NOT NULL,
    parent_id UUID,
    comment_text TEXT NOT NULL,
    user_display_name TEXT,
    user_handle TEXT,
    user_avatar_url TEXT,
    is_removed BOOLEAN NOT NULL DEFAULT FALSE,
    removed_at TIMESTAMPTZ,
    removed_by UUID REFERENCES auth.users(id),
    removed_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure expected columns exist even if the table was created earlier
ALTER TABLE public.clip_comments ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.clip_comments ADD COLUMN IF NOT EXISTS media_id BIGINT;
ALTER TABLE public.clip_comments ADD COLUMN IF NOT EXISTS trailer_id TEXT;
ALTER TABLE public.clip_comments ADD COLUMN IF NOT EXISTS parent_id UUID;
ALTER TABLE public.clip_comments ADD COLUMN IF NOT EXISTS comment_text TEXT;
ALTER TABLE public.clip_comments ADD COLUMN IF NOT EXISTS user_display_name TEXT;
ALTER TABLE public.clip_comments ADD COLUMN IF NOT EXISTS user_handle TEXT;
ALTER TABLE public.clip_comments ADD COLUMN IF NOT EXISTS user_avatar_url TEXT;
ALTER TABLE public.clip_comments ADD COLUMN IF NOT EXISTS is_removed BOOLEAN;
ALTER TABLE public.clip_comments ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE public.clip_comments ADD COLUMN IF NOT EXISTS removed_by UUID;
ALTER TABLE public.clip_comments ADD COLUMN IF NOT EXISTS removed_reason TEXT;
ALTER TABLE public.clip_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.clip_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Parent-child relationship for replies (cascade delete)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'clip_comments_parent_fk'
          AND conrelid = 'public.clip_comments'::regclass
    ) THEN
        ALTER TABLE public.clip_comments
        ADD CONSTRAINT clip_comments_parent_fk
        FOREIGN KEY (parent_id) REFERENCES public.clip_comments(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- Enable Row Level Security
ALTER TABLE public.clip_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read clip comments
DROP POLICY IF EXISTS "Clip comments are viewable by everyone" ON public.clip_comments;
CREATE POLICY "Clip comments are viewable by everyone"
ON public.clip_comments
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy: Authenticated users can insert their own comments
DROP POLICY IF EXISTS "Users can insert clip comments" ON public.clip_comments;
CREATE POLICY "Users can insert clip comments"
ON public.clip_comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own comments
DROP POLICY IF EXISTS "Users can update clip comments" ON public.clip_comments;
CREATE POLICY "Users can update clip comments"
ON public.clip_comments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own comments
DROP POLICY IF EXISTS "Users can delete clip comments" ON public.clip_comments;
CREATE POLICY "Users can delete clip comments"
ON public.clip_comments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Mods can update clip comments
DROP POLICY IF EXISTS "Mods can update clip comments" ON public.clip_comments;
CREATE POLICY "Mods can update clip comments"
ON public.clip_comments
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
CREATE INDEX IF NOT EXISTS idx_clip_comments_media_id ON public.clip_comments(media_id);
CREATE INDEX IF NOT EXISTS idx_clip_comments_trailer_id ON public.clip_comments(trailer_id);
CREATE INDEX IF NOT EXISTS idx_clip_comments_parent_id ON public.clip_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_clip_comments_user_id ON public.clip_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_clip_comments_removed ON public.clip_comments(is_removed);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_clip_comments_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at when a row is updated
DROP TRIGGER IF EXISTS update_clip_comments_updated_at ON public.clip_comments;
CREATE TRIGGER update_clip_comments_updated_at
    BEFORE UPDATE ON public.clip_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_clip_comments_updated_at_column();
