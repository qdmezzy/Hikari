# Hikari Discord Bot (No Social)

Standalone Discord bot workspace for Hikari.

This folder is intentionally separate from `web/` so bot code does not mix with app code.

## Features

- Account: `/help`, `/link`, `/unlink`, `/profile`
- Tracking: `/watching`, `/add`, `/status`, `/progress`, `/plusone`, `/undo`, `/remove`
- Discover: `/recommend`, `/random`, `/compare`, `/clip`
- Sharing: `/share profile|list|anime`
- Watch parties: `/watchparty create|join|poll|remind|end`
- Stats: `/leaderboard episodes|streak`, `/serverstats`

No social feed posting or comments.

## Setup

1. Install dependencies:

```bash
cd discord-bot
npm install
```

2. Copy env template and fill values:

```bash
cp .env.example .env
```

Required:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Optional dev scope: `DISCORD_GUILD_ID`

3. Create link table in Supabase SQL editor:

Run:

- `sql/create-discord-links.sql`

4. Start bot:

```bash
npm run dev
```

## Linking flow

`/link` sends a button to:

`{HIKARI_WEB_BASE_URL}{HIKARI_LINK_PATH}?discord_id=<id>&discord_name=<name>`

Your web app should complete OAuth/session auth and upsert `public.discord_links`.

## Notes

- If `DISCORD_GUILD_ID` is set, commands are registered to that guild (fast updates).
- Without `DISCORD_GUILD_ID`, commands are global (can take time to appear).
