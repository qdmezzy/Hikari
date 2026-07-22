import { NextResponse } from "next/server"
import { FOUNDING_CAPACITY, getFoundingInviteState, isFoundingModerator } from "@/lib/founding-domain.mjs"
import {
  authenticateFoundingRequest,
  createFoundingInviteCode,
  getFoundingAdmin,
  getFoundingJoinUrl,
  hashFoundingInviteCode,
  safeFounderProfile,
} from "@/lib/server/founding"

const getSafeInvites = async (admin: ReturnType<typeof getFoundingAdmin>, userId: string, isModerator: boolean) => {
  let query = admin
    .from("founding_invites")
    .select("id, created_by, created_at, expires_at, claimed_by, claimed_at, revoked_at")
    .order("created_at", { ascending: false })
  if (!isModerator) query = query.eq("created_by", userId)
  const { data, error } = await query.limit(isModerator ? 200 : 10)
  if (error) throw error

  const profileIds = Array.from(
    new Set((data || []).flatMap((invite: any) => [invite.created_by, invite.claimed_by]).filter(Boolean)),
  )
  const { data: profiles } = profileIds.length
    ? await admin
        .from("public_profiles")
        .select("user_id, display_name, handle, avatar_url, public_profile")
        .in("user_id", profileIds)
    : { data: [] }
  const profileMap = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]))

  return (data || []).map((invite: any) => ({
    id: invite.id,
    createdAt: invite.created_at,
    expiresAt: invite.expires_at,
    claimedAt: invite.claimed_at,
    revokedAt: invite.revoked_at,
    state: getFoundingInviteState(invite),
    creator: safeFounderProfile(profileMap.get(invite.created_by)),
    claimant: invite.claimed_by ? safeFounderProfile(profileMap.get(invite.claimed_by)) : null,
  }))
}

export async function GET(request: Request) {
  const auth = await authenticateFoundingRequest(request)
  if (!auth.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  try {
    const admin = getFoundingAdmin()
    const isModerator = isFoundingModerator(auth.user)
    if (!isModerator) {
      const { data: membership } = await admin
        .from("founding_members")
        .select("active")
        .eq("user_id", auth.user.id)
        .maybeSingle()
      if (!membership?.active) return NextResponse.json({ error: "Active founding membership required." }, { status: 403 })
    }
    return NextResponse.json({ invites: await getSafeInvites(admin, auth.user.id, isModerator) })
  } catch {
    return NextResponse.json({ error: "Invitations are temporarily unavailable." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const auth = await authenticateFoundingRequest(request)
  if (!auth.user || !auth.client) return NextResponse.json({ error: "Sign in required." }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const requestedDays = Number(body?.expiresInDays || 14)
  const expiresInDays = Math.max(1, Math.min(90, Number.isFinite(requestedDays) ? requestedDays : 14))
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString()

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const code = createFoundingInviteCode()
    const codeHash = hashFoundingInviteCode(code)
    const { data, error } = await auth.client.rpc("create_founding_invite", {
      p_code_hash: codeHash,
      p_expires_at: expiresAt,
    })
    if (error) {
      if (String(error.code || "") === "23505") continue
      return NextResponse.json({ error: "Could not create the invitation." }, { status: 503 })
    }
    const result = data?.[0] || {}
    if (result.status !== "created") {
      const status = result.status === "full" || result.status === "referral_limit" ? 409 : 403
      return NextResponse.json({ state: result.status, capacity: FOUNDING_CAPACITY }, { status })
    }
    return NextResponse.json({
      state: "created",
      invite: { id: result.invite_id, expiresAt: result.expires_at },
      code,
      joinUrl: getFoundingJoinUrl(request, code),
    })
  }
  return NextResponse.json({ error: "Could not create a unique invitation." }, { status: 503 })
}

export async function DELETE(request: Request) {
  const auth = await authenticateFoundingRequest(request)
  if (!auth.user || !auth.client) return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const inviteId = String(body?.inviteId || "")
  if (!/^[0-9a-f-]{36}$/i.test(inviteId)) return NextResponse.json({ state: "not_found" }, { status: 404 })
  const { data, error } = await auth.client.rpc("revoke_founding_invite", { p_invite_id: inviteId })
  if (error) return NextResponse.json({ error: "Could not revoke the invitation." }, { status: 503 })
  const status = String(data || "not_found")
  return NextResponse.json({ state: status }, { status: status === "forbidden" ? 403 : status === "not_found" ? 404 : 200 })
}
