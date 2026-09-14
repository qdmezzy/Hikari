# Hikari implementation status

Updated September 14, 2026. This tracks actual implementation separately from release verification. The full roadmap is **not complete**.

September 14 update: user reports all nine production migrations completed and supplied the read-only installation check output. All checked columns, function permissions, private-table access, RLS and the tracking trigger report ready; the returned policy definitions were reviewed with no installation failure identified. Do not rerun the migrations. This confirms the supplied installation results, not signed-in end-to-end behavior. A GitHub encrypted public-schema backup was found and its successful upload verified; user holds the passphrase, but restoration has not been rehearsed. Earlier "unapplied" notes below are historical and superseded. Bot rebuild is still specification-only.

Latest catalog reliability fix: `/api/media` now rejects upstream HTTP, GraphQL and malformed-response failures instead of returning a successful empty catalog. Requests have bounded batches and timeouts; legitimate empty results remain distinct from failures. TypeScript and 71 automated tests pass. Signed-in persistence, approved-recipient push delivery, and the remaining accessibility/performance checks are still outstanding.

September 14 publication checks: fresh production build passes (60 pages), and the synthetic PostgreSQL scenario suite passes again. Local production-mode Home renders actual featured artwork without captured console errors. Browse loads three pages (72 titles); a subsequent genre request encounters AniList's `Too Many Requests` response, retains the 72 previous titles with explicit retry, and still switches between grid/list. Successful filtered results and exhaustion remain unverified. GitHub CI now also runs the automated tests. These browser checks follow the catalog UI → API → provider → rendered-result flow; they do not exercise signed-in writes.

## Latest continuation — site first, then bot, then extension

### Reliability pass and database preflight

Latest larger-library continuation: paged keyset reads now cover hidden titles, reminder preferences, tracked calendar titles, collection contents and the collection picker. They read through lower server caps and reject failed/inconsistent partial reads. Tests include 1,203 records with a 100-row server cap. The picker queries membership only in owned collections. Collection batch-removal mismatches now reload the actual contents rather than leaving stale cards. All Airing now pages currently releasing anime (including earlier-season ongoing shows) instead of fetching only the first 50 current-season titles; this still shows next announced episodes, not every future episode. TypeScript, focused lint and 68 automated tests pass. The new live schedule query remains unverified during the AniList outage; no production writes or new SQL migrations were added in this continuation.

- Production preflight received and reviewed: checked prerequisites present; new feature tables absent. The user ran only the read-only query. Production writes are still unapplied.
- Replaced the push worker with durable per-device jobs, bounded retries, fresh opt-in checks, leased claims and fenced receipts (migration 09). No real pushes sent. Provider acceptance is not display/read confirmation, and the provider/receipt crash gap remains at-least-once.
- All nine migrations execute in a synthetic local PostgreSQL database. Its scenario checks pass for collection permissions/stale ordering, publishing, feedback, comparison opt-out, hidden titles, moderation rollback, tracking privacy/account deletion and push retry/lease contracts. This caught and fixed moderation audit foreign keys blocking account deletion; decisions now retain their record while deleted actor/report references become null. These checks do not replace production-schema or concurrent-session verification.
- Fixed collection creation reporting success when its first title failed to save; an empty created collection remains available for retry with an honest partial-success message. Added failed-load retry, stale response protection, submission locks and input/button labels.
- Added media format to shared hydration and invalidated old metadata cache shape; Browse list rows now distinguish films/runtime from episodes.
- Browse now separates upstream failures from empty results, preserves loaded titles on failed refresh/load-more, offers explicit retry, deduplicates within and across pages, and avoids resetting genre state just when switching views.
- Latest checks: 64 automated tests, TypeScript, focused lint, and a production build generating 60 pages pass. Live Browse failure state was visually verified. Its console reports AniList's API temporarily disabled due to severe stability issues; live pagination verification is blocked on upstream recovery. No invented catalog data was substituted.

Next release gate: staging/live migration rollout with a recoverable backup, designated test accounts, signed-in persistence/permissions checks, real-recipient-approved reminder testing, and remaining keyboard/mobile/performance/catalog QA. Bot and extension remain untouched.

Additional work implemented locally (database-dependent features are not activated or persistence-verified):

- Collection following and explicit published updates; edits do not notify followers. Publication is owner-only, serialized, limited to one per hour, and inserts notifications atomically. Notifications contain no collection title or note that could leak after a collection becomes private.
- Collection cover selection, public creator attribution, public-visibility preview, and a public-only shareable poster image route. Already downloaded/shared copies cannot be retracted.
- Optional collection choice after saving in Discover.
- Direct profile favorite picker and opt-in comparison of two public profiles' visible favorites. It does not query private tracking or invent compatibility scores.
- Cross-device signed-in hidden titles, plus selectable linked-anime hiding with Undo. Related-title lookup is bounded (200 titles/eight requests), marks partial results, and does not promise a definitive or automatically maintained franchise list.
- One active curated watch club, opt-in membership, moderator-opened episode discussions and explicit episode spoiler boundaries. Uses existing social discussions/reporting. No live club created.
- Durable moderation decision history UI. Account unbanning remains the supported reversal; report status changes do not restore removed content.
- Onboarding no longer writes imported entries. It carries the chosen source/username into the preview import flow after successful setup and preserves the onward destination.
- The initial push marker fix has now been superseded by the durable per-device worker described above.
- Wrapped has been replaced with a new private editorial yearbook and a timestamped tracking-history model. Imported initial progress is a baseline, not yearly viewing. Net progress, films, chapters, UTC logging days, partial metadata and runtime estimates are labeled. The history migration records future changes only; no fabricated historical backfill. The old unused Wrapped calculator was removed (recoverable from Git).

