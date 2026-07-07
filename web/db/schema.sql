-- Hikari full database schema.
-- Recreates every table, policy, function, and index for the app.
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query -> paste ALL of this -> Run.
-- Safe to re-run (uses IF NOT EXISTS / DROP POLICY IF EXISTS). Your auth users are untouched.
-- After running, grant yourself moderator with the template at the bottom.

-- =============================================================================
-- create-list-entries.sql
-- =============================================================================
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


-- =============================================================================
-- create-media-cache.sql
-- =============================================================================
-- Server-side cache of AniList media metadata (covers, titles, genres, etc.).
--
-- This is the foundation for owning your own media API: the app talks to
-- /api/media instead of AniList directly, and /api/media serves from this
-- table first, only hitting AniList for misses/stale rows. Over time you
-- accumulate your own copy of the catalog — faster, outage-resistant, and a
-- drop-in seam to later swap AniList for your own synced dataset.
--
-- Writes happen ONLY via the service role (the /api/media route). RLS is on
-- with no policies, so regular clients can't read/write it directly.

CREATE TABLE IF NOT EXISTS public.media_cache (
  media_id BIGINT PRIMARY KEY,           -- AniList media id (your canonical id for now)
  data JSONB NOT NULL,                    -- the media object as the app consumes it
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_cache_fetched_at ON public.media_cache(fetched_at);

ALTER TABLE public.media_cache ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (server) touches this cache.


-- =============================================================================
-- create-social.sql
-- =============================================================================
-- Social posts, reactions, comments, follows
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  fandom TEXT,
  attached_media_id BIGINT,
  attached_media_title TEXT,
  attached_media_type TEXT,
  attached_list_id UUID,
  attached_list_name TEXT,
  clip_url TEXT,
  post_type TEXT NOT NULL DEFAULT 'text',
  has_spoilers BOOLEAN NOT NULL DEFAULT FALSE,
  spoiler_range TEXT,
  poll_options TEXT[] NOT NULL DEFAULT '{}',
  post_to_discover BOOLEAN NOT NULL DEFAULT FALSE,
  user_display_name TEXT,
  user_handle TEXT,
  user_avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.social_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'repost', 'save')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id, reaction_type)
);

CREATE TABLE IF NOT EXISTS public.social_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.social_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  user_display_name TEXT,
  user_handle TEXT,
  user_avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.social_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.social_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.social_posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'user_report',
  target_type TEXT NOT NULL DEFAULT 'social_post' CHECK (target_type IN ('social_post', 'review', 'clip', 'clip_comment', 'profile')),
  target_id TEXT,
  target_label TEXT,
  target_url TEXT,
  target_user_id UUID,
  target_user_handle TEXT,
  target_user_display_name TEXT,
  target_user_avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow reports for non-social content types
ALTER TABLE public.social_reports ALTER COLUMN post_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.social_follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Social posts are viewable by everyone" ON public.social_posts;
CREATE POLICY "Social posts are viewable by everyone"
ON public.social_posts
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Users can insert social posts" ON public.social_posts;
CREATE POLICY "Users can insert social posts"
ON public.social_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their social posts" ON public.social_posts;
CREATE POLICY "Users can update their social posts"
ON public.social_posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their social posts" ON public.social_posts;
CREATE POLICY "Users can delete their social posts"
ON public.social_posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Social reactions are viewable by everyone" ON public.social_reactions;
CREATE POLICY "Social reactions are viewable by everyone"
ON public.social_reactions
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Users can react to social posts" ON public.social_reactions;
CREATE POLICY "Users can react to social posts"
ON public.social_reactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their reactions" ON public.social_reactions;
CREATE POLICY "Users can delete their reactions"
ON public.social_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Social comments are viewable by everyone" ON public.social_comments;
CREATE POLICY "Social comments are viewable by everyone"
ON public.social_comments
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Social poll votes are viewable by everyone" ON public.social_poll_votes;
CREATE POLICY "Social poll votes are viewable by everyone"
ON public.social_poll_votes
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Users can insert social comments" ON public.social_comments;
CREATE POLICY "Users can insert social comments"
ON public.social_comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their social comments" ON public.social_comments;
CREATE POLICY "Users can update their social comments"
ON public.social_comments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their social comments" ON public.social_comments;
CREATE POLICY "Users can delete their social comments"
ON public.social_comments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can vote on polls" ON public.social_poll_votes;
CREATE POLICY "Users can vote on polls"
ON public.social_poll_votes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their poll votes" ON public.social_poll_votes;
CREATE POLICY "Users can update their poll votes"
ON public.social_poll_votes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their poll votes" ON public.social_poll_votes;
CREATE POLICY "Users can delete their poll votes"
ON public.social_poll_votes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can report social posts" ON public.social_reports;
CREATE POLICY "Users can report social posts"
ON public.social_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can view their follows" ON public.social_follows;
CREATE POLICY "Users can view their follows"
ON public.social_follows
FOR SELECT
TO authenticated
USING (follower_id = auth.uid());

