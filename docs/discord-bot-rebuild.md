# Hikari for Discord — rebuild specification

September 6, 2026. Product and engineering specification, not a claim that the rebuilt bot is running. Do not replace the live bot until staging, migration, and rollback checks pass.

## What the bot should be

An anime companion that is useful in any server, with a personal connection to your Hikari account. Not a billboard for the Hikari Discord and not a generic moderation/economy bot.

Two independent modes:

- **For a person:** find anime, keep progress, and receive the notifications they choose from Hikari.
- **For a server:** choose shared shows, post airing updates, organize episode discussions, and discover what to watch together. No Hikari-server membership requirement.

Search and public title information must work without linking an account. Private library actions require a verified link. Server administrators never gain access to members' private lists or notification preferences.

## Feature inventory

### A. First-run, help, and account control — launch essential

- `/help`: browsable Components V2 menu grouped by Discover, My anime, Notifications, and This server; examples and working buttons rather than a giant command dump.
- `/account`: link status, safe linking flow, unlink confirmation, privacy summary, and link to account settings.
- Signed, short-lived, single-use linking challenges bound to the Discord identity. Never link merely because a username matches. Keep invitation/auth secrets out of logs.
- Linking must not require joining the Hikari server. Preserve existing verified links during migration where the contract remains valid.
- `/settings`: language/title preference, timezone, spoiler preference, personal notification controls, and clear distinction between account-wide and this-server options.
- Clear onboarding for an unlinked user: explain why linking is needed only when attempting a private action, then return them to that action.
- `/privacy`, `/support`, `/status`, and an installation link that explains requested permissions.
- Export/delete guidance and unlink behavior that cancels future personal deliveries.

### B. Discovery and useful title cards — launch essential

- `/anime search`, `/manga search`: autocomplete, disambiguation, native/English titles, year, format, genuine score, and poster.
- `/anime info`: spoiler-safe synopsis, runtime/episode count, studio, season, status, trailer link, verified watch providers, Hikari detail link.
- `/discover`: genre/mood/format filters, next title, save, favorite, not interested, and optional share-to-channel confirmation.
- `/airing today` and `/airing week`: local timestamps, personal or server scope, and a clear unknown/delayed state.
- `/anime relations`: verified prequel/sequel/recap relationships, not a fabricated authoritative watch order.
- `/random`: bounded filters with an honest empty result; exclude adult content in unsupported contexts.
- Cache public title data and deduplicate requests. One provider outage must produce a retryable response, not an interaction timeout.

### C. Personal tracking — launch essential

- `/list`: private by default; status filters, quick search, pagination, title detail and progress controls.
- Add a title, choose status, increment progress, enter a specific episode/chapter, score, and completion confirmation.
- Concurrent web/bot updates must not overwrite newer progress. Return the saved state, not a guessed success.
- Undo where safe, with conditional writes so an old Undo cannot delete newer work.
- `/favorites`: actual favorite anime/manga, never saved clips. Add/remove, personal visibility, notification shortcut.
- `/collections`: browse own collections, add/remove titles, create and name one, public preview, share link.
- `/profile` and `/stats`: own private summary; another person's data only when explicitly public. Label estimates and missing values.
- `/compare`: both people opt in or use explicitly public data. Explain overlap without implying private data was accessed.
- `/import`: hand off to the web preview/conflict flow; do not request MAL passwords in Discord.

### D. Shared Hikari notifications — the signature feature

**One notification system with multiple delivery channels.** The website and bot should not independently guess which notifications exist.

#### What users can subscribe to

- New episodes for explicitly followed shows.
- New episodes for favorited anime, after opting into the “favorites” source.
- New episodes for currently watching/rewatching titles, after opting in.
- A selected show's premiere, finale, or verified schedule change.
- New season/film announcements only when a reliable source and relation are available; do not infer news from arbitrary metadata changes.
- Weekly personal airing digest.
- Collection publish updates from collections the user follows.
- Optional social notifications: replies, mentions, follows, and watch-club updates. Separate toggles for each category; no private messages forwarded to public channels.
- Feedback status changes, if enabled, without including sensitive report content in notification previews.

#### Shared preference flow

1. Link Discord securely.
2. On the website, enable **Discord delivery** and choose notification categories and sources. Linking alone never opts someone into DMs.
3. In Discord, `/notifications` shows the same account preferences. Changes save to the same backend.
4. Existing web notification settings remain meaningful: enabling Discord adds a delivery channel, not an entirely separate subscription list.
5. Each notification offers Open on Hikari, Mark watched where applicable, Mute this show, and Notification settings. Destructive/private changes are identity-bound.

