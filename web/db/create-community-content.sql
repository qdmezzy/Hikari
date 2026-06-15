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
