-- Per-server (guild) configuration for the Hikari Discord bot.
-- Stores where the bot may broadcast and which role may change its settings.

CREATE TABLE IF NOT EXISTS public.discord_guilds (
    guild_id TEXT PRIMARY KEY,
    guild_name TEXT,
    alert_channel_id TEXT,          -- channel for airing-anime broadcasts
    admin_role_id TEXT,             -- role allowed to change bot settings
    report_webhook_url TEXT,        -- staff channel webhook for web report payloads
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.discord_guilds ADD COLUMN IF NOT EXISTS guild_name TEXT;
ALTER TABLE public.discord_guilds ADD COLUMN IF NOT EXISTS alert_channel_id TEXT;
ALTER TABLE public.discord_guilds ADD COLUMN IF NOT EXISTS admin_role_id TEXT;
ALTER TABLE public.discord_guilds ADD COLUMN IF NOT EXISTS report_webhook_url TEXT;
ALTER TABLE public.discord_guilds ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE public.discord_guilds ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.discord_guilds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- The bot connects with the service role key, so RLS is not required for it.
-- Enable RLS + deny-by-default so the table is never exposed to the anon/web client.
ALTER TABLE public.discord_guilds ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_discord_guilds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discord_guilds_updated_at ON public.discord_guilds;
CREATE TRIGGER trg_discord_guilds_updated_at
    BEFORE UPDATE ON public.discord_guilds
    FOR EACH ROW
    EXECUTE FUNCTION update_discord_guilds_updated_at();
