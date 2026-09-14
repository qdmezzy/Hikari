-- Apply to staging first. Does not remove records or grant non-moderator access.
BEGIN;

CREATE TABLE IF NOT EXISTS public.moderation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.social_reports(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  previous_status text NOT NULL,
  next_status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.moderation_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moderation_decisions FROM anon, authenticated;
GRANT SELECT ON public.moderation_decisions TO authenticated;
DROP POLICY IF EXISTS "Moderators read decision history" ON public.moderation_decisions;
CREATE POLICY "Moderators read decision history" ON public.moderation_decisions
  FOR SELECT TO authenticated USING (public.is_moderator());

CREATE OR REPLACE FUNCTION public.decide_social_report(
  report_id uuid,
  decision text,
  expected_status text,
  expected_resolved_at timestamptz DEFAULT NULL,
  decision_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  item public.social_reports%ROWTYPE;
  target_table text;
  content_id text;
  next_status text;
  affected integer;
  actor uuid := auth.uid();
  decision_time timestamptz := clock_timestamp();
BEGIN
  IF actor IS NULL OR NOT COALESCE(public.is_moderator(), false) THEN
    RAISE EXCEPTION 'Moderator access required' USING ERRCODE = '42501';
  END IF;
  IF decision NOT IN ('dismiss', 'resolve', 'escalate', 'remove', 'spoiler') OR decision IS NULL THEN
    RAISE EXCEPTION 'Unsupported decision' USING ERRCODE = '22023';
  END IF;
  IF length(COALESCE(decision_note, '')) > 2000 THEN
    RAISE EXCEPTION 'Decision note is too long' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO item FROM public.social_reports WHERE id = report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002'; END IF;
  IF item.status IS DISTINCT FROM expected_status OR item.resolved_at IS DISTINCT FROM expected_resolved_at THEN
    RAISE EXCEPTION 'This report changed. Refresh before deciding.' USING ERRCODE = '40001';
  END IF;
  IF item.status NOT IN ('pending', 'escalated') OR (item.status = 'escalated' AND decision = 'escalate') THEN
    RAISE EXCEPTION 'This report is no longer awaiting that decision.' USING ERRCODE = '40001';
  END IF;
  content_id := COALESCE(item.target_id, item.post_id::text);
  target_table := CASE COALESCE(item.target_type, 'social_post')
    WHEN 'social_post' THEN 'social_posts' WHEN 'review' THEN 'reviews'
    WHEN 'clip_comment' THEN 'clip_comments' WHEN 'clip' THEN 'fandom_clips' ELSE NULL END;
  IF decision = 'remove' THEN
    IF target_table IS NULL OR content_id IS NULL THEN
      RAISE EXCEPTION 'This report has no removable target' USING ERRCODE = '22023';
    END IF;
    EXECUTE format('UPDATE public.%I SET is_removed = true, removed_at = $1, removed_by = $2, removed_reason = $3 WHERE id::text = $4', target_table)
      USING decision_time, actor, COALESCE(NULLIF(btrim(decision_note), ''), item.reason), content_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'Content no longer exists. Refresh before deciding.' USING ERRCODE = '40001'; END IF;
  ELSIF decision = 'spoiler' THEN
    IF target_table IS DISTINCT FROM 'social_posts' OR content_id IS NULL THEN
      RAISE EXCEPTION 'Only social posts support spoiler flags' USING ERRCODE = '22023';
    END IF;
    UPDATE public.social_posts SET has_spoilers = true WHERE id::text = content_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'Post no longer exists' USING ERRCODE = '40001'; END IF;
  END IF;
  next_status := CASE decision WHEN 'dismiss' THEN 'dismissed' WHEN 'escalate' THEN 'escalated' ELSE 'resolved' END;
  UPDATE public.social_reports SET status = next_status, resolved_at = decision_time,
    resolved_by = actor, resolution_action = decision, resolution_note = NULLIF(btrim(decision_note), '')
    WHERE id = item.id;
  INSERT INTO public.moderation_decisions(report_id, actor_id, action, previous_status, next_status, note)
    VALUES (item.id, actor, decision, item.status, next_status, NULLIF(btrim(decision_note), ''));
  RETURN jsonb_build_object('id', item.id, 'status', next_status, 'resolved_at', decision_time);
END;
$$;
REVOKE ALL ON FUNCTION public.decide_social_report(uuid,text,text,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_social_report(uuid,text,text,timestamptz,text) TO authenticated;
COMMIT;
