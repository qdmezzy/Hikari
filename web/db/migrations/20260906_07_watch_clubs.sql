BEGIN;
CREATE TABLE public.watch_clubs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 media_id bigint NOT NULL CHECK(media_id>0),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Start with one curated club, not an empty directory of competing rooms.
CREATE UNIQUE INDEX one_active_watch_club ON public.watch_clubs(is_active) WHERE is_active;
CREATE TABLE public.watch_club_episodes (
 club_id uuid NOT NULL REFERENCES public.watch_clubs(id) ON DELETE CASCADE,
 episode integer NOT NULL CHECK(episode BETWEEN 1 AND 1000),
 post_id uuid NOT NULL UNIQUE REFERENCES public.social_posts(id) ON DELETE CASCADE,
 PRIMARY KEY(club_id,episode)
);
CREATE TABLE public.watch_club_members (
 club_id uuid NOT NULL REFERENCES public.watch_clubs(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 PRIMARY KEY(club_id,user_id)
);
ALTER TABLE public.watch_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_club_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_club_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_watch_clubs ON public.watch_clubs FOR SELECT USING(true);
CREATE POLICY read_club_episode_links ON public.watch_club_episodes FOR SELECT USING(true);
CREATE POLICY manage_own_membership ON public.watch_club_members FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.watch_clubs WHERE id=club_id AND is_active));
GRANT SELECT ON public.watch_clubs,public.watch_club_episodes TO anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.watch_club_members TO authenticated;

CREATE FUNCTION public.open_watch_club(club_name text,title_id bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result uuid;
BEGIN
 IF NOT coalesce(public.is_moderator(),false) OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Moderator access required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.watch_clubs(name,media_id) VALUES(btrim(club_name),title_id) RETURNING id INTO result;
 RETURN result;
END; $$;
CREATE FUNCTION public.open_club_episode(target_club uuid,episode_number integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.watch_clubs%ROWTYPE; result uuid;
BEGIN
 IF NOT coalesce(public.is_moderator(),false) OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Moderator access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.watch_clubs WHERE id=target_club AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Club unavailable'; END IF;
 IF episode_number IS NULL OR episode_number NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid episode'; END IF;
 SELECT post_id INTO result FROM public.watch_club_episodes WHERE club_id=target_club AND episode=episode_number;
 IF FOUND THEN RETURN result; END IF;
 INSERT INTO public.social_posts(user_id,content,attached_media_id,attached_media_title,attached_media_type,has_spoilers,spoiler_range,post_type,post_to_discover)
 VALUES(auth.uid(),c.name||' — Episode '||episode_number||E'\nDiscuss only events through this episode. No later-episode or source-material spoilers.',c.media_id,c.name,'ANIME',true,'Through episode '||episode_number,'text',false) RETURNING id INTO result;
 INSERT INTO public.watch_club_episodes(club_id,episode,post_id) VALUES(target_club,episode_number,result);
 RETURN result;
END; $$;
CREATE FUNCTION public.close_watch_club(target_club uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT coalesce(public.is_moderator(),false) OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Moderator access required' USING ERRCODE='42501'; END IF;
 UPDATE public.watch_clubs SET is_active=false WHERE id=target_club;
END; $$;
REVOKE ALL ON FUNCTION public.open_watch_club(text,bigint),public.open_club_episode(uuid,integer),public.close_watch_club(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.open_watch_club(text,bigint),public.open_club_episode(uuid,integer),public.close_watch_club(uuid) TO authenticated;
COMMIT;
