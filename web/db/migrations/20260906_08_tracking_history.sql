-- Starts recording from installation onward. Never backfill invented watch dates.
BEGIN;
CREATE TABLE public.tracking_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 media_id bigint NOT NULL,
 media_type text NOT NULL,
 action text NOT NULL CHECK(action IN ('added','updated','removed')),
 old_progress integer,
 new_progress integer,
 old_status text,
 new_status text,
 new_score numeric,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracking_history_user_date ON public.tracking_history(user_id,recorded_at,id);
ALTER TABLE public.tracking_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tracking_history FROM anon,authenticated;
GRANT SELECT ON public.tracking_history TO authenticated;
CREATE POLICY own_tracking_history ON public.tracking_history FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE FUNCTION public.record_tracking_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO public.tracking_history(user_id,media_id,media_type,action,new_progress,new_status,new_score)
  VALUES(NEW.user_id,NEW.media_id,NEW.media_type,'added',NEW.progress,NEW.status,NEW.score);
 ELSIF TG_OP='UPDATE' THEN
  IF NEW.progress IS DISTINCT FROM OLD.progress OR NEW.status IS DISTINCT FROM OLD.status OR NEW.score IS DISTINCT FROM OLD.score THEN
   INSERT INTO public.tracking_history(user_id,media_id,media_type,action,old_progress,new_progress,old_status,new_status,new_score)
   VALUES(NEW.user_id,NEW.media_id,NEW.media_type,'updated',OLD.progress,NEW.progress,OLD.status,NEW.status,NEW.score);
  END IF;
 ELSIF TG_OP='DELETE' THEN
  -- Account deletion may already be cascading; do not recreate its history.
  IF EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.user_id) THEN
   INSERT INTO public.tracking_history(user_id,media_id,media_type,action,old_progress,old_status)
   VALUES(OLD.user_id,OLD.media_id,OLD.media_type,'removed',OLD.progress,OLD.status);
  END IF;
 END IF;
 RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.record_tracking_history() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER record_tracking_history AFTER INSERT OR UPDATE OR DELETE ON public.list_entries
FOR EACH ROW EXECUTE FUNCTION public.record_tracking_history();
COMMIT;