Additional staging migrations, after 01–03:

4. `20260906_04_collection_publishing.sql`
5. `20260906_05_taste_comparison.sql`
6. `20260906_06_hidden_titles.sql`
7. `20260906_07_watch_clubs.sql`
8. `20260906_08_tracking_history.sql`
9. `20260906_09_push_delivery.sql`

Latest browser evidence: comparison guest view renders with no captured errors; watch-club route correctly reports the missing migration rather than showing a fake club. Signed-in new-feature checks remain blocked on designated staging setup/accounts.

Earlier continuation checks had 52 passing tests; the reliability pass above supersedes that count and adds isolated PostgreSQL execution tests. New private screens, poster-image output, club writes and cross-device persistence still require staging verification. Full keyboard/mobile/performance/pagination QA remains unfinished.

Sequence confirmed by the user: finish site including better-data Wrapped → rebuild Discord bot → redesign extension. No bot or extension code has been changed in this continuation.

The sections below preserve the earlier-pass audit; the continuation above supersedes implementation statuses, but not the outstanding release gates.

## Implemented locally

- Personality pass: Japanese editorial annotations, Home detour links, Community masthead, My List watch-journal heading, and artwork-led collection shelves. Home automatic featured rotation and full-screen Discover remain.
- Discover: one-action save, guarded Undo, guest return-to-title confirmation, title hiding with Undo and a hidden-title manager. Hiding is browser-local; franchise hiding and account sync are not implemented.
- Discover resilience: retained results on append failure, retry states, and background-player unmounting while hidden or while the controllable player is open.
- Calendar: persisted scope/view/timezone, timezone-aware day grouping, confirmed reminder saves, and separate push-permission controls. Delivery remains unverified.
- Collections: batch selection/removal, portable export, private duplication and guarded ordering UI. The last two require the prepared database migration.
- Import page: preview before committing, default new-only import, optional guarded updates, portable JSON export/re-import. My List now links to this preview flow. The separate onboarding importer still needs reconciliation.
- Feedback: own-report history with loading/error/retry states; database permission migration required.
- Airing inbox: own existing episode-related notifications; not yet a durable notification generation service.
- Metadata: film/runtime and manga chapter labels on shared cards; Home poster format/runtime plumbing.
- Media details: provider-supplied prequel, sequel, recap, adaptation and other relationships. No invented recommended order. Source: [AniList relationship reference](https://docs.anilist.co/reference/enum/mediarelation).
- Moderation: rebuilt workspace and an atomic, stale-decision-checked report decision path. The database function must be installed before report decisions work.
- Discord: comprehensive rebuild specification in [discord-bot-rebuild.md](discord-bot-rebuild.md). This is a specification, **not a rebuilt or deployed bot**.

## Database changes prepared, not applied

Apply only to a designated staging project first, in this order:

1. `web/db/migrations/20260906_01_atomic_moderation.sql` — locked report decisions, stale-state protection and durable decision notes.
2. `web/db/migrations/20260906_02_collection_tools.sql` — ordering and atomic private duplication.
3. `web/db/migrations/20260906_03_own_feedback.sql` — own-feedback reads and authenticated author checks.

No production migration or account/content mutation was performed for these checks. Static SQL tests are not proof that a migration runs correctly. Missing moderation RPC deliberately fails closed rather than falling back to separate destructive writes.

## Verification evidence

- 43 automated tests pass; TypeScript check and focused JSX lint pass.
- Production build passes, including the latest relationship section (58 generated pages). The first restricted run could not fetch Google Fonts; the network-enabled build completed successfully.
- Home browser → local API → AniList → rendered artwork verified. Local requests initially failed with network `EACCES`; restarting the development server with network access restored HTTP 200 responses. No credentials were changed.
- Public Community layout inspected. Discover trailer playback and its revised two-row controls visually checked at 390 × 844. Full authenticated and mobile coverage is not complete.
- Media 20954 renders live source-material and related-special links with no captured browser errors. No list or account mutations were made.
- No test signups, verification emails, password recovery, account writes, moderation decisions or notification sends have been exercised against a designated staging system yet.

## Still required from the approved roadmap

### Reliability and release gates

- Designated regular and moderator staging accounts; signed-in end-to-end persistence checks across all requested flows.
- Execute migrations, permission-denial tests and simultaneous-moderator stale-decision tests.
- Durable reminder delivery/retry audit. Existing push worker can still advance its last-notified marker after failed sends; do not call delivery production-ready.
- AniList throttling/offline, unavailable trailer and missing poster checks across every entry point; full consecutive pagination/filter/back-navigation coverage.
- Keyboard, captions, contrast, reduced-motion and mobile safe-area audit; measured mobile player/image performance.
- Complete metadata consistency beyond the updated shared and Home cards.

### Finish the core flows

- Optional collection choice after Discover save.
- Cross-device hidden preferences and verified franchise hiding.
- Profile direct favorite chooser with explicit public preview/privacy.
- Collection chosen covers, creator attribution and public visibility preview.
- Reconcile onboarding import with the safe preview path.
- Expanded moderation decision history UI and safe reversal where supported.

### Later features requested, not yet built

- Opt-in taste comparison between public profiles.
- Seasonal watch clubs with episode-specific spoiler boundaries.
- Follow collections, explicit publish updates and follower notifications.
- Shareable collection-cover output with creator attribution and a working public URL.
- Shared durable web/Discord notification preferences and delivery infrastructure, when implementing the bot rebuild.

The next release decision needs a staging environment and designated test accounts, not production experimentation. Do not put passwords or API keys in this document.
