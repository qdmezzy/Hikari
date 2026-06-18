-- Create list_entries table for user's anime/manga list
CREATE TABLE IF NOT EXISTS public.list_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id BIGINT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('ANIME', 'MANGA')),
    status TEXT NOT NULL CHECK (status IN ('watching', 'completed', 'dropped', 'on_hold', 'rewatching', 'plan_to_watch')),
    progress INTEGER NOT NULL DEFAULT 0,
    score INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Real start/finish dates (from imports, or set when an entry is completed in-app).
-- These are NOT auto-bumped by the updated_at trigger, so "Finished" labels stay
-- accurate instead of tracking the last edit/import time.
ALTER TABLE public.list_entries ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE public.list_entries ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

-- Add unique constraint to prevent duplicates (same user can't add same media twice)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'list_entries_user_media_unique'
    ) THEN
        ALTER TABLE public.list_entries
        ADD CONSTRAINT list_entries_user_media_unique UNIQUE (user_id, media_id);
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.list_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own list entries
DROP POLICY IF EXISTS "Users can view their own list entries" ON public.list_entries;
CREATE POLICY "Users can view their own list entries"
ON public.list_entries
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own list entries
DROP POLICY IF EXISTS "Users can insert their own list entries" ON public.list_entries;
CREATE POLICY "Users can insert their own list entries"
ON public.list_entries
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own list entries
DROP POLICY IF EXISTS "Users can update their own list entries" ON public.list_entries;
CREATE POLICY "Users can update their own list entries"
ON public.list_entries
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own list entries
DROP POLICY IF EXISTS "Users can delete their own list entries" ON public.list_entries;
CREATE POLICY "Users can delete their own list entries"
ON public.list_entries
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_list_entries_user_id ON public.list_entries(user_id);

-- Create index on media_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_list_entries_media_id ON public.list_entries(media_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at when a row is updated
DROP TRIGGER IF EXISTS update_list_entries_updated_at ON public.list_entries;
CREATE TRIGGER update_list_entries_updated_at
    BEFORE UPDATE ON public.list_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Stamp finished_at when an entry transitions to "completed" in-app (e.g. you
-- mark a show finished). Only fires on UPDATE status-changes, NOT on INSERT, so
-- bulk imports of already-completed titles don't get a fake "finished now" date
-- — they keep the real date from the source (or stay NULL if the source had none).
CREATE OR REPLACE FUNCTION set_list_entry_finished_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed'
       AND NEW.finished_at IS NULL
       AND OLD.status IS DISTINCT FROM 'completed' THEN
        NEW.finished_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_list_entries_finished_at ON public.list_entries;
CREATE TRIGGER set_list_entries_finished_at
    BEFORE UPDATE ON public.list_entries
    FOR EACH ROW
    EXECUTE FUNCTION set_list_entry_finished_at();
