import { NextResponse } from "next/server"
import { FOUNDING_REFERRAL_LIMIT } from "@/lib/founding-domain.mjs"
import { authenticateFoundingRequest, getFoundingAdmin, isMissingFoundingSchema, safeFounderProfile } from "@/lib/server/founding"

export async function GET(request: Request) {
  const auth = await authenticateFoundingRequest(request)
  if (!auth.user) return NextResponse.json({ member: null }, { status: 401 })

  try {
    const admin = getFoundingAdmin()
    const { data: membership, error } = await admin
      .from("founding_members")
      .select("member_number, joined_at, active, show_on_founders_page")
      .eq("user_id", auth.user.id)
      .maybeSingle()
    if (error) {
      if (isMissingFoundingSchema(error)) return NextResponse.json({ member: null, setupRequired: true })
      throw error
    }
    if (!membership) return NextResponse.json({ member: null })

    const [{ data: profile }, { data: proposals }, { data: votes }, { count: inviteCount }, { data: link }] = await Promise.all([
      admin
        .from("public_profiles")
        .select("display_name, handle, avatar_url, public_profile")
        .eq("user_id", auth.user.id)
        .maybeSingle(),
      admin
        .from("founding_feature_proposals")
        .select("id, title, description, status, created_at")
        .in("status", ["active", "closed"])
        .order("created_at", { ascending: false }),
      admin.from("founding_feature_votes").select("proposal_id, user_id, support"),
      admin.from("founding_invites").select("id", { count: "exact", head: true }).eq("created_by", auth.user.id),
      admin.from("discord_links").select("discord_user_id").eq("hikari_user_id", auth.user.id).maybeSingle(),
    ])

    const proposalRows = (proposals || []).map((proposal: any) => {
      const proposalVotes = (votes || []).filter((vote: any) => vote.proposal_id === proposal.id)
      const supportCount = proposalVotes.filter((vote: any) => vote.support === true).length
      const opposeCount = proposalVotes.filter((vote: any) => vote.support === false).length
      const ownVote = proposalVotes.find((vote: any) => vote.user_id === auth.user?.id)
      return {
        id: proposal.id,
        title: proposal.title,
        description: proposal.description,
        status: proposal.status,
        createdAt: proposal.created_at,
        supportCount,
        opposeCount,
        totalVotes: proposalVotes.length,
        ownVote: ownVote ? ownVote.support : null,
      }
    })

    return NextResponse.json({
      member: {
        memberNumber: Number(membership.member_number),
        joinedAt: membership.joined_at,
        active: membership.active,
        showOnFoundersPage: membership.show_on_founders_page,
        profile: safeFounderProfile(profile),
      },
      proposals: membership.active ? proposalRows : [],
      referralsRemaining: membership.active ? Math.max(0, FOUNDING_REFERRAL_LIMIT - Number(inviteCount || 0)) : 0,
      discordLinked: Boolean(link?.discord_user_id),
    })
  } catch {
    return NextResponse.json({ error: "Founding membership is temporarily unavailable." }, { status: 503 })
  }
}