DROP POLICY IF EXISTS "Users can follow/unfollow" ON public.social_follows;
CREATE POLICY "Users can follow/unfollow"
ON public.social_follows
FOR INSERT
TO authenticated
WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove follows" ON public.social_follows;
CREATE POLICY "Users can remove follows"
ON public.social_follows
FOR DELETE
TO authenticated
USING (follower_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON public.social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_reactions_post_id ON public.social_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_post_id ON public.social_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_social_follows_follower ON public.social_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_social_poll_votes_post_id ON public.social_poll_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_social_reports_post_id ON public.social_reports(post_id);

-- Moderation fields
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS is_removed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES auth.users(id);
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS removed_reason TEXT;

ALTER TABLE public.social_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed', 'escalated'));
ALTER TABLE public.social_reports ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id);
ALTER TABLE public.social_reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.social_reports ADD COLUMN IF NOT EXISTS resolution_action TEXT;
ALTER TABLE public.social_reports ADD COLUMN IF NOT EXISTS resolution_note TEXT;
ALTER TABLE public.social_reports ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE public.social_reports ADD COLUMN IF NOT EXISTS target_id TEXT;
ALTER TABLE public.social_reports ADD COLUMN IF NOT EXISTS target_label TEXT;
ALTER TABLE public.social_reports ADD COLUMN IF NOT EXISTS target_url TEXT;
ALTER TABLE public.social_reports ADD COLUMN IF NOT EXISTS target_user_id UUID;
ALTER TABLE public.social_reports ADD COLUMN IF NOT EXISTS target_user_handle TEXT;
ALTER TABLE public.social_reports ADD COLUMN IF NOT EXISTS target_user_display_name TEXT;
ALTER TABLE public.social_reports ADD COLUMN IF NOT EXISTS target_user_avatar_url TEXT;

UPDATE public.social_reports SET status = 'pending' WHERE status IS NULL;
UPDATE public.social_reports SET target_type = 'social_post' WHERE target_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_removed ON public.social_posts(is_removed);
CREATE INDEX IF NOT EXISTS idx_social_reports_status ON public.social_reports(status);
CREATE INDEX IF NOT EXISTS idx_social_reports_resolved_at ON public.social_reports(resolved_at);
CREATE INDEX IF NOT EXISTS idx_social_reports_target_type ON public.social_reports(target_type);
CREATE INDEX IF NOT EXISTS idx_social_reports_target_user_id ON public.social_reports(target_user_id);

-- Mod access policies (uses user_metadata.is_mod or user_metadata.isMod)
DROP POLICY IF EXISTS "Mods can view social reports" ON public.social_reports;
CREATE POLICY "Mods can view social reports"
ON public.social_reports
FOR SELECT
TO authenticated
USING (
  COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_mod')::boolean, false)
  OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'isMod')::boolean, false)
);

DROP POLICY IF EXISTS "Mods can update social reports" ON public.social_reports;
CREATE POLICY "Mods can update social reports"
ON public.social_reports
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

