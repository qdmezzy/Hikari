import { NextResponse } from "next/server"
import { getFoundingAdmin, isMissingFoundingSchema } from "@/lib/server/founding"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const previewState = new URL(request.url).searchParams.get("preview")
  if (process.env.FOUNDING_PREVIEW_MODE === "true" && previewState === "full") {
    return NextResponse.json({
      claimedCount: 25,
      claimedNumbers: Array.from({ length: 25 }, (_, index) => index + 1),
      members: [],
      preview: true,
    })
  }

  try {
    const admin = getFoundingAdmin()
    const [rosterResult, capacityResult] = await Promise.all([
      admin.rpc("get_founding_public_roster"),
      admin.rpc("get_founding_public_capacity"),
    ])
    const error = rosterResult.error || capacityResult.error
    if (error) {
      if (isMissingFoundingSchema(error)) {
        return NextResponse.json({ claimedCount: 0, claimedNumbers: [], members: [], setupRequired: true })
      }
      throw error
    }
    const capacity = capacityResult.data?.[0] || {}
    return NextResponse.json(
      {
        claimedCount: Number(capacity.claimed_count || 0),
        claimedNumbers: capacity.claimed_numbers || [],
        members: (rosterResult.data || []).map((member: any) => ({
          memberNumber: Number(member.member_number),
          displayName: member.display_name,
          handle: member.handle,
          avatarUrl: member.avatar_url || null,
          joinedAt: member.joined_at || null,
        })),
      },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    )
  } catch {
    return NextResponse.json({ error: "The Founding 25 roster is temporarily unavailable." }, { status: 503 })
  }
}
