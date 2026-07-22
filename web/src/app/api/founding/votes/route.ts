import { NextResponse } from "next/server"
import { authenticateFoundingRequest } from "@/lib/server/founding"

const readProposalId = (body: any) => {
  const id = String(body?.proposalId || "")
  return /^[0-9a-f-]{36}$/i.test(id) ? id : ""
}

export async function PUT(request: Request) {
  const auth = await authenticateFoundingRequest(request)
  if (!auth.user || !auth.client) return NextResponse.json({ state: "unauthenticated" }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const proposalId = readProposalId(body)
  if (!proposalId || typeof body?.support !== "boolean") {
    return NextResponse.json({ state: "invalid" }, { status: 400 })
  }
  const { data, error } = await auth.client.rpc("cast_founding_vote", {
    p_proposal_id: proposalId,
    p_support: body.support,
  })
  if (error) return NextResponse.json({ state: "unavailable" }, { status: 503 })
  const state = String(data || "unavailable")
  return NextResponse.json({ state }, { status: state === "forbidden" ? 403 : state === "proposal_unavailable" ? 409 : 200 })
}

export async function DELETE(request: Request) {
  const auth = await authenticateFoundingRequest(request)
  if (!auth.user || !auth.client) return NextResponse.json({ state: "unauthenticated" }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const proposalId = readProposalId(body)
  if (!proposalId) return NextResponse.json({ state: "invalid" }, { status: 400 })
  const { data, error } = await auth.client.rpc("remove_founding_vote", { p_proposal_id: proposalId })
  if (error) return NextResponse.json({ state: "unavailable" }, { status: 503 })
  return NextResponse.json({ state: String(data || "unavailable") })
}
