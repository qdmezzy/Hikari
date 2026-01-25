-- Create custom user lists (playlists/collections)
CREATE TABLE IF NOT EXISTS public.custom_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure expected columns exist even if the table was created earlier
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS is_public BOOLEAN;
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Enable Row Level Security
ALTER TABLE public.custom_lists ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can read their lists, public lists are visible to everyone
DROP POLICY IF EXISTS "Custom lists are viewable by owner or public" ON public.custom_lists;
CREATE POLICY "Custom lists are viewable by owner or public"
ON public.custom_lists
FOR SELECT
TO anon, authenticated
USING (is_public = true OR auth.uid() = user_id);

-- Policy: Authenticated users can insert their own lists
DROP POLICY IF EXISTS "Users can insert custom lists" ON public.custom_lists;
CREATE POLICY "Users can insert custom lists"
ON public.custom_lists
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own lists
DROP POLICY IF EXISTS "Users can update custom lists" ON public.custom_lists;
CREATE POLICY "Users can update custom lists"
ON public.custom_lists
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own lists
DROP POLICY IF EXISTS "Users can delete custom lists" ON public.custom_lists;
CREATE POLICY "Users can delete custom lists"
ON public.custom_lists
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_lists_user_id ON public.custom_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_lists_is_public ON public.custom_lists(is_public);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_lists_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at when a row is updated
DROP TRIGGER IF EXISTS update_custom_lists_updated_at ON public.custom_lists;
CREATE TRIGGER update_custom_lists_updated_at
    BEFORE UPDATE ON public.custom_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_lists_updated_at_column();
