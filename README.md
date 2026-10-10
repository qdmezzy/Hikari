<div align="center">

<img src="web/public/brand/hikari-wordmark.png" alt="Hikari" width="300" />

**Anime & manga discovery and tracking**

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
- **Social** — follow people, post, comment, and a community feed.
- **Auto-tracking extension** — watch on a supported site and your progress updates itself. (still in prog)

## Tech stack

| Layer | Stack |
| --- | --- |
| Web | Next.js (App Router), React, Tailwind CSS, Framer Motion |
| Backend | Supabase (Postgres, Auth, Storage, RLS) |
| Data | AniList GraphQL, MangaDex, MyAnimeList OAuth |
| Extension | TypeScript + Vue, MV3 (Chrome & Firefox) |

## Contributing

Issues and PRs are welcome. For larger changes, open an issue first to discuss the approach.

## License

This project is [MIT licensed](LICENSE) — **except** the browser extension in [`Hikari Extension/`](Hikari%20Extension), which is a fork of [MAL-Sync](https://github.com/MALSync/MALSync) and is licensed under **GPL-3.0** (see [`Hikari Extension/LICENSE`](Hikari%20Extension/LICENSE)). Under the GPL the extension must stay open source and keep its attribution.

## Acknowledgements

- [AniList](https://anilist.co) — anime & manga catalog
- [MangaDex](https://mangadex.org) — manga data
- [MyAnimeList](https://myanimelist.net) — list import
- [MAL-Sync](https://github.com/MALSync/MALSync) — the foundation the auto-tracking extension is built on