#### Required delivery controls

- DM vs web push vs in-app are independent channels. A read notification is not automatically a delivered notification.
- Quiet hours and digest scheduling use an IANA timezone, including daylight-saving transitions.
- Per-show mute, snooze until tomorrow, pause all personal DMs, and unsubscribe from the message itself.
- Preview/test message is sent only on explicit request; no automatic test spam after every setting change.
- Blocked DMs: mark destination unavailable, show guidance in-app, stop repeated attempts, and never redirect private notifications into a server channel.
- Deduplicate across overlapping favorite/watching/manual sources before delivery. One episode produces one personal DM, not three.
- Persist events and per-destination delivery attempts across restarts. Retry transient failures with backoff; distinguish permanent errors and exhausted retries.
- Bounded catch-up after downtime. Do not send hundreds of old episode messages on restart.
- Deleted favorite/removed subscription/unlinked account must be rechecked before a queued message is sent.

### E. Any-server features — launch essential

- `/server setup`: guided, administrator-only configuration; channel picker, permission checks, timezone, and a preview before enabling delivery.
- `/server shows`: explicit server subscriptions independent of members' personal lists. Add/remove titles and optionally subscribe to a season's curated selection.
- `/server notifications`: choose airing/digest destination, cadence, quiet hours, optional ping role, and whether episode threads should be created.
- Default to no role pings. Only mention the configured role with explicit allowed-mentions restrictions; never `@everyone` by default.
- `/server schedule`: useful to unlinked members; displays only server-selected shows.
- Per-server configuration, quotas, and delivery history keyed by guild ID. Settings from one server cannot leak into another.
- Permission diagnostics for missing channels, send-message rights, thread rights, and removed roles. No Administrator permission requirement merely to search anime.
- Moderator-only config changes checked at interaction time, including button clicks and modals—not just initial command registration.
- Uninstall cleanup: stop deliveries to that server, retain only necessary audit data per policy, and offer reinstallation recovery deliberately.
- No mandatory Hikari branding spam, automatic community invites, founder-role sync, or auto-enrolment of server members.

### F. Watch together — next phase

- `/club create`: choose title, season, cadence, channel, and spoiler policy; member RSVP/leave controls.
- One episode thread per club/episode; do not create duplicate threads after restart.
- Upcoming session reminder with relative and absolute Discord timestamps.
- Explicit RSVP only. Never automatically add everyone who has the anime in a private Hikari list.
- Episode boundaries in titles and warning text; avoid plot spoilers in notifications.
- “What should we watch?” shortlist and opt-in vote, with close time and results. A custom V2 voting interface should not be confused with a native Discord poll payload.
- Optional Discord scheduled event integration, only with the appropriate server permissions.
- Archive controls and a clean exit when a club finishes.

### G. Sharing and server personality — next phase

- Attractive public collection cards with creator attribution and working links.
- Share a recommendation with a short personal note; preview before posting publicly.
- Opt-in server seasonal board and shared collection. Private progress remains private.
- Small, optional milestone shares—not automatic achievement spam.
- Consistent Japanese accents, restrained Hikari colors, clean spacing, real artwork, and concise human copy. No massive banners on every response.

## Components V2 design rules

Use Containers, Text Displays, Sections with thumbnails, Separators, Media Galleries where useful, and Action Rows. Keep the primary action obvious; long results use pagination or selects. A notification should be readable at a glance on mobile.