DROP POLICY IF EXISTS "Mods can update social posts" ON public.social_posts;
CREATE POLICY "Mods can update social posts"
ON public.social_posts
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


-- =============================================================================
-- create-reviews.sql
-- =============================================================================
-- Create reviews table for user ratings and comments
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id BIGINT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
    review_text TEXT NOT NULL,
    user_display_name TEXT,
    user_avatar_url TEXT,
    is_removed BOOLEAN NOT NULL DEFAULT FALSE,
    removed_at TIMESTAMPTZ,
    removed_by UUID REFERENCES auth.users(id),
    removed_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure expected columns exist even if the table was created earlier
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS media_id BIGINT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS review_text TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS user_display_name TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS user_avatar_url TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_removed BOOLEAN;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS removed_by UUID;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS removed_reason TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Prevent duplicates (one review per user per media)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'reviews_user_media_unique'
          AND conrelid = 'public.reviews'::regclass
    ) THEN
        ALTER TABLE public.reviews
        ADD CONSTRAINT reviews_user_media_unique UNIQUE (user_id, media_id);
    END IF;
END
$$;

-- Enable Row Level Security
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read reviews
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone"
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy: Authenticated users can insert their own reviews
DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.reviews;
CREATE POLICY "Users can insert their own reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own reviews
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
CREATE POLICY "Users can update their own reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own reviews
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;
CREATE POLICY "Users can delete their own reviews"
ON public.reviews
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Mods can update reviews
DROP POLICY IF EXISTS "Mods can update reviews" ON public.reviews;
CREATE POLICY "Mods can update reviews"
ON public.reviews
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
CREATE INDEX IF NOT EXISTS idx_reviews_media_id ON public.reviews(media_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_removed ON public.reviews(is_removed);

-- Function to automatically update updated_at timestamp (if not already created)
CREATE OR REPLACE FUNCTION update_reviews_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at when a row is updated
DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at
    BEFORE UPDATE ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_reviews_updated_at_column();


-- =============================================================================
-- create-custom-lists.sql
-- =============================================================================
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


-- =============================================================================
-- create-custom-list-items.sql
-- =============================================================================
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


-- =============================================================================
-- create-fandom-clips.sql
-- =============================================================================
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


-- =============================================================================
-- create-clip-comments.sql
-- =============================================================================
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


-- =============================================================================
-- create-clip-comment-likes.sql
-- =============================================================================
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


-- =============================================================================
-- create-clip-likes.sql
-- =============================================================================
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


-- =============================================================================
-- create-saved-clips.sql
-- =============================================================================
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


-- =============================================================================
-- create-community-content.sql
-- =============================================================================
-- Community announcements + forum threads.
-- These are moderator-authored content: only mods can create / edit / delete.
-- Everyone authenticated (and anon) can read published items.

-- ---------------------------------------------------------------------------
-- Reusable moderator check based on the JWT app_metadata flag.
-- IMPORTANT: app_metadata is writable ONLY by the service role, so users
-- cannot self-promote (unlike user_metadata, which they can edit themselves).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_mod')::boolean, false)
      OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'isMod')::boolean, false);
$$ LANGUAGE sql STABLE;

-- ===========================================================================
-- Announcements
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS body TEXT DEFAULT '';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published announcements are viewable by everyone" ON public.announcements;
CREATE POLICY "Published announcements are viewable by everyone"
ON public.announcements
FOR SELECT
TO anon, authenticated
USING (is_published = TRUE OR public.is_moderator());

DROP POLICY IF EXISTS "Mods can insert announcements" ON public.announcements;
CREATE POLICY "Mods can insert announcements"
ON public.announcements
FOR INSERT
TO authenticated
WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS "Mods can update announcements" ON public.announcements;
CREATE POLICY "Mods can update announcements"
ON public.announcements
FOR UPDATE
TO authenticated
USING (public.is_moderator())
WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS "Mods can delete announcements" ON public.announcements;
CREATE POLICY "Mods can delete announcements"
ON public.announcements
FOR DELETE
TO authenticated
USING (public.is_moderator());

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);

