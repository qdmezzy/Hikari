BEGIN;
ALTER TABLE public.public_profiles ADD COLUMN IF NOT EXISTS allow_taste_comparison boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.compare_public_favorites(target_handle text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE mine public.public_profiles%ROWTYPE; theirs public.public_profiles%ROWTYPE; overlap bigint[]; total integer;
BEGIN
 SELECT * INTO mine FROM public.public_profiles WHERE user_id=auth.uid() AND public_profile AND show_favorites AND allow_taste_comparison;
 IF NOT FOUND THEN RAISE EXCEPTION 'Your public profile, favorites and comparison opt-in must be enabled' USING ERRCODE='42501'; END IF;
 SELECT * INTO theirs FROM public.public_profiles WHERE handle=lower(btrim(target_handle,' @')) AND public_profile AND show_favorites AND allow_taste_comparison AND user_id<>auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Comparison unavailable for this profile' USING ERRCODE='42501'; END IF;
 SELECT coalesce(array_agg(id ORDER BY id),'{}') INTO overlap FROM (
 SELECT unnest(mine.favorite_media_ids) id INTERSECT SELECT unnest(theirs.favorite_media_ids) id
 ) matches;
 SELECT count(*) INTO total FROM (SELECT unnest(mine.favorite_media_ids) UNION SELECT unnest(theirs.favorite_media_ids)) titles;
 RETURN jsonb_build_object('handle',theirs.handle,'display_name',theirs.display_name,'shared_ids',overlap,'union_count',total);
END; $$;
REVOKE ALL ON FUNCTION public.compare_public_favorites(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.compare_public_favorites(text) TO authenticated;
COMMIT;
