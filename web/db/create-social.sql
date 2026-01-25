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
  COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_mod')::boolean, false)
  OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'isMod')::boolean, false)
);

DROP POLICY IF EXISTS "Mods can update social reports" ON public.social_reports;
CREATE POLICY "Mods can update social reports"
ON public.social_reports
FOR UPDATE
TO authenticated
USING (
  COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_mod')::boolean, false)
  OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'isMod')::boolean, false)
)
WITH CHECK (
  COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_mod')::boolean, false)
  OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'isMod')::boolean, false)
);

DROP POLICY IF EXISTS "Mods can update social posts" ON public.social_posts;
CREATE POLICY "Mods can update social posts"
ON public.social_posts
FOR UPDATE
TO authenticated
USING (
  COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_mod')::boolean, false)
  OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'isMod')::boolean, false)
)
WITH CHECK (
  COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_mod')::boolean, false)
  OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'isMod')::boolean, false)
);