V2 messages require `IS_COMPONENTS_V2`; traditional `content` and `embeds` are disabled for those messages. Build new responses as component trees, rather than adding a flag to existing embeds. [Discord component overview](https://docs.discord.com/developers/components/overview)

The V2 flag cannot be removed from an existing message. Plan upgrades and edits accordingly; use fresh messages when necessary. [Discord's component guide](https://docs.discord.com/developers/components/using-message-components)

Design these reusable response families:

| Response | Structure | Main interaction |
| --- | --- | --- |
| Title | Title + compact facts + poster + short synopsis | Save / trailer / more |
| Episode notification | Title + episode + time + source label | Open / watched / mute |
| Library | Heading + five concise entries + position | Previous / next / select |
| Settings | Category description + current values | Select / toggle / confirm |
| Collection | Name + creator + poster gallery + privacy | View / save a title / share |
| Error | Plain explanation + preserved context | Retry or fix configuration |
| Setup | One question at a time + progress | Select channel / preview / enable |

Button IDs must be versioned opaque references with server-side state, expiry, owner, guild, and action checks. Do not place access tokens in custom IDs. Expired buttons should give a fresh-start action, not silently fail. Screen text and button labels must make sense without custom emoji access.

## Multi-server and user-install model

Support guild installations for shared channels and clubs. Evaluate user installation for personal search/tracking commands where supported; choose command `integration_types` and `contexts` deliberately. User installation is not a promise that proactive DMs will always be deliverable. [Discord's user-install tutorial](https://docs.discord.com/developers/tutorials/developing-a-user-installable-app)

Private responses should be ephemeral where the interaction supports it. Public posting should be an explicit action. A public search card can let each clicker save to their own account, but a personal settings panel must reject other users' clicks.

## Architecture and data contracts

- **Interactions layer:** slash commands, autocomplete, buttons, modals, context menus; acknowledge promptly and defer slow work. Discord requires an initial response within three seconds; interaction tokens last fifteen minutes. [Interaction lifecycle](https://docs.discord.com/developers/interactions/receiving-and-responding)
- **Application services:** catalog, library, favorites, collections, identity, club management. Shared backend contracts with the website, not duplicate business logic.
- **Notification events:** immutable event ID, type, media ID, episode, source timestamp, safe payload, and dedupe key.
- **Subscriptions:** owner, source/category, destination channel, opt-in status, timezone, quiet hours, version.
- **Delivery outbox:** event ID + destination unique key, pending/leased/sent/failed/cancelled state, attempt count, lease expiration, next attempt, provider message ID. Idempotency and reconciliation should minimize duplicate sends; do not claim exactly-once delivery across a network crash.
- **Guild configuration:** guild ID, configured channel IDs, role IDs, explicit show subscriptions, locale/timezone, limits, revision, installed state.
- **Worker:** claim bounded batches, recheck consent and destination, send, persist result. Recover expired leases after a crash.
- **Observability:** health, last successful provider sync, queue age, failures by category, blocked destinations, rate-limit counts. Redact personal content, tokens, and emails.
- **Abuse controls:** per-user/server cooldowns, bounded fan-out, title deduplication, adult-content rules, safe links, and escaped mentions.

Honor Discord's response headers and `retry_after`; rate limits must not be hard-coded assumptions. [Discord rate limits](https://docs.discord.com/developers/topics/rate-limits)

## What the current bot needs to replace

Inspection found existing account/tracking/discover/share/stats/favorites/admin command groups. Keep useful behavior, not their old screen structure. The episode-alert service currently uses legacy embeds, caps title selection at 50, and deduplicates in memory; it also mixes personal title tracking with server thread participation. The rebuild must replace that delivery design before expanding notifications. Keep verified account-link security and its tests rather than discarding them to satisfy “from scratch.”

## Acceptance checklist

- Two unrelated test servers can install and configure independently.
- Unlinked users can search; linked users can privately save and update progress.
- Another user clicking a private control cannot change its owner's data.
- Web preference changes affect bot delivery, and bot preference changes appear on the web after refresh.
- Favorite + watching + explicit alert for the same episode yields one DM.
- Restart after send/ack failure is covered by reconciliation tests.
- Blocked DMs, deleted channels, expired buttons, 429s, provider timeouts, and missing permissions have useful outcomes.
- Quiet hours and daylight-saving transitions are tested.
- No title, account, guild, or notification secrets leak into unrelated responses.
- Components V2 payload snapshots are validated against Discord's current schema and checked on desktop/mobile.
- Migration preserves links/subscriptions; rollback cannot run old and new notification workers simultaneously.
- No production bot login, command registration, or outbound message happens as a side effect of tests.

## Build order

1. New architecture + V2 response kit + interaction tests.
2. Search/title/help/account linking in a test server.
3. Shared notification preference schema + durable outbox + favorites/episode DMs.
4. Server setup and explicit server subscriptions; validate a second unrelated server.
5. Tracking, collections, and sharing.
6. Clubs, comparison, and seasonal boards.
7. Migration rehearsal, limited rollout, and health monitoring before retiring the old worker.

Do not rebuild generic economy, music streaming, arbitrary AI chat, or full server moderation into this bot. Its reason to be installed is anime discovery, keeping up with shows, and watching together.
