BEGIN;
-- Stop authenticated senders impersonating another account in new feedback.
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback" ON public.feedback FOR INSERT TO anon,authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
DROP POLICY IF EXISTS "Authors read own feedback" ON public.feedback;
CREATE POLICY "Authors read own feedback" ON public.feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid());
COMMIT;
