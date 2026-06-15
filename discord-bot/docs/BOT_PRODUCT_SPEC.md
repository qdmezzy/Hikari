# Hikari Discord Bot - Full Product and Behavior Spec

This document explains exactly what the current bot does so a designer can redesign response layouts and visuals without changing behavior.

## 1) Product Purpose

The bot is a Discord utility layer for Hikari users.

It lets people:

1. Link Discord accounts to Hikari accounts.
2. Look up Hikari profiles from Discord.
3. Track anime list progress directly from Discord.
4. Discover anime with lightweight recommendation tools.
5. Share Hikari profile/list/anime cards to channels.
6. Run simple watch-party coordination in a server.
7. View high-level leaderboard and usage stats.

## 2) Explicit Non-Goals

The bot does not implement:

1. Social feed posting.
2. Comments/replies/social threads.
3. Reposts.
4. Any "Twitter-like" social timeline behavior.

## 3) Runtime Architecture

## 3.1 Core stack

1. Runtime: Node.js
2. Discord SDK: `discord.js` (slash commands + button/select components)
3. Database/API backend: Supabase
4. Anime metadata source: AniList GraphQL API

## 3.2 Command registration model

1. If `DISCORD_GUILD_ID` is set, commands are registered as guild commands (fast updates).
2. Otherwise, commands are registered globally (slower Discord propagation).

## 3.3 Link URL generation

`/link` sends users to:

`{HIKARI_WEB_BASE_URL}{HIKARI_LINK_PATH}?discord_id=<id>&discord_name=<username>`

The web app must then authenticate user session and upsert mapping into `public.discord_links`.

## 3.4 Public vs private command responses

Current bot behavior sends public responses in channel by default.

`interaction` payloads strip `ephemeral` flags in `src/lib/interaction.js`.

## 4) Required Environment Variables

From `src/config.js`:

1. `DISCORD_BOT_TOKEN` (required)
2. `DISCORD_CLIENT_ID` (required)
3. `DISCORD_GUILD_ID` (optional)
4. `SUPABASE_URL` (required)
5. `SUPABASE_SERVICE_ROLE_KEY` (required)
6. `HIKARI_WEB_BASE_URL` (optional fallback: `http://localhost:3000`)
7. `HIKARI_LINK_PATH` (optional fallback: `/discord/link`)

## 5) Database Dependencies

## 5.1 `public.discord_links`

Schema is defined in `sql/create-discord-links.sql`.

Fields:

1. `discord_user_id` (PK text)
2. `hikari_user_id` (uuid unique -> `auth.users.id`)
3. `hikari_username` (text cache)
4. `linked_at` (timestamp)
5. `updated_at` (timestamp)

## 5.2 `public.list_entries`

Bot currently expects (at minimum):

1. `id`
2. `user_id`
3. `media_id`
4. `media_type`
5. `status`
6. `progress`
7. `updated_at`

`created_at` is optional in bot command flow now.

## 5.3 `public.public_profiles`

Used for profile lookups and display info.

Commonly used fields:

1. `user_id`
2. `handle`
3. `display_name`
4. `avatar_url`

## 6) Response System and Visual Pattern

## 6.1 Shared embed styles

Defined in `src/lib/embeds.js`.

Color tokens:

1. `brand`
2. `info`
3. `success`
4. `warning`
5. `error`

Shared pattern:

1. Consistent footer text (`Hikari Bot`)
2. Timestamp on most embeds
3. Reusable builders for info/success/error messages

## 6.2 Global error behavior

Unhandled command exceptions in `src/index.js` return a generic error embed.

## 7) Command System Overview

Command modules:

1. Account (`src/commands/account.js`)
2. Tracking (`src/commands/tracking.js`)
3. Discover (`src/commands/discover.js`)
4. Share (`src/commands/share.js`)
5. Watch Party (`src/commands/watchparty.js`)
6. Stats (`src/commands/stats.js`)

Component handlers:

1. Help panel select/back (`src/ui/helpMenu.js`)
2. Watch party poll voting buttons (`src/commands/watchparty.js`)

## 8) Detailed Command Behaviors

## 8.1 Account Commands

### `/help`

1. Sends interactive help home embed with category selector.
2. Category select updates same message with category-specific command list.
3. Back button returns to home.
4. Help panel is owner-locked by user ID.
5. If another user clicks owner-locked panel, they get a "belongs to someone else" response.

### `/link`

1. Sends embed explaining secure linking.
2. Includes one Link button: `Link Hikari`.
3. URL includes `discord_id` and `discord_name` query params.

### `/unlink`

1. Deletes `discord_links` row for the caller.
2. If no row exists, returns "Nothing to Unlink" error state.
3. On success, returns "Account Unlinked" success state.

### `/profile`

Options:

1. No args: resolve caller by `discord_links`.
2. `username`: lookup by Hikari handle.
3. `user` mention: resolve mentioned Discord user via `discord_links`.

Output:

1. Profile embed with now watching line.
2. List summary counts by status.
3. Top genres when available.
4. Buttons: `Open Profile`, `Open Lists`.

Fallback behavior:

1. If self is unlinked and no username supplied: prompt to use `/link` or `/profile <username>`.
2. If mention target is unlinked: explicit error.
3. If username not found: explicit error.

## 8.2 Tracking Commands

All mutation commands require caller to be linked.

### `/watching [@user|username]`

1. Supports self, mention, or username target.
2. Shows top active entries (`watching` and `rewatching`).
3. Display format: numbered list with episode progress.

### `/add <anime>`

1. Searches anime by title.
2. If entry already exists for that user/media, returns error.
3. Inserts entry as:
   1. `media_type`: `ANIME`
   2. `status`: `plan_to_watch`
   3. `progress`: `0`
4. Stores undo action.
5. Returns success embed.

### `/status <anime> <state>`

1. Resolves anime.
2. Upserts entry with requested status.
3. Preserves existing progress.
4. Stores undo action.
5. Returns success embed.

Status choices:

1. `watching`
2. `completed`
3. `dropped`
4. `on_hold`
5. `planned` (normalized to `plan_to_watch`)
6. `rewatching`

### `/progress <anime> <number>`

1. Resolves anime.
2. Upserts episode progress.
3. Auto status rules:
   1. If progress >= total episodes, set `completed`.
   2. If status is `plan_to_watch` and progress > 0, set `watching`.
4. Stores undo action.
5. Returns success embed.

### `/plusone [anime]`

1. If anime provided: increments that entry.
2. If anime omitted: targets latest `watching`/`rewatching` entry.
3. Auto status rules same as `/progress`.
4. Stores undo action.
5. Returns success embed.

### `/remove <anime>`

1. Resolves anime and existing entry.
2. Deletes matching row by `id`.
3. Stores deleted row for undo restore.
4. Returns success embed.

### `/undo`

1. Reverts the caller's most recent tracking mutation only.
2. Undo state is stored in memory (`Map`), not database.
3. If process restarts, undo history is lost.

## 8.3 Discover Commands

### `/recommend [mood] [tags]`

Inputs:

1. Optional mood (`chill`, `hype`, `dark`, `funny`, `romance`)
2. Optional comma-separated tags

Logic:

1. Mood maps to preset genre list.
2. If no mood/tags, bot tries to infer genres from linked caller list history.
3. Queries AniList recommendations with `isAdult: false`.
4. Returns top list with scores and filter summary.

### `/random [tag]`

1. Fetches recommendation pool with optional tag filter.
2. Picks one random result.
3. Returns anime embed with metadata and cover art.

### `/compare @user`

1. Requires caller to be linked.
2. Requires target mention to be linked.
3. Loads list data for both users.
4. Computes compatibility:
   1. `compatibility = min(100, overlapGenres * 18 + sharedTitles * 6)`
5. Returns compatibility, shared genres, shared titles.

