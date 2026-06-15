CREATE TABLE IF NOT EXISTS public.discord_links (
    discord_user_id TEXT PRIMARY KEY,
    hikari_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    hikari_username TEXT,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_links_hikari_username
ON public.discord_links (lower(hikari_username));

CREATE OR REPLACE FUNCTION update_discord_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discord_links_updated_at ON public.discord_links;
CREATE TRIGGER trg_discord_links_updated_at
    BEFORE UPDATE ON public.discord_links
    FOR EACH ROW
    EXECUTE FUNCTION update_discord_links_updated_at();

-- Optional columns for a future secure one-time link-token flow
-- (web /discord/link verifies the token instead of trusting a Discord ID in the URL).
ALTER TABLE public.discord_links ADD COLUMN IF NOT EXISTS link_token TEXT;
ALTER TABLE public.discord_links ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_discord_links_token ON public.discord_links(link_token);
