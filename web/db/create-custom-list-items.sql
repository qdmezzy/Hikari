-- Store items inside custom user lists
CREATE TABLE IF NOT EXISTS public.custom_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES public.custom_lists(id) ON DELETE CASCADE,
    media_id BIGINT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'ANIME',
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure expected columns exist even if the table was created earlier
ALTER TABLE public.custom_list_items ADD COLUMN IF NOT EXISTS list_id UUID;
ALTER TABLE public.custom_list_items ADD COLUMN IF NOT EXISTS media_id BIGINT;
ALTER TABLE public.custom_list_items ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE public.custom_list_items ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ;

-- Prevent duplicates (one entry per list per media)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'custom_list_items_unique'
          AND conrelid = 'public.custom_list_items'::regclass
    ) THEN
        ALTER TABLE public.custom_list_items
        ADD CONSTRAINT custom_list_items_unique UNIQUE (list_id, media_id);
    END IF;
END
$$;

-- Enable Row Level Security
ALTER TABLE public.custom_list_items ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can read items for their lists, public lists are viewable by everyone
DROP POLICY IF EXISTS "Custom list items are viewable by owner or public" ON public.custom_list_items;
CREATE POLICY "Custom list items are viewable by owner or public"
ON public.custom_list_items
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.custom_lists
        WHERE custom_lists.id = custom_list_items.list_id
          AND (custom_lists.is_public = true OR custom_lists.user_id = auth.uid())
    )
);

-- Policy: Owners can insert items into their lists
DROP POLICY IF EXISTS "Users can insert custom list items" ON public.custom_list_items;
CREATE POLICY "Users can insert custom list items"
ON public.custom_list_items
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.custom_lists
        WHERE custom_lists.id = custom_list_items.list_id
          AND custom_lists.user_id = auth.uid()
    )
);

-- Policy: Owners can delete items from their lists
DROP POLICY IF EXISTS "Users can delete custom list items" ON public.custom_list_items;
CREATE POLICY "Users can delete custom list items"
ON public.custom_list_items
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.custom_lists
        WHERE custom_lists.id = custom_list_items.list_id
          AND custom_lists.user_id = auth.uid()
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_list_items_list_id ON public.custom_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_custom_list_items_media_id ON public.custom_list_items(media_id);
