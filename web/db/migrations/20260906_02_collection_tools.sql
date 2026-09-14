-- Staging first. Atomic duplication and ordering; never modifies tracking entries.
BEGIN;
ALTER TABLE public.custom_list_items ADD COLUMN IF NOT EXISTS position integer;
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS cover_media_id integer;

CREATE OR REPLACE FUNCTION public.duplicate_own_collection(source_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE source public.custom_lists%ROWTYPE; new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  SELECT * INTO source FROM public.custom_lists WHERE id=source_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collection unavailable' USING ERRCODE='42501'; END IF;
  INSERT INTO public.custom_lists(user_id,name,description,is_public,cover_media_id)
    VALUES(auth.uid(),left(source.name,73)||' (copy)',source.description,false,source.cover_media_id) RETURNING id INTO new_id;
  INSERT INTO public.custom_list_items(list_id,media_id,media_type,position)
    SELECT new_id,media_id,media_type,position FROM public.custom_list_items WHERE list_id=source_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_own_collection(collection_id uuid, ordered_ids uuid[], expected_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actual_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.custom_lists WHERE id=collection_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collection unavailable' USING ERRCODE='42501'; END IF;
  SELECT array_agg(id ORDER BY position NULLS LAST,added_at DESC,id) INTO actual_ids FROM public.custom_list_items WHERE list_id=collection_id;
  IF actual_ids IS DISTINCT FROM expected_ids THEN RAISE EXCEPTION 'Collection changed. Refresh before reordering.' USING ERRCODE='40001'; END IF;
  IF cardinality(ordered_ids) IS DISTINCT FROM cardinality(actual_ids)
    OR (SELECT count(DISTINCT id) FROM unnest(ordered_ids) id) <> cardinality(actual_ids)
    OR NOT (ordered_ids @> actual_ids AND ordered_ids <@ actual_ids) THEN
    RAISE EXCEPTION 'Order must contain every current title exactly once' USING ERRCODE='22023';
  END IF;
  UPDATE public.custom_list_items item SET position=sequence.ordinality::integer
    FROM unnest(ordered_ids) WITH ORDINALITY sequence(id,ordinality)
    WHERE item.id=sequence.id AND item.list_id=collection_id;
  UPDATE public.custom_lists SET updated_at=now() WHERE id=collection_id;
END;
$$;
REVOKE ALL ON FUNCTION public.duplicate_own_collection(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.reorder_own_collection(uuid,uuid[],uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.duplicate_own_collection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_own_collection(uuid,uuid[],uuid[]) TO authenticated;
COMMIT;
