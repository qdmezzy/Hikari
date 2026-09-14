# Hikari: what to improve next

Updated September 5, 2026. This is a prioritized proposal, not a claim that every item is a confirmed bug or already built.

Implementation and verification are tracked separately in [implementation-status.md](implementation-status.md). The Discord rebuild inventory is in [discord-bot-rebuild.md](discord-bot-rebuild.md).

## Product direction

Make Hikari the place you find a show, keep your place, and share your taste. Lead with the immersive trailer feed and genuinely useful collections. Keep Japanese typography, restrained motion, and artwork-led layouts. Avoid sparkles, generic recommendation slogans, decorative dashboard numbers, and features that promise more than they do.

## This pass

- Discover no longer numbers an open-ended feed. Its footer shows an exploration hint, loading state, or actual end state.
- Founding 25 entry pages redirect away; navigation, public badges, and founder name highlighting are retired. Existing database records and backend integration code are retained, not erased.
- Moderation is one new community desk: report queue, account appeals plus escalations, feedback, people, announcements, threads, decision log, insights, and working browser preferences.
- Mod actions retain server-enforced permissions. Destructive actions have confirmations; bans and appeal decisions require a note. No live moderation mutations were performed during verification.

## 1. Fix and verify before a broader launch

| Priority | Work | Definition of done |
| --- | --- | --- |
| P0 | Signed-in end-to-end checks | Test sign-up, verification, login, recovery, import, save, progress, collection creation, sharing, and logout with a designated test account. Refresh after each write and confirm persistence. |
| P0 | Moderation persistence audit | Verify every action with moderator and non-moderator test accounts against a staging database. Make content removal + report resolution atomic; currently the service performs separate writes. Add stale-decision protection when two mods review the same report. |
| P0 | Airing reminders | Verify successful delivery, timezone changes, permission denied, and failed saves. Roll back optimistic state on a rejected write; do not display a reminder as saved until confirmed. |
| P0 | External-data failures | Exercise AniList throttling/offline responses, missing posters, unavailable trailers, and empty pages. Every state needs retry or a useful exit, never an endless skeleton. |
| P1 | Browse and Discover pagination | Test several consecutive page loads, switching grid/list, filters, back navigation, duplicate titles, and exhaustion. Preserve the current results on failure. |
| P1 | Accessibility and motion | Check keyboard-only flows, visible focus, player controls, caption availability, contrast, mobile safe areas, and both system/app reduced-motion settings. |
| P1 | Honest labels and metadata | Films should say film/runtime, not “1 episode”; manga should use chapters; unknown dates/scores should remain unknown. Recheck cards as well as detail pages. |
| P1 | Performance | Profile mobile trailer switching and image loading. Keep only necessary players alive; pause when hidden. Measure before optimizing. |

The historical report in `docs/archive/legacy-bug-report.md` is reference material. Reproduce its findings against the current app before treating them as current bugs.

## 2. Better flows

1. **Discover → save → continue.** Save in one action, show the chosen list with Undo, then let people optionally choose a collection. Do not interrupt every save with a modal.
2. **Guest save → sign in → original title.** Carry the intended action safely through authentication and let the person confirm it once. Avoid landing them on an unrelated home page.
3. **My List → tonight's watch.** Continue-watching first, then a small explainable Watch Next shelf. Explain recommendations with actual reasons such as “next season” or “already on your plan-to-watch list.”
4. **Collections → organize → share.** Create a collection where the titles are; add several at once, reorder them, set cover/title/description, preview public visibility, then copy the link. Clearly distinguish private collections from public ones.
5. **Calendar → personal schedule.** Remember chosen scope, timezone, and view. Separate “all airing” from “my shows”; tell users when no tracked shows air that day.
6. **Profile → identity.** Choose favorite titles directly, preview the public profile, and make privacy obvious. Keep favorites distinct from collections and saved media.
7. **Feedback → outcome.** Acknowledge receipt, then optionally let signed-in users follow their own report's status. Do not expose other users' contact details.
8. **Moderation → decision.** Show original context, reporter reason, previous decisions, and intended consequence together. Add durable audit notes and safe reversal where supported.

## 3. New features worth building

### First: reinforce the core product

