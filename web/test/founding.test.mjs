import assert from "node:assert/strict"
import test from "node:test"

import {
  FOUNDING_CAPACITY,
  buildFoundingJoinPath,
  canFoundingMemberVote,
  getFoundingInviteState,
  getNextFoundingNumber,
  isFoundingModerator,
  normalizeFoundingInviteCode,
  projectPublicFounder,
} from "../src/lib/founding-domain.mjs"
import { getSafeNextPath } from "../src/lib/safe-navigation.mjs"

test("founding capacity stops exactly at 25", () => {
  const issued = Array.from({ length: FOUNDING_CAPACITY }, (_, index) => index + 1)
  assert.equal(getNextFoundingNumber(issued.slice(0, 24)), 25)
  assert.equal(getNextFoundingNumber(issued), null)
})

test("founding numbers are sequential and gaps are never automatically reused", () => {
  assert.equal(getNextFoundingNumber([]), 1)
  assert.equal(getNextFoundingNumber([1, 2, 4]), 5)
  assert.equal(getNextFoundingNumber([{ member_number: 1 }, { member_number: 3 }]), 4)
})

test("expired, revoked, invalid, reused, and full invitations are rejected", () => {
  const future = "2026-07-22T12:00:00.000Z"
  const now = Date.parse("2026-07-21T12:00:00.000Z")
  assert.equal(getFoundingInviteState(null, { now }), "invalid")
  assert.equal(getFoundingInviteState({ expires_at: future, revoked_at: future }, { now }), "revoked")
  assert.equal(getFoundingInviteState({ expires_at: future, claimed_at: future }, { now }), "already_used")
  assert.equal(getFoundingInviteState({ expires_at: "2026-07-20T12:00:00.000Z" }, { now }), "expired")
  assert.equal(getFoundingInviteState({ expires_at: future }, { now, claimedCount: 25 }), "full")
  assert.equal(getFoundingInviteState({ expires_at: future }, { now, claimedCount: 24 }), "valid")
})

test("moderator management trusts only immutable app metadata", () => {
  assert.equal(isFoundingModerator({ app_metadata: { is_mod: true } }), true)
  assert.equal(isFoundingModerator({ app_metadata: { isMod: true } }), true)
  assert.equal(isFoundingModerator({ user_metadata: { is_mod: true } }), false)
  assert.equal(isFoundingModerator({ app_metadata: { role: "moderator" } }), false)
})

test("only active founders can vote on active proposals", () => {
  assert.equal(canFoundingMemberVote({ active: true }, { status: "active" }), true)
  assert.equal(canFoundingMemberVote({ active: false }, { status: "active" }), false)
  assert.equal(canFoundingMemberVote({ active: true }, { status: "draft" }), false)
  assert.equal(canFoundingMemberVote(null, { status: "active" }), false)
})

test("public founder projection honors listing opt-out and profile privacy", () => {
  const membership = { active: true, show_on_founders_page: true, member_number: 7, joined_at: "2026-07-21" }
  const profile = {
    user_id: "private-id",
    email: "private@example.com",
    public_profile: true,
    display_name: "Ray",
    handle: "ray",
    avatar_url: "https://example.com/avatar.png",
  }
  const projected = projectPublicFounder({ membership, profile })
  assert.deepEqual(projected, {
    memberNumber: 7,
    displayName: "Ray",
    handle: "ray",
    avatarUrl: "https://example.com/avatar.png",
    joinedAt: "2026-07-21",
  })
  assert.equal("user_id" in projected, false)
  assert.equal("email" in projected, false)
  assert.equal(projectPublicFounder({ membership: { ...membership, show_on_founders_page: false }, profile }), null)
  assert.equal(projectPublicFounder({ membership, profile: { ...profile, public_profile: false } }), null)
})

test("founding invitation continuation is internal and keeps secrets out of query strings", () => {
  const code = "abcdefghijklmnopqrstuvwxyz012345"
  const joinPath = buildFoundingJoinPath(code)
  assert.equal(normalizeFoundingInviteCode(code), code)
  assert.equal(joinPath, `/founding/join#code=${code}`)
  assert.equal(new URL(joinPath, "https://hikari.example").search, "")
  assert.equal(getSafeNextPath("/founding/join?resume=1"), "/founding/join?resume=1")
  assert.equal(getSafeNextPath("https://attacker.example/founding/join"), "/")
})