-- ===========================================================================
-- Forum threads (moderator-authored)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.forum_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'general',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    view_count INTEGER NOT NULL DEFAULT 0,
    reply_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS body TEXT DEFAULT '';
ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE;
ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0;
ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published threads are viewable by everyone" ON public.forum_threads;
CREATE POLICY "Published threads are viewable by everyone"
ON public.forum_threads
FOR SELECT
TO anon, authenticated
USING (is_published = TRUE OR public.is_moderator());

DROP POLICY IF EXISTS "Mods can insert threads" ON public.forum_threads;
CREATE POLICY "Mods can insert threads"
ON public.forum_threads
FOR INSERT
TO authenticated
WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS "Mods can update threads" ON public.forum_threads;
CREATE POLICY "Mods can update threads"
ON public.forum_threads
FOR UPDATE
TO authenticated
USING (public.is_moderator())
WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS "Mods can delete threads" ON public.forum_threads;
CREATE POLICY "Mods can delete threads"
ON public.forum_threads
FOR DELETE
TO authenticated
USING (public.is_moderator());

CREATE INDEX IF NOT EXISTS idx_forum_threads_pinned_created
    ON public.forum_threads(is_pinned DESC, created_at DESC);

-- ===========================================================================
-- updated_at triggers
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.update_community_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_announcements_updated_at ON public.announcements;
CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON public.announcements
    FOR EACH ROW
    EXECUTE FUNCTION public.update_community_content_updated_at();

DROP TRIGGER IF EXISTS update_forum_threads_updated_at ON public.forum_threads;
CREATE TRIGGER update_forum_threads_updated_at
    BEFORE UPDATE ON public.forum_threads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_community_content_updated_at();


-- =============================================================================
-- create-recommendation-profiles.sql
-- =============================================================================
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



-- =============================================================================
-- create-profile-sharing.sql
-- =============================================================================
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
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS show_favorites BOOLEAN DEFAULT TRUE;
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS favorite_media_ids BIGINT[] DEFAULT '{}';
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


-- =============================================================================
-- create-notifications.sql
-- =============================================================================
-- Server-backed, cross-device notifications.
--
-- Social notifications (follow / like / comment / reply) are created by
-- SECURITY DEFINER triggers so the recipient gets them automatically and
-- no client can forge/spam notifications for other users. Self-generated
-- notifications (episode alerts, digests) are inserted by the owner via RLS.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- recipient
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,         -- who triggered it (nullable)
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT,
  href TEXT,
  metadata JSONB,
  dedupe_key TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill columns if an older version of the table already exists.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'system';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS href TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- One notification per (user, dedupe_key) when a dedupe key is supplied
-- (used for episode/digest alerts so we never double-notify).
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedupe
  ON public.notifications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Recipients can read their own notifications.
DROP POLICY IF EXISTS "Users can read their notifications" ON public.notifications;
CREATE POLICY "Users can read their notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Recipients can mark their own notifications read/unread.
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Recipients can delete their own notifications.
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
CREATE POLICY "Users can delete their notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Users may insert notifications ONLY for themselves (episode alerts, digests).
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Realtime delivery.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Helper: resolve a user's display name for notification copy.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_actor_name(actor UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(p.display_name, ''),
    NULLIF('@' || p.handle, '@'),
    'Someone'
  )
  FROM public.public_profiles p
  WHERE p.user_id = actor;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: new follower.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_name TEXT;
  actor_handle TEXT;
