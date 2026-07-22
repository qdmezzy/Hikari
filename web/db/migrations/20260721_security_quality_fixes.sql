-- Hikari security/profile migration. Safe to re-run in the Supabase SQL editor.

ALTER TABLE public.discord_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS public_profile BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS show_stats BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.public_profiles p
SET
  public_profile = CASE WHEN lower(COALESCE(u.raw_user_meta_data ->> 'public_profile', 'true')) = 'false' THEN FALSE ELSE TRUE END,
  show_stats = CASE WHEN lower(COALESCE(u.raw_user_meta_data ->> 'show_stats', 'true')) = 'false' THEN FALSE ELSE TRUE END
FROM auth.users u
WHERE p.user_id = u.id;

-- Older clients used the email address as a display-name fallback. Remove that
-- accidental exposure while preserving an explicitly chosen display name.
UPDATE public.public_profiles p
SET display_name = COALESCE(
  u.raw_user_meta_data ->> 'display_name',
  u.raw_user_meta_data ->> 'full_name',
  p.handle,
  'User'
)
FROM auth.users u
WHERE p.user_id = u.id
  AND lower(COALESCE(p.display_name, '')) = lower(COALESCE(u.email::TEXT, ''));

WITH profile_candidates AS (
  SELECT
    u.id AS user_id,
    lower(regexp_replace(COALESCE(u.raw_user_meta_data ->> 'username', u.raw_user_meta_data ->> 'handle', ''), '[^a-zA-Z0-9_]', '', 'g')) AS handle,
    COALESCE(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'username', 'User') AS display_name,
    u.raw_user_meta_data ->> 'avatar_url' AS avatar_url,
    u.raw_user_meta_data ->> 'banner_url' AS banner_url,
    u.created_at AS joined_at,
    CASE WHEN lower(COALESCE(u.raw_user_meta_data ->> 'public_profile', 'true')) = 'false' THEN FALSE ELSE TRUE END AS public_profile,
    CASE WHEN lower(COALESCE(u.raw_user_meta_data ->> 'show_stats', 'true')) = 'false' THEN FALSE ELSE TRUE END AS show_stats
  FROM auth.users u
)
INSERT INTO public.public_profiles (user_id, handle, display_name, avatar_url, banner_url, joined_at, public_profile, show_stats)
SELECT c.user_id, c.handle, c.display_name, c.avatar_url, c.banner_url, c.joined_at, c.public_profile, c.show_stats
FROM profile_candidates c
WHERE length(c.handle) BETWEEN 3 AND 30
  AND NOT EXISTS (
    SELECT 1 FROM public.public_profiles existing
    WHERE existing.handle = c.handle AND existing.user_id <> c.user_id
  )
ON CONFLICT (user_id) DO UPDATE SET
  display_name = COALESCE(public.public_profiles.display_name, EXCLUDED.display_name),
  joined_at = COALESCE(public.public_profiles.joined_at, EXCLUDED.joined_at),
  public_profile = EXCLUDED.public_profile,
  show_stats = EXCLUDED.show_stats;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.public_profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.public_profiles FOR SELECT TO anon, authenticated
USING (public_profile = TRUE OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view shared list entries" ON public.list_entries;
CREATE POLICY "Public can view shared list entries"
ON public.list_entries FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.public_profiles pp
    WHERE pp.user_id = list_entries.user_id
      AND pp.public_profile = TRUE
      AND pp.show_watch_activity = TRUE
  )
  AND list_entries.hide_from_profile = FALSE
);

CREATE OR REPLACE FUNCTION public.provision_public_profile_from_auth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE candidate_handle TEXT;
BEGIN
  candidate_handle := lower(regexp_replace(COALESCE(NEW.raw_user_meta_data ->> 'username', NEW.raw_user_meta_data ->> 'handle', ''), '[^a-zA-Z0-9_]', '', 'g'));
  IF length(candidate_handle) BETWEEN 3 AND 30 THEN
    INSERT INTO public.public_profiles (user_id, handle, display_name, avatar_url, banner_url, joined_at, public_profile, show_stats)
    VALUES (
      NEW.id,
      candidate_handle,
      COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', candidate_handle),
      NEW.raw_user_meta_data ->> 'avatar_url',
      NEW.raw_user_meta_data ->> 'banner_url',
      NEW.created_at,
      CASE WHEN lower(COALESCE(NEW.raw_user_meta_data ->> 'public_profile', 'true')) = 'false' THEN FALSE ELSE TRUE END,
      CASE WHEN lower(COALESCE(NEW.raw_user_meta_data ->> 'show_stats', 'true')) = 'false' THEN FALSE ELSE TRUE END
    )
    ON CONFLICT (user_id) DO UPDATE SET
      handle = EXCLUDED.handle,
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      banner_url = EXCLUDED.banner_url,
      public_profile = EXCLUDED.public_profile,
      show_stats = EXCLUDED.show_stats;
  END IF;
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provision_public_profile_after_auth_change ON auth.users;
CREATE TRIGGER provision_public_profile_after_auth_change
AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.provision_public_profile_from_auth();
