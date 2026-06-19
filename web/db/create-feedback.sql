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

-- Optional triage flag mods can toggle.
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE;

-- Moderators can read feedback (shown in the Mod dashboard). Regular users can
-- still only insert — they never read others' submissions.
DROP POLICY IF EXISTS "Mods can read feedback" ON public.feedback;
CREATE POLICY "Mods can read feedback"
ON public.feedback
FOR SELECT
TO authenticated
USING (
  COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_mod')::boolean, false)
  OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'isMod')::boolean, false)
);

-- Mods can mark feedback resolved.
DROP POLICY IF EXISTS "Mods can update feedback" ON public.feedback;
CREATE POLICY "Mods can update feedback"
ON public.feedback
FOR UPDATE
TO authenticated
USING (
  COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_mod')::boolean, false)
  OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'isMod')::boolean, false)
)
WITH CHECK (
  COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_mod')::boolean, false)
  OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'isMod')::boolean, false)
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
