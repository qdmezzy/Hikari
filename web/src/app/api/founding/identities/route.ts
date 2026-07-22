import { NextResponse } from "next/server"
import { getFoundingAdmin, isMissingFoundingSchema, sanitizeFoundingHandle } from "@/lib/server/founding"

export async function GET(request: Request) {
  const handles = Array.from(
    new Set(
      (new URL(request.url).searchParams.get("handles") || "")
        .split(",")
        .map(sanitizeFoundingHandle)
        .filter(Boolean),
    ),
  ).slice(0, 50)
  if (!handles.length) return NextResponse.json({ identities: {} })

  try {
    const { data, error } = await getFoundingAdmin().rpc("get_founding_identities_for_handles", {
      requested_handles: handles,
    })
    if (error) {
      if (isMissingFoundingSchema(error)) return NextResponse.json({ identities: {} })
      throw error
    }
    const identities = Object.fromEntries(
      (data || []).map((row: any) => [row.handle, { memberNumber: Number(row.member_number) }]),
    )
    return NextResponse.json({ identities }, { headers: { "Cache-Control": "public, max-age=60" } })
  } catch {
    return NextResponse.json({ identities: {} })
  }
}