### `/clip <anime>`

1. Resolves anime.
2. Returns anime embed.
3. Adds buttons:
   1. Open on Hikari
   2. Trailer

## 8.4 Share Commands

### `/share profile [@user|username]`

1. Resolves target by mention/username/self.
2. Uses same profile stats pattern as `/profile`.
3. Returns profile embed + profile/list buttons.

### `/share list <watching|completed|planned> [@user|username]`

1. Resolves target.
2. Loads entries by requested status.
3. Returns list preview (top 10 lines) + `Open Full List` button.

### `/share anime <anime>`

1. Resolves anime.
2. Returns anime embed with metadata and cover.
3. Buttons:
   1. Open on Hikari
   2. Trailer
   3. Where to Watch (currently AniList/site URL fallback)

## 8.5 Watch Party Commands

Watch parties are in-memory and scoped per guild ID.

### `/watchparty create <anime> <time>`

1. Creates/overwrites active party for guild.
2. Host is command caller.
3. Participants set starts with host.
4. Returns party embed.

### `/watchparty join`

1. Adds caller to participants set.
2. Returns success embed.

### `/watchparty poll <anime1> <anime2> ...`

1. Requires active party.
2. Stores options (2-5).
3. Creates vote buttons labeled `Vote 1..Vote N`.

### Vote buttons

1. Button custom ID format: `hikari_watchparty:vote:<guildId>:<index>`
2. Saves one vote per user.
3. Returns vote confirmation + live tally.

### `/watchparty remind`

1. Mentions all participants.
2. Sends reminder embed with anime + time.

### `/watchparty end`

1. Allowed for host or users with `Manage Guild`.
2. Clears active party from memory.
3. Returns success embed.

## 8.6 Stats Commands

### `/leaderboard episodes [weekly|monthly]`

1. Default period: weekly.
2. Loads anime entries since cutoff date.
3. Aggregates by summing `progress` values per user.
4. Returns top 10.

Note:

This is total progress sum over period, not strict per-entry delta tracking.

### `/leaderboard streak`

1. Builds per-user set of active dates from `updated_at`.
2. Computes consecutive-day streak from today backward.
3. Returns top non-zero streaks.

### `/serverstats`

Returns:

1. Linked account count (`discord_links`)
2. Total tracked anime entries (`list_entries`)
3. Active watch party count (in-memory map size)

## 9) Target Resolution Rules

Shared resolution behavior (`src/services/targets.js`):

1. If username provided: lookup by `public_profiles.handle`.
2. Else if mention provided: lookup by `discord_links.discord_user_id`.
3. Else resolve self by `discord_links`.

Error conventions:

1. Mention user not linked -> explicit message.
2. Self not linked -> prompt to `/link`.
3. Username not found -> explicit message with normalized handle.

## 10) External API Behavior

AniList requests:

1. Use GraphQL endpoint `https://graphql.anilist.co`.
2. Search, by-ID, recommendation queries include `isAdult: false`.
3. Trailer URL derived from trailer metadata first, then external links fallback.

## 11) Known Constraints and Implementation Notes

1. Watch parties are not persisted.
2. Undo history is not persisted.
3. Leaderboard episode score is a simple aggregate and may not represent strict "episodes watched this period."
4. Command outputs are currently public (non-ephemeral).
5. Bot relies on web-side `/discord/link` flow to populate `discord_links`.

## 12) Designer Handoff: What Can Be Restyled Safely

These can be redesigned without changing backend logic:

1. Embed titles, descriptions, field labels.
2. Status icon language and tone.
3. Button labels and grouping.
4. Help panel wording and category ordering.
5. Color system and visual hierarchy.
6. Copy style (formal, playful, concise, etc.).

These should not change without product/engineering decision:

1. Slash command names and options.
2. Required linking preconditions for mutations.
3. Target resolution rules.
4. Watch party permission rules.
5. Data model assumptions for `discord_links`, `list_entries`, and `public_profiles`.

