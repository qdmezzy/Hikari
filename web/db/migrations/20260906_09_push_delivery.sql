BEGIN;
-- Durable per-device jobs. No browser endpoint or subscription keys are copied here.
CREATE TABLE public.push_delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id integer NOT NULL CHECK (media_id > 0),
  episode integer NOT NULL CHECK (episode > 0),
  endpoint_hash text NOT NULL CHECK (endpoint_hash ~ '^[a-f0-9]{64}$'),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  airing_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','sent','cancelled','dead')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  accepted_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, media_id, episode, endpoint_hash)
);
ALTER TABLE public.push_delivery_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_delivery_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_delivery_jobs TO service_role;
CREATE INDEX push_delivery_pending_idx ON public.push_delivery_jobs(next_attempt_at)
  WHERE state IN ('pending','processing');

CREATE FUNCTION public.enqueue_episode_push(p_media_id integer, p_episode integer, p_title text, p_airing_at timestamptz)
RETURNS integer LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE inserted integer;
BEGIN
  IF p_airing_at < now() - interval '24 hours' OR p_airing_at > now() + interval '40 minutes' THEN RETURN 0; END IF;
  INSERT INTO public.push_delivery_jobs(user_id,media_id,episode,endpoint_hash,title,airing_at)
  SELECT a.user_id,a.media_id,p_episode,encode(sha256(convert_to(s.endpoint,'UTF8')),'hex'),left(p_title,500),p_airing_at
  FROM public.episode_alerts a JOIN public.push_subscriptions s ON s.user_id=a.user_id
  WHERE a.media_id=p_media_id AND a.last_notified_episode < p_episode
  ON CONFLICT (user_id,media_id,episode,endpoint_hash) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

-- One short lease at a time; overlapping workers skip already-claimed jobs.
CREATE FUNCTION public.claim_episode_push()
RETURNS SETOF public.push_delivery_jobs LANGUAGE sql SET search_path = public, pg_temp AS $$
  WITH candidate AS (
    SELECT id FROM public.push_delivery_jobs
    WHERE (state='pending' AND next_attempt_at<=now())
       OR (state='processing' AND lease_until<now())
    ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1
  )
  UPDATE public.push_delivery_jobs j
  SET state='processing',attempts=j.attempts+1,lease_until=now()+interval '90 seconds',lease_token=gen_random_uuid()
  FROM candidate c WHERE j.id=c.id RETURNING j.*;
$$;

-- A timed-out worker cannot overwrite a newer worker's receipt.
CREATE FUNCTION public.finish_episode_push(p_id uuid,p_token uuid,p_state text,p_code text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE changed integer;
BEGIN
  IF p_state NOT IN ('pending','sent','cancelled','dead') THEN RAISE EXCEPTION 'Invalid delivery state'; END IF;
  UPDATE public.push_delivery_jobs SET
    state=CASE WHEN p_state='pending' AND (attempts>=6 OR airing_at<now()-interval '24 hours') THEN 'dead' ELSE p_state END,
    next_attempt_at=now()+make_interval(secs => least(21600, 300 * power(2,least(attempts,6)-1))::integer),
    accepted_at=CASE WHEN p_state='sent' THEN now() ELSE accepted_at END,
    last_error_code=left(p_code,40),lease_until=NULL,lease_token=NULL
  WHERE id=p_id AND lease_token=p_token AND state='processing' AND lease_until>now();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed=1;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_episode_push(integer,integer,text,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_episode_push() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_episode_push(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_episode_push(integer,integer,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_episode_push() TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_episode_push(uuid,uuid,text,text) TO service_role;
COMMIT;