BEGIN
  IF NEW.follower_id = NEW.following_id THEN
    RETURN NEW;
  END IF;

  actor_name := COALESCE(public.notify_actor_name(NEW.follower_id), 'Someone');
  SELECT handle INTO actor_handle FROM public.public_profiles WHERE user_id = NEW.follower_id;

  INSERT INTO public.notifications (user_id, actor_id, type, title, message, href, metadata)
  VALUES (
    NEW.following_id,
    NEW.follower_id,
    'follow',
    actor_name || ' started following you',
    'Tap to view their profile.',
    CASE WHEN actor_handle IS NOT NULL THEN '/u/' || actor_handle ELSE '/community' END,
    jsonb_build_object('actorId', NEW.follower_id, 'handle', actor_handle)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_follow ON public.social_follows;
CREATE TRIGGER trg_notify_on_follow
  AFTER INSERT ON public.social_follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- ---------------------------------------------------------------------------
-- Trigger: like on your post.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
  actor_name TEXT;
BEGIN
  IF NEW.reaction_type <> 'like' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO owner_id FROM public.social_posts WHERE id = NEW.post_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  actor_name := COALESCE(public.notify_actor_name(NEW.user_id), 'Someone');

  INSERT INTO public.notifications (user_id, actor_id, type, title, message, href, metadata)
  VALUES (
    owner_id,
    NEW.user_id,
    'favorite',
    actor_name || ' liked your post',
    NULL,
    '/community/' || NEW.post_id,
    jsonb_build_object('postId', NEW.post_id, 'actorId', NEW.user_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_reaction ON public.social_reactions;
CREATE TRIGGER trg_notify_on_reaction
  AFTER INSERT ON public.social_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_reaction();

-- ---------------------------------------------------------------------------
-- Trigger: comment / reply.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner UUID;
  parent_owner UUID;
  actor_name TEXT;
BEGIN
  actor_name := COALESCE(public.notify_actor_name(NEW.user_id), 'Someone');

  -- Notify the post owner.
  SELECT user_id INTO post_owner FROM public.social_posts WHERE id = NEW.post_id;
  IF post_owner IS NOT NULL AND post_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, title, message, href, metadata)
    VALUES (
      post_owner,
      NEW.user_id,
      'post',
      actor_name || ' commented on your post',
      LEFT(NEW.content, 140),
      '/community/' || NEW.post_id,
      jsonb_build_object('postId', NEW.post_id, 'actorId', NEW.user_id)
    );
  END IF;

  -- Notify the parent comment owner on a reply (if different from post owner & actor).
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_owner FROM public.social_comments WHERE id = NEW.parent_id;
    IF parent_owner IS NOT NULL
       AND parent_owner <> NEW.user_id
       AND parent_owner IS DISTINCT FROM post_owner THEN
      INSERT INTO public.notifications (user_id, actor_id, type, title, message, href, metadata)
      VALUES (
        parent_owner,
        NEW.user_id,
        'post',
        actor_name || ' replied to your comment',
        LEFT(NEW.content, 140),
        '/community/' || NEW.post_id,
        jsonb_build_object('postId', NEW.post_id, 'actorId', NEW.user_id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.social_comments;
CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.social_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

GRANT EXECUTE ON FUNCTION public.notify_actor_name(UUID) TO authenticated;


-- =============================================================================
-- create-user-moderation.sql
-- =============================================================================
-- User bans + ban appeals.
--
-- Bans are written ONLY through SECURITY DEFINER admin RPCs (mods can't INSERT
-- directly). A banned user can read their own ban row (to see why) and submit
-- one appeal at a time. Mods can read all bans/appeals and review appeals.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'Violation of community guidelines',
  banned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,            -- NULL = permanent
  active BOOLEAN NOT NULL DEFAULT TRUE,
  lifted_at TIMESTAMPTZ,
  lifted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- At most one active ban per user.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_bans_active_user
  ON public.user_bans(user_id) WHERE active;

CREATE TABLE IF NOT EXISTS public.ban_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ban_id UUID REFERENCES public.user_bans(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_ban_appeals_user ON public.ban_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_ban_appeals_status ON public.ban_appeals(status);

-- Only one pending appeal per user.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ban_appeals_one_pending
  ON public.ban_appeals(user_id) WHERE status = 'pending';

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ban_appeals ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- user_bans policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read their own ban" ON public.user_bans;
CREATE POLICY "Users can read their own ban"
ON public.user_bans
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Mods can read all bans" ON public.user_bans;
CREATE POLICY "Mods can read all bans"
ON public.user_bans
FOR SELECT
TO authenticated
USING (
  COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_mod')::boolean, false)
  OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'isMod')::boolean, false)
);
-- No INSERT/UPDATE/DELETE policies: writes happen only via the RPCs below.

-- ---------------------------------------------------------------------------
-- ban_appeals policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read their own appeals" ON public.ban_appeals;
CREATE POLICY "Users can read their own appeals"
ON public.ban_appeals
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can submit appeals" ON public.ban_appeals;
CREATE POLICY "Users can submit appeals"
ON public.ban_appeals
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Mods can read all appeals" ON public.ban_appeals;
CREATE POLICY "Mods can read all appeals"
ON public.ban_appeals
FOR SELECT
TO authenticated
USING (
  COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_mod')::boolean, false)
  OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'isMod')::boolean, false)
);

DROP POLICY IF EXISTS "Mods can update appeals" ON public.ban_appeals;
CREATE POLICY "Mods can update appeals"
ON public.ban_appeals
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

-- ---------------------------------------------------------------------------
-- Authoritative ban check (used by app + can gate other policies).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_user_banned(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_bans b
    WHERE b.user_id = uid
      AND b.active
      AND (b.expires_at IS NULL OR b.expires_at > NOW())
  );
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs (moderators only). Depend on public.is_moderator().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_ban_user(
  target_user_id UUID,
  ban_reason TEXT DEFAULT NULL,
  ban_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Clear any existing active ban first, then insert a fresh one.
  UPDATE public.user_bans
    SET active = FALSE, lifted_at = NOW(), lifted_by = auth.uid()
    WHERE user_id = target_user_id AND active;

  INSERT INTO public.user_bans (user_id, reason, banned_by, expires_at, active)
  VALUES (
    target_user_id,
    COALESCE(NULLIF(ban_reason, ''), 'Violation of community guidelines'),
    auth.uid(),
    ban_expires_at,
    TRUE
  );

  -- Mirror into app_metadata so the JWT carries the flag too.
  UPDATE auth.users
  SET raw_app_meta_data =
    jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{is_banned}', 'true'::jsonb)
  WHERE id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.user_bans
    SET active = FALSE, lifted_at = NOW(), lifted_by = auth.uid()
    WHERE user_id = target_user_id AND active;

  UPDATE auth.users
  SET raw_app_meta_data = (COALESCE(raw_app_meta_data, '{}'::jsonb) - 'is_banned')
  WHERE id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_appeal(
  appeal_id UUID,
  approve BOOLEAN,
  note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appeal_user UUID;
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT user_id INTO appeal_user FROM public.ban_appeals WHERE id = appeal_id;
  IF appeal_user IS NULL THEN
    RAISE EXCEPTION 'Appeal not found';
  END IF;

  UPDATE public.ban_appeals
    SET status = CASE WHEN approve THEN 'approved' ELSE 'denied' END,
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_note = note
    WHERE id = appeal_id;

  IF approve THEN
    PERFORM public.admin_unban_user(appeal_user);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_user_banned(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_appeal(UUID, BOOLEAN, TEXT) TO authenticated;


-- =============================================================================
-- create-feedback.sql
-- =============================================================================
-- Beta feedback / bug reports submitted from /feedback.

CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    message TEXT NOT NULL,
    page_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Anyone (signed in or not) may submit feedback.
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback"
ON public.feedback
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Optional triage flag mods can toggle.
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE;

-- Moderators can read feedback (shown in the Mod dashboard). Regular users can
-- still only insert — they never read others' submissions.
DROP POLICY IF EXISTS "Mods can read feedback" ON public.feedback;
CREATE POLICY "Mods can read feedback"
ON public.feedback
FOR SELECT
TO authenticated
USING (
  COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_mod')::boolean, false)
  OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'isMod')::boolean, false)
);

-- Mods can mark feedback resolved.
DROP POLICY IF EXISTS "Mods can update feedback" ON public.feedback;
CREATE POLICY "Mods can update feedback"
ON public.feedback
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

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);


-- =============================================================================
-- create-status.sql
-- =============================================================================
-- Tables backing the public /status page.
-- Run this in the Supabase SQL editor. Safe to re-run.

-- 1) Bot (and future services) liveness heartbeat.
create table if not exists public.service_heartbeats (
  service text primary key,
  last_seen timestamptz not null default now(),
  meta jsonb
);

