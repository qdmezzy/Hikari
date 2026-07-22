import { NextResponse } from "next/server"
import { authenticateFoundingRequest, hashFoundingInviteCode } from "@/lib/server/founding"
import { getFoundingAdmin } from "@/lib/server/founding"
import { syncFoundingRoleForHikariUser } from "@/lib/server/discord-founding-role"

export async function POST(request: Request) {
  const auth = await authenticateFoundingRequest(request)
  if (!auth.user || !auth.client) return NextResponse.json({ state: "unauthenticated" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const codeHash = hashFoundingInviteCode(body?.code)
  if (!codeHash) return NextResponse.json({ state: "invalid" }, { status: 400 })

  const { data, error } = await auth.client.rpc("claim_founding_invite", { p_code_hash: codeHash })
  if (error) return NextResponse.json({ state: "unavailable" }, { status: 503 })
  const result = data?.[0] || { status: "unavailable", member_number: null }

  if (result.status === "claimed") {
    let roleSync = "not_configured"
    try {
      const admin = getFoundingAdmin()
      roleSync = (await syncFoundingRoleForHikariUser(admin, auth.user.id)).status
    } catch {
      // Membership is already committed. Discord sync is intentionally
      // best-effort and can be retried by a moderator or the bot at startup.
    }
    return NextResponse.json({ state: "claimed", memberNumber: Number(result.member_number), roleSync })
  }
  const statusCode = result.status === "unauthenticated" ? 401 : result.status === "full" ? 409 : 400
  return NextResponse.json({ state: result.status }, { status: statusCode })
}
