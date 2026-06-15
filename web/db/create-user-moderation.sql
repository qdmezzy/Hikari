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