-- 2) Manually-posted incidents / status updates shown on /status.
create table if not exists public.status_incidents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  severity text not null default 'minor',     -- minor | major | maintenance
  title text not null,
  body text,
  resolved boolean not null default false,
  resolved_at timestamptz
);

create index if not exists status_incidents_created_idx
  on public.status_incidents (created_at desc);

-- The /status API reads these with the service-role key (server-side), so RLS
-- can stay restrictive. Enable RLS and add no public policies: the anon client
-- never touches these tables directly.
alter table public.service_heartbeats enable row level security;
alter table public.status_incidents enable row level security;

-- Example: post an incident
--   insert into public.status_incidents (severity, title, body)
--   values ('major', 'Login is degraded', 'We are investigating slow sign-ins.');
-- Mark it resolved
--   update public.status_incidents
--   set resolved = true, resolved_at = now()
--   where title = 'Login is degraded';


-- =============================================================================
-- create-unique-handles.sql  (INTENTIONALLY SKIPPED)
-- =============================================================================
-- The original migration added unique indexes on auth.users, but Supabase blocks
-- DDL on auth.users ("must be owner of table users"). It's redundant anyway:
-- public.public_profiles.handle is already UNIQUE (see create-profile-sharing),
-- so handle uniqueness is enforced there and in the app. Omitted on purpose.