- **“Not interested” in Discover:** hide a title or franchise, with Undo and a manageable hidden list. More useful than another opaque recommendation badge.
- **Collection batch tools:** multi-select, reorder, duplicate, and export. Start with personal collections before collaboration.
- **Airing inbox:** a quiet in-app list of new episodes for tracked shows; make push notifications optional.
- **Watch-order context:** distinguish sequel, prequel, recap, and film using verified relationship data. Do not invent a universal watch order.
- **Import preview and export:** preview conflicts and counts before importing; offer a portable export so joining feels low-risk.

### Later: give people a reason to share

- **Shareable collection covers:** attractive poster layouts with a real public URL and creator attribution.
- **Taste comparison:** opt-in overlap between two public profiles, with clear privacy boundaries.
- **Small seasonal watch clubs:** one discussion per episode with spoiler boundaries. Start with one curated club, not a sprawling empty community.
- **Follow collections:** notify followers only when the owner publishes an update, not on every edit.

### Defer

Do not prioritize more AI chat surfaces, collectible founder programs, gamified streak pressure, or a large paid referral system. They add maintenance and dilute the core loop. Revisit only if real usage supports them.

## 4. Promotion plan

These are proposed experiments, not traffic or conversion forecasts. No posts, outreach, ad purchases, or tracking changes have been made.

### The hook

Show the product working: a full-screen trailer, one save, and a useful personal collection. Position it around “Find your next anime. Keep your place.” Avoid leading with “AI-powered,” a feature dump, or comparisons that cannot be backed up.

### First four weeks

| Week | Small experiment | Success signal |
| --- | --- | --- |
| 1 | Invite 10–15 anime fans individually to try discovery, saving, and collections. Ask where they got stuck; fix repeated problems. | People can complete the core loop without instructions. This is a research sample target, not an existing user count. |
| 2 | Publish three short screen recordings, each demonstrating one real workflow. Try different openings, not different exaggerated claims. | Profile/site visits that become first saves; compare retention/engagement, not raw view counts alone. |
| 3 | Ask a few relevant small creators or Discord community owners whether a curated collection would help their audience. Offer a useful collection and transparent credit. | Actual collection visits and saves, not the creator's follower count. No unsolicited mass DMs. |
| 4 | Share a specific product story and useful collection in communities that permit it. Use feedback from the first users. | Returning users and repeat saves from each source. Do not buy ads until the core loop holds up. |

On Reddit, check each community's rules and ask moderators where necessary. There is no universal posting quota that overrides local rules. [Reddit's spam guidance](https://support.reddithelp.com/hc/en-us/articles/28012014962580-How-do-I-keep-spam-out-of-my-community) explains that communities set different promotion limits.

For short videos, track engaged views, retention, and downstream product use. YouTube distinguishes Shorts engagement measurements from simple views. [YouTube engagement documentation](https://support.google.com/youtube/answer/9313698?hl=en-0)

Use your own interface recordings and assets you have permission to publish. Do not assume an embedded trailer can be downloaded and reused as advertising.

### Search and sharing foundations

- Check public title and collection pages are actually indexable and useful without login.
- Give each public page accurate titles, descriptions, canonical URLs, and social previews.
- Publish a few thoughtful seasonal collections with original notes. Avoid mass-producing thin genre/keyword pages.
- Audit structured data against supported types and visible content; markup is not a ranking guarantee. [Google Search appearance guidance](https://developers.google.cn/search/docs/appearance?hl=en)

### Measure the loop, not vanity numbers

Proposed minimal funnel: landing visit → trailer explored → first saved title → first progress update or collection → return within seven days. Attribute links by campaign, avoid storing private list contents or feedback text in analytics, and review applicable consent needs before adding tracking. Establish a baseline before setting conversion goals or spending money.

## Recommended next order

Finish signed-in verification → fix persistence and reminder failures → polish saving/collections → run the small user test → improve shareable collections → begin creator/community experiments.

## Moderation follow-ups

The redesign intentionally labels fetched records as a limited snapshot. Next add server pagination, assignment, decision notes, concurrency protection, and atomic report mutations. Temporary bans and expanded response-time reporting should return with verified data contracts; the new UI currently offers indefinite bans with an explicit reason. Preserve server permission checks and never use the redesign as a reason to weaken RLS.
