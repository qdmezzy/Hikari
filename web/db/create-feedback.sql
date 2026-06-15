-- Beta feedback / bug reports submitted from /feedback.

CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    message TEXT NOT NULL,
    page_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Anyone (signed in or not) may submit feedback.
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback"
ON public.feedback
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- No SELECT/UPDATE/DELETE policy: feedback is readable only via the service role
-- (e.g. the Supabase dashboard or an admin tool), never the public client.

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
