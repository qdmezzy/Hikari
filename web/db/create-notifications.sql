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
