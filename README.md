<div align="center">

<img src="web/public/brand/hikari-wordmark.png" alt="Hikari" width="300" />

**Anime & manga discovery and tracking — spoiler-free.**

Discover what to watch next, track your progress, build lists, import from MyAnimeList & AniList, and auto-track episodes as you stream.

[![CI](https://github.com/qdmezzy/Hikari/actions/workflows/ci.yml/badge.svg)](https://github.com/qdmezzy/Hikari/actions/workflows/ci.yml)

</div>

---

## What is Hikari?

Hikari is a modern anime & manga tracker built for speed and a clean, spoiler-safe experience. It has two parts:

- **Web app** — discovery, tracking, lists, reviews, stats, social, and AI recommendations.
- **Browser extension** — automatically updates your progress while you watch on supported streaming sites.

## Features

- **Spoiler-safe discovery** — a vertical, TikTok-style feed of official trailers with a one-tap spoiler shield.
- **Fast tracking** — six list states (watching, completed, on-hold, dropped, rewatching, plan-to-watch), quick progress updates, scores, and reviews.
- **Import** — pull your existing lists from **MyAnimeList** (OAuth) and **AniList** in a couple of clicks.
- **Stats & Wrapped** — time watched, streaks, top genres, achievements, and a shareable year-in-review.
- **Personal calendar** — upcoming episodes for the shows you're watching, with notifications.
- **AI recommendations** — chat-driven "what should I watch" tuned to your taste.
- **Social** — follow people, post, comment, and a community feed.
- **Auto-tracking extension** — watch on a supported site and your progress updates itself.

## Tech stack

| Layer | Stack |
| --- | --- |
| Web | Next.js (App Router), React, Tailwind CSS, Framer Motion |
| Backend | Supabase (Postgres, Auth, Storage, RLS) |
| Data | AniList GraphQL, MangaDex, MyAnimeList OAuth |
| Extension | TypeScript + Vue, MV3 (Chrome & Firefox) |

## Repository layout

```
web/               Next.js web app
Hikari Extension/  Browser extension (auto-tracking)
discord-bot/       Discord bot (account linking, discovery commands)
web/db/            SQL schema + RLS policies for Supabase
```

## Getting started (web app)

### 1. Prerequisites

- Node.js 20+
- A free [Supabase](https://supabase.com) project

### 2. Database

In your Supabase project's **SQL Editor**, run [`web/db/schema.sql`](web/db/schema.sql) to create all tables and Row-Level-Security policies in one go (the other files in [`web/db/`](web/db) are the same schema split per feature).

### 3. Environment

Create `web/.env.local`:

```env
# Supabase (anon key is public; service role key is server-only — never expose it)
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MyAnimeList import (optional)
MAL_CLIENT_ID=your-mal-client-id
MAL_CLIENT_SECRET=your-mal-client-secret
MAL_REDIRECT_URI=http://localhost:3000/api/mal/callback

# AI recommendations (optional — falls back to keyword matching without these)
OPENAI_API_KEY=
OPENROUTER_API_KEY=
```

### 4. Run

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000.

## Browser extension

```bash
cd "Hikari Extension"
npm install
npm run build:webextension
```

Then load it unpacked:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `Hikari Extension/dist/webextension`
4. Open the popup, sign in with your Hikari account, and start watching on a supported site.

## CI & backups

- **CI** — every push and PR runs a typecheck + production build ([`ci.yml`](.github/workflows/ci.yml)).
- **Database backups** — a weekly GitHub Action dumps the Supabase database, encrypts it, and stores it as a 30-day artifact ([`db-backup.yml`](.github/workflows/db-backup.yml)). To enable it on a fork, set the `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` repo secrets; decrypt with `openssl enc -d -aes-256-cbc -pbkdf2 -in hikari-backup.sql.enc -out hikari-backup.sql`.

## Contributing

Issues and PRs are welcome. For larger changes, open an issue first to discuss the approach.

## License

This project is [MIT licensed](LICENSE) — **except** the browser extension in [`Hikari Extension/`](Hikari%20Extension), which is a fork of [MAL-Sync](https://github.com/MALSync/MALSync) and is licensed under **GPL-3.0** (see [`Hikari Extension/LICENSE`](Hikari%20Extension/LICENSE)). Under the GPL the extension must stay open source and keep its attribution.

## Acknowledgements

- [AniList](https://anilist.co) — anime & manga catalog
- [MangaDex](https://mangadex.org) — manga data
- [MyAnimeList](https://myanimelist.net) — list import
- [MAL-Sync](https://github.com/MALSync/MALSync) — the foundation the auto-tracking extension is built on
