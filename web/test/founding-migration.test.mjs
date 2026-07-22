import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(new URL("../db/migrations/20260721_02_founding_25.sql", import.meta.url), "utf8")
const previewRoute = readFileSync(new URL("../src/app/api/founding/invites/preview/route.ts", import.meta.url), "utf8")
const claimRoute = readFileSync(new URL("../src/app/api/founding/invites/claim/route.ts", import.meta.url), "utf8")
const joinPage = readFileSync(new URL("../src/app/founding/join/page.jsx", import.meta.url), "utf8")

test("migration enforces capacity, unique membership, and permanent numbers", () => {
  assert.match(migration, /user_id UUID PRIMARY KEY/)
  assert.match(migration, /member_number SMALLINT NOT NULL UNIQUE CHECK \(member_number BETWEEN 1 AND 25\)/)
  assert.match(migration, /COUNT\(\*\).*founding_members[\s\S]*>= 25/)
  assert.match(migration, /prevent_founding_member_delete/)
  assert.match(migration, /MAX\(fm\.member_number\)/)
  assert.doesNotMatch(migration, /generate_series\(1, 25\)/)
})

test("the final position is serialized and invitation claims are single-use", () => {
  const claimFunction = migration.slice(
    migration.indexOf("CREATE OR REPLACE FUNCTION public.claim_founding_invite"),
    migration.indexOf("CREATE OR REPLACE FUNCTION public.grant_founding_member"),
  )
  assert.match(claimFunction, /pg_advisory_xact_lock/)
  assert.match(claimFunction, /FOR UPDATE/)
  assert.ok(claimFunction.indexOf("pg_advisory_xact_lock") < claimFunction.indexOf("COUNT(*)"))
  assert.match(claimFunction, /claimed_at IS NULL/)
  assert.match(claimFunction, /RAISE EXCEPTION 'founding_invite_claim_race'/)
})

test("founding invites store only a cryptographic hash", () => {
  const inviteTable = migration.slice(
    migration.indexOf("CREATE TABLE IF NOT EXISTS public.founding_invites"),
    migration.indexOf("CREATE TABLE IF NOT EXISTS public.founding_feature_proposals"),
  )
  assert.match(inviteTable, /code_hash TEXT NOT NULL UNIQUE CHECK \(code_hash ~ '\^\[a-f0-9\]\{64\}\$'\)/)
  assert.doesNotMatch(inviteTable, /\n\s*code\s+TEXT/i)
  assert.match(migration, /REVOKE ALL ON public\.founding_invites FROM anon, authenticated/)
})

test("RLS and RPC contracts enforce moderators, founders, self-claims, and one vote", () => {
  assert.match(migration, /actor_id UUID := auth\.uid\(\)/)
  assert.match(migration, /IF NOT public\.is_moderator\(\)/)
  assert.match(migration, /auth\.uid\(\) = user_id AND public\.is_active_founding_member\(\)/)
  assert.match(migration, /p\.status = 'active'/)
  assert.match(migration, /PRIMARY KEY \(proposal_id, user_id\)/)
  assert.match(migration, /ON CONFLICT \(proposal_id, user_id\)/)
  assert.match(migration, /remove_inactive_founding_votes/)
  assert.match(migration, /REVOKE ALL ON public\.founding_members FROM anon, authenticated/)
})

test("public roster exposes only opted-in public profile fields", () => {
  const roster = migration.slice(
    migration.indexOf("CREATE OR REPLACE FUNCTION public.get_founding_public_roster"),
    migration.indexOf("CREATE OR REPLACE FUNCTION public.get_founding_public_capacity"),
  )
  const rosterSignature = roster.slice(roster.indexOf("RETURNS TABLE"), roster.indexOf("LANGUAGE sql"))
  assert.match(roster, /fm\.show_on_founders_page = TRUE/)
  assert.match(roster, /pp\.public_profile = TRUE/)
  assert.doesNotMatch(rosterSignature, /user_id/i)
  assert.doesNotMatch(rosterSignature, /email/i)
})

test("invite secrets are not logged, analyzed, or returned by preview and claim responses", () => {
  for (const source of [previewRoute, claimRoute, joinPage]) {
    assert.doesNotMatch(source, /console\.(?:log|info|warn|error)/)
    assert.doesNotMatch(source, /analytics|track\s*\(/i)
  }
  assert.doesNotMatch(previewRoute, /NextResponse\.json\([^)]*\bcode\b/)
  assert.doesNotMatch(claimRoute, /NextResponse\.json\([^)]*\bcode\b/)
  assert.match(joinPage, /history\.replaceState\(null, "", "\/founding\/join"\)/)
})
