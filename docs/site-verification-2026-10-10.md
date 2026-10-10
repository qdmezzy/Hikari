# Hikari website verification — October 10, 2026

## Live site and domain move

- `https://hikari.raycodes.me` resolves over HTTPS to the Hikari Vercel project. Deployment `FCJ8Gufu7rKDNpdWhxnB7RLbBvtJ` was Ready after the callback configuration update.
- Home, Discover, Browse, a media detail page, login, register, community, sitemap, and robots routes returned HTTP 200. The live Discover and Browse pages loaded actual catalog content without browser console errors.
- Canonical URLs, Open Graph URLs, sitemap entries, and the robots sitemap reference now use `hikari.raycodes.me`. The scoped source change is commit `f4d31ae`.
- Vercel reports the `.me` domain as a valid production configuration. The old `hikari.raycodes.net` hostname does not resolve in public DNS, so links to it cannot redirect yet.
- The production status endpoint reports website, database, AniList, and MangaDex operational. It reports the shelved Discord bot down, making the overall status degraded.

## Authentication and imports

- Supabase Auth Site URL was changed from `https://hikari.raycodes.net/` to `https://hikari.raycodes.me`.
- Supabase redirect allowlist now includes the production onboarding and password-reset paths, production settings path, and `http://localhost:3000/**` for local testing.
- Vercel `MAL_REDIRECT_URI` was changed from localhost to `https://hikari.raycodes.me/api/mal/callback`; a fresh production authorization response contains that callback.
- The MyAnimeList API app's registered App Redirect URL was changed to the `.me` callback by the owner. A fresh production authorization request now receives a 303 redirect to MyAnimeList's login page; before the change it returned `401 invalid_client`. This confirms callback registration, but a complete authenticated import still needs a test account.

## Application checks

- Local tests: 71 passed; TypeScript and lint passed. The production build generated 60 pages. The isolated PostgreSQL smoke check passed ownership, privacy, moderation, tracking-history, and notification-job scenarios against migrations 01–09; it does not prove live database behavior.
- Locally, guest Discover loaded trailers and Browse loaded anime and manga results. Live site behavior matched for guest Discover and Browse.
- Protected local and production API requests for account deletion, push subscriptions, and Discord linking returned 401 without authentication.
- The separate `rays` test account added a title, changed it to Watching with one episode, and retained both values after reload. The temporary title was removed and the list returned to zero.
- A guest viewing `rays` saw the title when Recent activity was enabled. Turning Recent activity off concealed the feed and list rows but incorrectly showed zero stats. The site now returns aggregate totals independently when Statistics remains enabled. Local API verification returned Watching 1, Titles 1, Progress 1 with Recent activity off, and a no-store profile response. Settings were restored afterward.
- Turning Public profile off returned a private page title, but the guest briefly still saw previously loaded profile details. The public profile API now sends `no-store` for all responses so a changed privacy setting does not leave a cacheable public response.
- Password recovery, real notification delivery, and cross-account authenticated moderation remain untested. No global push sweep was triggered.

## Remaining migration actions

1. With a test account, complete a MyAnimeList OAuth import and verify the imported list appears in Hikari.
2. If old Hikari links should keep working, restore DNS for `hikari.raycodes.net`, attach it to an appropriate redirect destination, and verify HTTP redirects to the new subdomain. Its current public DNS lookup returns no record.
3. Test a full password-recovery email and social login return to `.me` with the test account; these require the owner to receive/complete the provider messages.
