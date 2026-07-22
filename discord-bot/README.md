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
- Optional support server link: `DISCORD_SUPPORT_URL`
- Founding 25 role: `DISCORD_FOUNDING_ROLE_ID` (used with `DISCORD_GUILD_ID`)

3. Create link table in Supabase SQL editor:

Run:

- `sql/create-discord-links.sql`

4. Start bot:

```bash
npm run dev
```

## Linking flow

`/link` sends a button to:

`{HIKARI_WEB_BASE_URL}{HIKARI_LINK_PATH}?token=<short-lived-signed-token>`

The website verifies the signed Discord identity, independently verifies the
Supabase session, and refuses to replace either side of an existing link.

## Founding 25 role and private channel

1. Create a server role named **Founding 25**.
2. Move Hikari's bot role above it in the Discord role list.
3. Put the role id in `DISCORD_FOUNDING_ROLE_ID` and the Hikari server id in
   `DISCORD_GUILD_ID`, then restart the bot.
4. Run `/admin founding-sync` as a linked Hikari moderator to reconcile roles
   for existing linked founders.
5. Create the private channel manually. Deny `View Channel` for `@everyone`,
   allow `View Channel`, `Send Messages`, and `Read Message History` for the
   **Founding 25** role, and keep moderator access.

The role is never granted from a browser-supplied Discord id. It is based on
the secured `discord_links` ownership record plus an active database membership.

## Notes

- If `DISCORD_GUILD_ID` is set, commands are registered to that guild (fast updates).
- Without `DISCORD_GUILD_ID`, commands are global (can take time to appear).
