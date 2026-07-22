import { NextResponse } from "next/server"
import { FOUNDING_CAPACITY, getFoundingInviteState } from "@/lib/founding-domain.mjs"
import { getFoundingAdmin, hashFoundingInviteCode, safeFounderProfile } from "@/lib/server/founding"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    if (process.env.FOUNDING_PREVIEW_MODE === "true") {
      if (body?.code === "Founding25PreviewInviteCode") {
        return NextResponse.json({
          state: "valid",
          expiresAt: "2099-12-31T23:59:59.000Z",
          inviter: { displayName: "Hikari Team", handle: "hikari", avatarUrl: null, publicProfile: true },
          invitedByTeam: true,
          claimedCount: 7,
          capacity: FOUNDING_CAPACITY,
          preview: true,
        })
      }
      if (body?.code === "Founding25PreviewFullInvite") {
        return NextResponse.json({ state: "full", claimedCount: FOUNDING_CAPACITY, capacity: FOUNDING_CAPACITY, preview: true })
      }
    }
    const codeHash = hashFoundingInviteCode(body?.code)
    if (!codeHash) return NextResponse.json({ state: "invalid" })

    const admin = getFoundingAdmin()
    const [{ data: invite, error }, { count }] = await Promise.all([
      admin
        .from("founding_invites")
        .select("created_by, expires_at, claimed_at, revoked_at")
        .eq("code_hash", codeHash)
        .maybeSingle(),
      admin.from("founding_members").select("member_number", { count: "exact", head: true }),
    ])
    if (error) throw error
    const state = getFoundingInviteState(invite, { claimedCount: count || 0 })
    if (state !== "valid") return NextResponse.json({ state, claimedCount: count || 0, capacity: FOUNDING_CAPACITY })

    const { data: inviterMembership } = await admin
      .from("founding_members")
      .select("user_id, active, show_on_founders_page")
      .eq("user_id", invite.created_by)
      .maybeSingle()

    let inviter = null
    if (inviterMembership?.active) {
      const { data: profile } = await admin
        .from("public_profiles")
        .select("display_name, handle, avatar_url, public_profile")
        .eq("user_id", invite.created_by)
        .maybeSingle()
      if (profile?.public_profile) inviter = safeFounderProfile(profile)
    }

    return NextResponse.json({
      state: "valid",
      expiresAt: invite.expires_at,
      inviter,
      invitedByTeam: !inviterMembership,
      claimedCount: count || 0,
      capacity: FOUNDING_CAPACITY,
    })
  } catch {
    return NextResponse.json({ state: "unavailable" }, { status: 503 })
  }
}
