-- Requires collection tools and notifications. Apply to staging first.
BEGIN;
CREATE TABLE public.collection_follows (
  collection_id uuid NOT NULL REFERENCES public.custom_lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(collection_id,user_id)
);
ALTER TABLE public.collection_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_collection_follows ON public.collection_follows FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY remove_own_collection_follow ON public.collection_follows FOR DELETE TO authenticated USING(user_id=auth.uid());
GRANT SELECT,DELETE ON public.collection_follows TO authenticated;

CREATE TABLE public.collection_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.custom_lists(id) ON DELETE CASCADE,
  note text NOT NULL CHECK(length(note) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.collection_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY visible_collection_publications ON public.collection_publications FOR SELECT USING(EXISTS(
 SELECT 1 FROM public.custom_lists c WHERE c.id=collection_id AND (c.is_public OR c.user_id=auth.uid())
));
GRANT SELECT ON public.collection_publications TO anon,authenticated;

CREATE FUNCTION public.follow_collection(target_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.custom_lists WHERE id=target_id AND is_public AND user_id<>auth.uid() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Public collection unavailable' USING ERRCODE='42501'; END IF;
 INSERT INTO public.collection_follows(collection_id,user_id) VALUES(target_id,auth.uid()) ON CONFLICT DO NOTHING;
END; $$;

CREATE FUNCTION public.publish_collection_update(target_id uuid,update_note text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.custom_lists%ROWTYPE; publication_id uuid;
BEGIN
 SELECT * INTO c FROM public.custom_lists WHERE id=target_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR NOT c.is_public THEN RAISE EXCEPTION 'Only the owner of a public collection can publish' USING ERRCODE='42501'; END IF;
 IF update_note IS NULL OR length(btrim(update_note)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Write a note between 1 and 500 characters'; END IF;
 IF EXISTS(SELECT 1 FROM public.collection_publications WHERE collection_id=target_id AND created_at>now()-interval '1 hour') THEN
   RAISE EXCEPTION 'Please wait an hour between published updates';
 END IF;
 INSERT INTO public.collection_publications(collection_id,note) VALUES(target_id,btrim(update_note)) RETURNING id INTO publication_id;
 -- Keep notifications generic: making the collection private later must not leak its contents.
 INSERT INTO public.notifications(user_id,actor_id,type,title,message,href,metadata,dedupe_key)
 SELECT f.user_id,auth.uid(),'collection_update','A collection you follow has an update',
   'Open the collection to read the curator’s note.','/lists/'||target_id,
   jsonb_build_object('collection_id',target_id),'collection:'||publication_id
 FROM public.collection_follows f WHERE f.collection_id=target_id;
 RETURN publication_id;
END; $$;
REVOKE ALL ON FUNCTION public.follow_collection(uuid),public.publish_collection_update(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.follow_collection(uuid),public.publish_collection_update(uuid,text) TO authenticated;
COMMIT;
