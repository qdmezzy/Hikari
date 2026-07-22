import { NextResponse } from "next/server"
import { FOUNDING_CAPACITY, getFoundingInviteState } from "@/lib/founding-domain.mjs"
import { getFoundingAdmin, requireFoundingModerator, safeFounderProfile, sanitizeFoundingHandle } from "@/lib/server/founding"
import { syncFoundingRoleForHikariUser } from "@/lib/server/discord-founding-role"

const forbidden = () => NextResponse.json({ error: "Moderator access required." }, { status: 403 })

const loadDashboard = async (query = "") => {
  const admin = getFoundingAdmin()
  const [{ data: members }, { data: invites }, { data: proposals }, { data: votes }] = await Promise.all([
    admin.from("founding_members").select("user_id, member_number, joined_at, active, show_on_founders_page").order("member_number"),
    admin
      .from("founding_invites")
      .select("id, created_by, created_at, expires_at, claimed_by, claimed_at, revoked_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("founding_feature_proposals")
      .select("id, title, description, status, created_at, updated_at")
      .order("created_at", { ascending: false }),
    admin.from("founding_feature_votes").select("proposal_id, support"),
  ])

  const profileIds = Array.from(
    new Set([
      ...(members || []).map((row: any) => row.user_id),
      ...(invites || []).flatMap((row: any) => [row.created_by, row.claimed_by]).filter(Boolean),
    ]),
  )
  const { data: profiles } = profileIds.length
    ? await admin
        .from("public_profiles")
        .select("user_id, display_name, handle, avatar_url, public_profile")
        .in("user_id", profileIds)
    : { data: [] }
  const profileMap = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]))

  const normalizedQuery = sanitizeFoundingHandle(query)
  const { data: searchResults } = normalizedQuery
    ? await admin
        .from("public_profiles")
        .select("display_name, handle, avatar_url, public_profile")
        .ilike("handle", `%${normalizedQuery}%`)
        .limit(10)
    : { data: [] }

  return {
    capacity: FOUNDING_CAPACITY,
    claimedCount: (members || []).length,
    members: (members || []).map((row: any) => ({
      memberNumber: Number(row.member_number),
      joinedAt: row.joined_at,
      active: row.active,
      showOnFoundersPage: row.show_on_founders_page,
      profile: safeFounderProfile(profileMap.get(row.user_id)),
    })),
    invites: (invites || []).map((row: any) => ({
      id: row.id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      claimedAt: row.claimed_at,
      revokedAt: row.revoked_at,
      state: getFoundingInviteState(row),
      creator: safeFounderProfile(profileMap.get(row.created_by)),
      claimant: row.claimed_by ? safeFounderProfile(profileMap.get(row.claimed_by)) : null,
    })),
    proposals: (proposals || []).map((proposal: any) => {
      const proposalVotes = (votes || []).filter((vote: any) => vote.proposal_id === proposal.id)
      return {
        id: proposal.id,
        title: proposal.title,
        description: proposal.description,
        status: proposal.status,
        createdAt: proposal.created_at,
        updatedAt: proposal.updated_at,
        supportCount: proposalVotes.filter((vote: any) => vote.support === true).length,
        opposeCount: proposalVotes.filter((vote: any) => vote.support === false).length,
      }
    }),
    searchResults: (searchResults || []).map((profile: any) => safeFounderProfile(profile)),
  }
}
export async function GET(request: Request) {
  const auth = await requireFoundingModerator(request)
  if (!auth.user || !auth.isModerator) return forbidden()
  try {
    return NextResponse.json(await loadDashboard(new URL(request.url).searchParams.get("q") || ""))
  } catch {
    return NextResponse.json({ error: "Founding management is temporarily unavailable." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const auth = await requireFoundingModerator(request)
  if (!auth.user || !auth.client || !auth.isModerator) return forbidden()
  const body = await request.json().catch(() => ({}))
  const action = String(body?.action || "")
  const admin = getFoundingAdmin()

  try {
    if (action === "grant") {
      const handle = sanitizeFoundingHandle(body?.handle)
      const { data, error } = await auth.client.rpc("grant_founding_member", { p_handle: handle })
      if (error) throw error
      const result = data?.[0] || {}
      if (result.status === "granted") {
        const { data: profile } = await admin.from("public_profiles").select("user_id").eq("handle", handle).maybeSingle()
        if (profile?.user_id) await syncFoundingRoleForHikariUser(admin, profile.user_id)
      }
      return NextResponse.json({ state: result.status, memberNumber: result.member_number || null })
    }

    if (action === "set-member-active") {
      const memberNumber = Number(body?.memberNumber)
      if (!Number.isInteger(memberNumber) || memberNumber < 1 || memberNumber > FOUNDING_CAPACITY) {
        return NextResponse.json({ error: "Invalid member number." }, { status: 400 })
      }
      const { data: member, error } = await admin
        .from("founding_members")
        .update({ active: body?.active === true })
        .eq("member_number", memberNumber)
        .select("user_id")
        .single()
      if (error) throw error
      const roleSync = await syncFoundingRoleForHikariUser(admin, member.user_id)
      return NextResponse.json({ state: "updated", roleSync: roleSync.status })
    }

    if (action === "create-proposal") {
      const title = String(body?.title || "").trim().slice(0, 120)
      const description = String(body?.description || "").trim().slice(0, 2000)
      if (title.length < 3) return NextResponse.json({ error: "Proposal title is too short." }, { status: 400 })
      const { data, error } = await admin
        .from("founding_feature_proposals")
        .insert({ title, description, status: "draft", created_by: auth.user.id })
        .select("id, title, description, status, created_at")
        .single()
      if (error) throw error
      return NextResponse.json({ state: "created", proposal: data })
    }

    if (action === "update-proposal") {
      const proposalId = String(body?.proposalId || "")
      const status = String(body?.status || "")
      if (!/^[0-9a-f-]{36}$/i.test(proposalId) || !["draft", "active", "closed", "archived"].includes(status)) {
        return NextResponse.json({ error: "Invalid proposal update." }, { status: 400 })
      }
      const { error } = await admin.from("founding_feature_proposals").update({ status }).eq("id", proposalId)
      if (error) throw error
      return NextResponse.json({ state: "updated" })
    }

    return NextResponse.json({ error: "Unknown founding management action." }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "The founding action could not be completed." }, { status: 503 })
  }
}
