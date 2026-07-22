-- Hikari Founding 25 program.
-- Run after 20260721_security_quality_fixes.sql.
-- Safe to re-run. Invitation codes are hashed before reaching this schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.founding_members (
  user_id UUID PRIMARY KEY,
  member_number SMALLINT NOT NULL UNIQUE CHECK (member_number BETWEEN 1 AND 25),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by UUID NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  show_on_founders_page BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.founding_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_by UUID NULL,
  claimed_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  CHECK (expires_at > created_at),
  CHECK ((claimed_by IS NULL AND claimed_at IS NULL) OR (claimed_by IS NOT NULL AND claimed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.founding_feature_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'archived')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.founding_feature_votes (
  proposal_id UUID NOT NULL REFERENCES public.founding_feature_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  support BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (proposal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_founding_members_active ON public.founding_members(active, member_number);
CREATE INDEX IF NOT EXISTS idx_founding_invites_creator ON public.founding_invites(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_founding_invites_expiry ON public.founding_invites(expires_at) WHERE claimed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_founding_proposals_status ON public.founding_feature_proposals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_founding_votes_proposal ON public.founding_feature_votes(proposal_id);

CREATE OR REPLACE FUNCTION public.is_active_founding_member(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.founding_members fm
    WHERE fm.user_id = check_user_id
      AND fm.active = TRUE
      AND (check_user_id = auth.uid() OR public.is_moderator())
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_founding_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_founding_proposals_updated_at ON public.founding_feature_proposals;
CREATE TRIGGER touch_founding_proposals_updated_at
BEFORE UPDATE ON public.founding_feature_proposals
FOR EACH ROW EXECUTE FUNCTION public.touch_founding_updated_at();

DROP TRIGGER IF EXISTS touch_founding_votes_updated_at ON public.founding_feature_votes;
CREATE TRIGGER touch_founding_votes_updated_at
BEFORE UPDATE ON public.founding_feature_votes
FOR EACH ROW EXECUTE FUNCTION public.touch_founding_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_founding_member_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Founding member numbers are permanent; deactivate the membership instead.';
END;
$$;

DROP TRIGGER IF EXISTS prevent_founding_member_delete ON public.founding_members;
CREATE TRIGGER prevent_founding_member_delete
BEFORE DELETE ON public.founding_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_founding_member_delete();

CREATE OR REPLACE FUNCTION public.remove_inactive_founding_votes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.active = TRUE AND NEW.active = FALSE THEN
    DELETE FROM public.founding_feature_votes WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS remove_inactive_founding_votes ON public.founding_members;
CREATE TRIGGER remove_inactive_founding_votes
AFTER UPDATE OF active ON public.founding_members
FOR EACH ROW EXECUTE FUNCTION public.remove_inactive_founding_votes();

-- Direct table access is intentionally narrow. Invite hashes never have a
-- SELECT policy; all invitation reads go through safe server responses.
ALTER TABLE public.founding_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founding_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founding_feature_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founding_feature_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Founders can read their own membership" ON public.founding_members;
CREATE POLICY "Founders can read their own membership"
ON public.founding_members FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_moderator());

DROP POLICY IF EXISTS "Moderators can grant founding membership" ON public.founding_members;
CREATE POLICY "Moderators can grant founding membership"
ON public.founding_members FOR INSERT TO authenticated
WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS "Moderators can update founding membership" ON public.founding_members;
CREATE POLICY "Moderators can update founding membership"
ON public.founding_members FOR UPDATE TO authenticated
USING (public.is_moderator())
WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS "Founders can read active proposals" ON public.founding_feature_proposals;
CREATE POLICY "Founders can read active proposals"
ON public.founding_feature_proposals FOR SELECT TO authenticated
USING ((status IN ('active', 'closed') AND public.is_active_founding_member()) OR public.is_moderator());

DROP POLICY IF EXISTS "Moderators can create founding proposals" ON public.founding_feature_proposals;
CREATE POLICY "Moderators can create founding proposals"
ON public.founding_feature_proposals FOR INSERT TO authenticated
WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS "Moderators can update founding proposals" ON public.founding_feature_proposals;
CREATE POLICY "Moderators can update founding proposals"
ON public.founding_feature_proposals FOR UPDATE TO authenticated
USING (public.is_moderator())
WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS "Moderators can delete founding proposals" ON public.founding_feature_proposals;
CREATE POLICY "Moderators can delete founding proposals"
ON public.founding_feature_proposals FOR DELETE TO authenticated
USING (public.is_moderator());

DROP POLICY IF EXISTS "Founders can read their own votes" ON public.founding_feature_votes;
CREATE POLICY "Founders can read their own votes"
ON public.founding_feature_votes FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_moderator());

DROP POLICY IF EXISTS "Founders can cast their own votes" ON public.founding_feature_votes;
CREATE POLICY "Founders can cast their own votes"
ON public.founding_feature_votes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_active_founding_member()
  AND EXISTS (
    SELECT 1 FROM public.founding_feature_proposals p
    WHERE p.id = proposal_id AND p.status = 'active'
  )
);

DROP POLICY IF EXISTS "Founders can change their own votes" ON public.founding_feature_votes;
CREATE POLICY "Founders can change their own votes"
ON public.founding_feature_votes FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.is_active_founding_member())
WITH CHECK (
  auth.uid() = user_id
  AND public.is_active_founding_member()
  AND EXISTS (
    SELECT 1 FROM public.founding_feature_proposals p
    WHERE p.id = proposal_id AND p.status = 'active'
  )
);

DROP POLICY IF EXISTS "Founders can remove their own votes" ON public.founding_feature_votes;
CREATE POLICY "Founders can remove their own votes"
ON public.founding_feature_votes FOR DELETE TO authenticated
USING (auth.uid() = user_id AND public.is_active_founding_member());

-- Safe public roster. This function intentionally returns no UUIDs, emails,
-- invite information, or private-profile fields.
CREATE OR REPLACE FUNCTION public.get_founding_public_roster()
RETURNS TABLE (
  member_number SMALLINT,
  display_name TEXT,
  handle TEXT,
  avatar_url TEXT,
  joined_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fm.member_number,
    COALESCE(pp.display_name, pp.handle, 'Hikari Founder'),
    pp.handle,
    pp.avatar_url,
    fm.joined_at
  FROM public.founding_members fm
  JOIN public.public_profiles pp ON pp.user_id = fm.user_id
  WHERE fm.active = TRUE
    AND fm.show_on_founders_page = TRUE
    AND pp.public_profile = TRUE
  ORDER BY fm.member_number;
$$;

CREATE OR REPLACE FUNCTION public.get_founding_public_capacity()
RETURNS TABLE (claimed_count INTEGER, claimed_numbers SMALLINT[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::INTEGER,
    COALESCE(array_agg(member_number ORDER BY member_number), ARRAY[]::SMALLINT[])
  FROM public.founding_members;
$$;

CREATE OR REPLACE FUNCTION public.get_founding_identities_for_handles(requested_handles TEXT[])
RETURNS TABLE (handle TEXT, member_number SMALLINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pp.handle, fm.member_number
  FROM public.founding_members fm
  JOIN public.public_profiles pp ON pp.user_id = fm.user_id
  WHERE fm.active = TRUE
    AND pp.handle = ANY(COALESCE(requested_handles, ARRAY[]::TEXT[]))
  ORDER BY fm.member_number
  LIMIT 100;
$$;

-- Atomic invitation claim. auth.uid() is the only possible claimant identity.
-- The advisory transaction lock serializes all capacity allocations, including
-- two people racing for position 25.
CREATE OR REPLACE FUNCTION public.claim_founding_invite(p_code_hash TEXT)
RETURNS TABLE (status TEXT, member_number SMALLINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  invite_row public.founding_invites%ROWTYPE;
  next_number SMALLINT;
  inviter_id UUID;
BEGIN
  IF actor_id IS NULL THEN
    RETURN QUERY SELECT 'unauthenticated'::TEXT, NULL::SMALLINT;
    RETURN;
  END IF;

  IF p_code_hash IS NULL OR p_code_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN QUERY SELECT 'invalid'::TEXT, NULL::SMALLINT;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('hikari-founding-25-capacity'));

  SELECT * INTO invite_row
  FROM public.founding_invites
  WHERE code_hash = p_code_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::TEXT, NULL::SMALLINT;
    RETURN;
  END IF;
  IF invite_row.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT 'revoked'::TEXT, NULL::SMALLINT;
    RETURN;
  END IF;
  IF invite_row.claimed_at IS NOT NULL THEN
    RETURN QUERY SELECT 'already_used'::TEXT, NULL::SMALLINT;
    RETURN;
  END IF;
  IF invite_row.expires_at <= NOW() THEN
    RETURN QUERY SELECT 'expired'::TEXT, NULL::SMALLINT;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.founding_members fm WHERE fm.user_id = actor_id) THEN
    RETURN QUERY SELECT 'duplicate_member'::TEXT, NULL::SMALLINT;
    RETURN;
  END IF;
  IF (SELECT COUNT(*) FROM public.founding_members) >= 25 THEN
    RETURN QUERY SELECT 'full'::TEXT, NULL::SMALLINT;
    RETURN;
  END IF;

  SELECT (COALESCE(MAX(fm.member_number), 0) + 1)::SMALLINT INTO next_number
  FROM public.founding_members fm;

  IF next_number > 25 THEN
    RETURN QUERY SELECT 'full'::TEXT, NULL::SMALLINT;
    RETURN;
  END IF;

  SELECT fm.user_id INTO inviter_id
  FROM public.founding_members fm
  WHERE fm.user_id = invite_row.created_by
    AND fm.active = TRUE;

  INSERT INTO public.founding_members (user_id, member_number, invited_by)
  VALUES (actor_id, next_number, inviter_id);

  UPDATE public.founding_invites
  SET claimed_by = actor_id, claimed_at = NOW()
  WHERE id = invite_row.id
    AND claimed_at IS NULL
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'founding_invite_claim_race';
  END IF;

  RETURN QUERY SELECT 'claimed'::TEXT, next_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_founding_member(p_handle TEXT)
RETURNS TABLE (status TEXT, member_number SMALLINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id UUID;
  next_number SMALLINT;
BEGIN
  IF NOT public.is_moderator() THEN
    RETURN QUERY SELECT 'forbidden'::TEXT, NULL::SMALLINT;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('hikari-founding-25-capacity'));

  SELECT pp.user_id INTO target_id
  FROM public.public_profiles pp
  WHERE pp.handle = lower(regexp_replace(COALESCE(p_handle, ''), '[^a-zA-Z0-9_]', '', 'g'))
  LIMIT 1;

  IF target_id IS NULL THEN
    RETURN QUERY SELECT 'user_not_found'::TEXT, NULL::SMALLINT;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.founding_members fm WHERE fm.user_id = target_id) THEN
    RETURN QUERY SELECT 'duplicate_member'::TEXT, NULL::SMALLINT;
    RETURN;
  END IF;
  IF (SELECT COUNT(*) FROM public.founding_members) >= 25 THEN
    RETURN QUERY SELECT 'full'::TEXT, NULL::SMALLINT;
    RETURN;
  END IF;

  SELECT (COALESCE(MAX(fm.member_number), 0) + 1)::SMALLINT INTO next_number
  FROM public.founding_members fm;

  IF next_number > 25 THEN
    RETURN QUERY SELECT 'full'::TEXT, NULL::SMALLINT;
    RETURN;
  END IF;

  INSERT INTO public.founding_members (user_id, member_number)
  VALUES (target_id, next_number);

  RETURN QUERY SELECT 'granted'::TEXT, next_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_founding_invite(p_code_hash TEXT, p_expires_at TIMESTAMPTZ)
RETURNS TABLE (status TEXT, invite_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  created_id UUID;
  actor_is_mod BOOLEAN := public.is_moderator();
BEGIN
  IF actor_id IS NULL THEN
    RETURN QUERY SELECT 'unauthenticated'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  IF p_code_hash IS NULL OR p_code_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN QUERY SELECT 'invalid_code'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  IF p_expires_at <= NOW() OR p_expires_at > NOW() + INTERVAL '90 days' THEN
    RETURN QUERY SELECT 'invalid_expiry'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('hikari-founding-25-capacity'));

  IF (SELECT COUNT(*) FROM public.founding_members) >= 25 THEN
    RETURN QUERY SELECT 'full'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  IF NOT actor_is_mod AND NOT public.is_active_founding_member(actor_id) THEN
    RETURN QUERY SELECT 'forbidden'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  IF NOT actor_is_mod AND (
    SELECT COUNT(*) FROM public.founding_invites fi WHERE fi.created_by = actor_id
  ) >= 2 THEN
    RETURN QUERY SELECT 'referral_limit'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  INSERT INTO public.founding_invites (code_hash, created_by, expires_at)
  VALUES (p_code_hash, actor_id, p_expires_at)
  RETURNING id INTO created_id;

  RETURN QUERY SELECT 'created'::TEXT, created_id, p_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_founding_invite(p_invite_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  invite_row public.founding_invites%ROWTYPE;
BEGIN
  SELECT * INTO invite_row
  FROM public.founding_invites
  WHERE id = p_invite_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF actor_id IS NULL OR (invite_row.created_by <> actor_id AND NOT public.is_moderator()) THEN RETURN 'forbidden'; END IF;
  IF invite_row.claimed_at IS NOT NULL THEN RETURN 'already_claimed'; END IF;
  IF invite_row.revoked_at IS NOT NULL THEN RETURN 'already_revoked'; END IF;

  UPDATE public.founding_invites SET revoked_at = NOW() WHERE id = p_invite_id;
  RETURN 'revoked';
END;
$$;

CREATE OR REPLACE FUNCTION public.set_founding_listing(p_show BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.founding_members
  SET show_on_founders_page = COALESCE(p_show, FALSE)
  WHERE user_id = auth.uid() AND active = TRUE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  RETURN 'updated';
END;
$$;

CREATE OR REPLACE FUNCTION public.cast_founding_vote(p_proposal_id UUID, p_support BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_founding_member() THEN RETURN 'forbidden'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.founding_feature_proposals p
    WHERE p.id = p_proposal_id AND p.status = 'active'
  ) THEN RETURN 'proposal_unavailable'; END IF;

  INSERT INTO public.founding_feature_votes (proposal_id, user_id, support)
  VALUES (p_proposal_id, auth.uid(), COALESCE(p_support, FALSE))
  ON CONFLICT (proposal_id, user_id)
  DO UPDATE SET support = EXCLUDED.support, updated_at = NOW();
  RETURN 'voted';
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_founding_vote(p_proposal_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_founding_member() THEN RETURN 'forbidden'; END IF;
  DELETE FROM public.founding_feature_votes
  WHERE proposal_id = p_proposal_id AND user_id = auth.uid();
  RETURN CASE WHEN FOUND THEN 'removed' ELSE 'not_found' END;
END;
$$;

-- Reviews need a safe public handle to render founding identity without
-- exposing or querying by UUID in the browser.
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS user_handle TEXT;
UPDATE public.reviews r
SET user_handle = pp.handle
FROM public.public_profiles pp
WHERE r.user_id = pp.user_id AND r.user_handle IS NULL;

REVOKE ALL ON public.founding_members FROM anon, authenticated;
REVOKE ALL ON public.founding_invites FROM anon, authenticated;
REVOKE ALL ON public.founding_feature_proposals FROM anon, authenticated;
REVOKE ALL ON public.founding_feature_votes FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.claim_founding_invite(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_founding_member(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_founding_invite(TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_founding_invite(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_founding_listing(BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cast_founding_vote(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_founding_vote(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_active_founding_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_founding_public_roster() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_founding_public_capacity() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_founding_identities_for_handles(TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_founding_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_founding_member(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_founding_invite(TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_founding_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_founding_listing(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cast_founding_vote(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_founding_vote(UUID) TO authenticated;
