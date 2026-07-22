export const FOUNDING_CAPACITY = 25
export const FOUNDING_REFERRAL_LIMIT = 2

export const normalizeFoundingHandle = (value) =>
  String(value || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30)

export const normalizeFoundingInviteCode = (value) => {
  const code = String(value || "").trim()
  return /^[A-Za-z0-9_-]{24,128}$/.test(code) ? code : ""
}

export const getNextFoundingNumber = (members = []) => {
  const issued = members
    .map((member) => Number(typeof member === "number" ? member : member?.member_number))
    .filter((number) => Number.isInteger(number) && number >= 1 && number <= FOUNDING_CAPACITY)
  const next = (issued.length ? Math.max(...issued) : 0) + 1
  return next <= FOUNDING_CAPACITY ? next : null
}

export const getFoundingInviteState = (invite, { now = Date.now(), claimedCount = 0 } = {}) => {
  if (!invite) return "invalid"
  if (invite.revoked_at) return "revoked"
  if (invite.claimed_at || invite.claimed_by) return "already_used"
  if (!invite.expires_at || new Date(invite.expires_at).getTime() <= now) return "expired"
  if (claimedCount >= FOUNDING_CAPACITY) return "full"
  return "valid"
}

export const isFoundingModerator = (user) =>
  user?.app_metadata?.is_mod === true || user?.app_metadata?.isMod === true

export const canFoundingMemberVote = (membership, proposal) =>
  membership?.active === true && proposal?.status === "active"

export const projectPublicFounder = ({ membership, profile }) => {
  if (!membership?.active || !membership?.show_on_founders_page || !profile?.public_profile) return null
  return {
    memberNumber: Number(membership.member_number),
    displayName: profile.display_name || profile.handle || "Hikari Founder",
    handle: profile.handle,
    avatarUrl: profile.avatar_url || null,
    joinedAt: membership.joined_at || null,
  }
}

export const buildFoundingJoinPath = (code) => {
  const normalized = normalizeFoundingInviteCode(code)
  return normalized ? `/founding/join#code=${encodeURIComponent(normalized)}` : "/founding/join"
}