-- =============================================================================
-- add-rewatching-status.sql
-- =============================================================================
-- Add rewatching status to list_status_enum if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'list_status_enum'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'list_status_enum'
              AND e.enumlabel = 'rewatching'
        ) THEN
            ALTER TYPE list_status_enum ADD VALUE 'rewatching';
        END IF;
    END IF;
END
$$;


-- =============================================================================
-- create-admin-rpcs.sql
-- =============================================================================
-- Admin/moderator RPCs for the Mod Dashboard.
-- Depends on public.is_moderator() (see create-community-content.sql).
--
-- These are SECURITY DEFINER so a moderator can read the auth.users directory
-- and toggle another user's mod flag. Every function re-checks is_moderator()
-- using the CALLER's JWT, so regular users cannot use them even if invoked.

-- List every user with profile info + role (moderators only).
-- Dropped first because the return signature changed (added is_banned).
DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    display_name TEXT,
    handle TEXT,
    avatar_url TEXT,
    is_mod BOOLEAN,
    is_banned BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_moderator() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT
        u.id,
        u.email::TEXT,
        COALESCE(
            p.display_name,
            u.raw_user_meta_data ->> 'display_name',
            u.raw_user_meta_data ->> 'full_name'
        ) AS display_name,
        COALESCE(
            p.handle,
            u.raw_user_meta_data ->> 'username',
            u.raw_user_meta_data ->> 'handle'
        ) AS handle,
        COALESCE(p.avatar_url, u.raw_user_meta_data ->> 'avatar_url') AS avatar_url,
        COALESCE(
            (u.raw_app_meta_data ->> 'is_mod')::BOOLEAN,
            (u.raw_app_meta_data ->> 'isMod')::BOOLEAN,
            FALSE
        ) AS is_mod,
        COALESCE((u.raw_app_meta_data ->> 'is_banned')::BOOLEAN, FALSE) AS is_banned,
        u.created_at
    FROM auth.users u
    LEFT JOIN public.public_profiles p ON p.user_id = u.id
    ORDER BY u.created_at DESC;
END;
$$;

