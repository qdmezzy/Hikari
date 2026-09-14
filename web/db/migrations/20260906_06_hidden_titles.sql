BEGIN;
CREATE TABLE public.discover_hidden_titles (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 media_id bigint NOT NULL CHECK(media_id>0),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 300),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,media_id)
);
ALTER TABLE public.discover_hidden_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_discover_hiding ON public.discover_hidden_titles FOR ALL TO authenticated
 USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.discover_hidden_titles TO authenticated;
COMMIT;
