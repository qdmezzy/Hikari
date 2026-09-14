# Redesign database handoff

## September 14 update

The user reports completing all nine migrations in the production SQL Editor and supplied the output of `web/db/verify-redesign-install.sql`. All checked columns, function permissions, private-table access, RLS and the tracking trigger report `ready`. The `policy_review` rows are definitions for review, not failed checks; the supplied definitions match the intended access rules. No `MISSING` or `CHECK FAILED` row was supplied. Treat these migrations as applied; do not rerun them. No further SQL is needed for this installation check. Signed-in persistence, permission scenarios and real delivery still need end-to-end verification.

The September 6 GitHub backup run 34020171231 was verified to have successful dump/encrypt/upload steps and an unexpired 8.9 MB artifact. The user confirmed holding the passphrase. It is a public-schema backup, not a full Auth/Storage backup, and no restore rehearsal has been performed. The preflight/rollout notes below are historical context, not instructions to rerun completed migrations.

## First: read-only preflight

Open `web/db/preflight-redesign.sql`, paste it into the Supabase SQL Editor for the intended project, and run it. It only returns schema/policy information, not user records or credentials. The updated query combines all checks into one result table so a single CSV export includes everything. Send that CSV back and identify whether the project is staging or production.

Do not run the write migrations yet if the preflight lists missing prerequisites or any new feature tables already exist. We need to reconcile that state first. These migrations are not all safe to rerun blindly.

### Preflight reviewed September 6

The user's updated CSV reports all checked prerequisite columns and `is_moderator()` present, with none of the nine feature tables installed. The screenshot identifies the project as **production**. The user confirmed running only the read-only check. No production migrations have been applied by this task.

All nine migrations have now been executed successfully against an isolated PGlite/PostgreSQL synthetic schema matching the checked column types. Additional database assertions cover ownership, stale ordering and moderation, failed-removal rollback, private duplication, publication throttling, feedback identity/privacy, comparison opt-out, hidden-title isolation, tracking privacy/account deletion, device deduplication, retry delay, expired-lease recovery and client queue denial. This is not a copy of production and does not verify its additional constraints/triggers, concurrent database sessions, or real notification delivery.

## Migration order after the preflight is reviewed

Use a staging project first. Ensure a recoverable backup/snapshot exists before a production change. Run one complete file at a time, in order; each is transactional. If a file errors, stop and send the error rather than skipping statements or continuing.

1. `web/db/migrations/20260906_01_atomic_moderation.sql`
2. `web/db/migrations/20260906_02_collection_tools.sql`
3. `web/db/migrations/20260906_03_own_feedback.sql`
4. `web/db/migrations/20260906_04_collection_publishing.sql`
5. `web/db/migrations/20260906_05_taste_comparison.sql`
6. `web/db/migrations/20260906_06_hidden_titles.sql`
7. `web/db/migrations/20260906_07_watch_clubs.sql`
8. `web/db/migrations/20260906_08_tracking_history.sql`
9. `web/db/migrations/20260906_09_push_delivery.sql`

This is the locally tested sequence. Confirm a staging target or a recoverable production backup before the live rollout. Do not rerun a successful migration. Migration 09 must precede deployment of the new push worker: the worker intentionally returns an unavailable response without the queue rather than reverting to duplicate-prone sends.

## What these change

They add feature tables, owner/moderator permissions, database functions and a tracking-history trigger. Existing accounts and libraries are not erased. The tracking-history trigger runs on future list changes, so it must be tested before production; it does not recreate historical watch dates.

Notification jobs are per device, retry up to six attempts within 24 hours of airing, and recheck reminders/subscriptions before sending. Receipts mean provider acceptance, not that a person read a notification. A crash after provider acceptance but before saving a receipt can still cause a duplicate; no exactly-once guarantee is made. Scheduled-run frequency controls actual retry latency. No production push tests have been sent. Large-catalog throughput, job retention and real multi-worker concurrency still need operational validation.

## After installation

Use designated regular and moderator test accounts. Verify normal-user denials, two-moderator conflicts, refresh-after-save persistence, collection privacy/follow/publication, favorites comparison opt-out, hide/restore, club episode boundaries, import conflicts, account deletion and Wrapped history. Actual push tests require an explicitly designated test recipient; never broadcast a test to real members.

Do not send passwords, database connection strings, service-role keys or push subscription tokens in chat.