-- Grant / revoke a user's moderator role (moderators only).
CREATE OR REPLACE FUNCTION public.admin_set_user_mod(target_user_id UUID, make_mod BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_moderator() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Write to app_metadata (service-role only) so the user can't undo/forge it.
    UPDATE auth.users
    SET raw_app_meta_data =
        jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{is_mod}', to_jsonb(make_mod))
    WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_mod(UUID, BOOLEAN) TO authenticated;


-- =============================================================================
-- create-avatar-storage.sql
-- =============================================================================
-- Avatar storage bucket + policies
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'avatars');

drop policy if exists "Users can upload avatars" on storage.objects;
create policy "Users can upload avatars"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'avatars' and auth.uid() = owner);

drop policy if exists "Users can update avatars" on storage.objects;
create policy "Users can update avatars"
on storage.objects
for update
to authenticated
using (bucket_id = 'avatars' and auth.uid() = owner)
with check (bucket_id = 'avatars' and auth.uid() = owner);

drop policy if exists "Users can delete avatars" on storage.objects;
create policy "Users can delete avatars"
on storage.objects
for delete
to authenticated
using (bucket_id = 'avatars' and auth.uid() = owner);


-- =============================================================================
-- ANILIST QUERY CACHE (shared cache for the AniList proxy; service-role only)
-- =============================================================================

create table if not exists public.anilist_query_cache (
  cache_key text primary key,
  status integer not null,
  body text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.anilist_query_cache enable row level security;

create index if not exists anilist_query_cache_expires_at_idx
  on public.anilist_query_cache (expires_at);


-- =============================================================================
-- DISCORD BOT (links + guild alert config; also in discord-bot/sql/)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.discord_links (
    discord_user_id TEXT PRIMARY KEY,
    hikari_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    hikari_username TEXT,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_links_hikari_username
ON public.discord_links (lower(hikari_username));

CREATE OR REPLACE FUNCTION update_discord_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discord_links_updated_at ON public.discord_links;
CREATE TRIGGER trg_discord_links_updated_at
    BEFORE UPDATE ON public.discord_links
    FOR EACH ROW
    EXECUTE FUNCTION update_discord_links_updated_at();

-- Optional columns for a future secure one-time link-token flow
-- (web /discord/link verifies the token instead of trusting a Discord ID in the URL).
ALTER TABLE public.discord_links ADD COLUMN IF NOT EXISTS link_token TEXT;
ALTER TABLE public.discord_links ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_discord_links_token ON public.discord_links(link_token);

-- Per-server (guild) configuration for the Hikari Discord bot.
-- Stores where the bot may broadcast and which role may change its settings.

CREATE TABLE IF NOT EXISTS public.discord_guilds (
    guild_id TEXT PRIMARY KEY,
    guild_name TEXT,
    alert_channel_id TEXT,          -- channel for airing-anime broadcasts
    admin_role_id TEXT,             -- role allowed to change bot settings
    report_webhook_url TEXT,        -- staff channel webhook for web report payloads
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.discord_guilds ADD COLUMN IF NOT EXISTS guild_name TEXT;
ALTER TABLE public.discord_guilds ADD COLUMN IF NOT EXISTS alert_channel_id TEXT;
ALTER TABLE public.discord_guilds ADD COLUMN IF NOT EXISTS admin_role_id TEXT;
ALTER TABLE public.discord_guilds ADD COLUMN IF NOT EXISTS report_webhook_url TEXT;
ALTER TABLE public.discord_guilds ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE public.discord_guilds ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.discord_guilds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- The bot connects with the service role key, so RLS is not required for it.
-- Enable RLS + deny-by-default so the table is never exposed to the anon/web client.
ALTER TABLE public.discord_guilds ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_discord_guilds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discord_guilds_updated_at ON public.discord_guilds;
CREATE TRIGGER trg_discord_guilds_updated_at
    BEFORE UPDATE ON public.discord_guilds
    FOR EACH ROW
    EXECUTE FUNCTION update_discord_guilds_updated_at();


-- =============================================================================
-- OPTIONAL: grant yourself moderator (replace the email, then run just this).
-- =============================================================================
-- UPDATE auth.users
-- SET raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data,'{}'::jsonb),'{is_mod}','true'::jsonb)
-- WHERE email = 'your-email@example.com';
