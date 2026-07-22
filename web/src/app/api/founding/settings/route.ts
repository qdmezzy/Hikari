import { NextResponse } from "next/server"
import { authenticateFoundingRequest } from "@/lib/server/founding"

export async function PATCH(request: Request) {
  const auth = await authenticateFoundingRequest(request)
  if (!auth.user || !auth.client) return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (typeof body?.showOnFoundersPage !== "boolean") {
    return NextResponse.json({ error: "A listing preference is required." }, { status: 400 })
  }
  const { data, error } = await auth.client.rpc("set_founding_listing", {
    p_show: body.showOnFoundersPage,
  })
  if (error) return NextResponse.json({ error: "Could not update the listing preference." }, { status: 503 })
  return NextResponse.json({ state: data })
}
