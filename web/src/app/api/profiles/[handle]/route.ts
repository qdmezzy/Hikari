import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const PROFILE_FIELDS = [
  "user_id",
  "handle",
  "display_name",
  "avatar_url",
  "banner_url",
  "bio",
  "location",
  "website",
  "joined_at",
  "show_online_status",
  "show_watch_activity",
  "show_favorites",
  "favorite_media_ids",
  "show_stats",
  "public_profile",
  "created_at",
].join(",")

const LEGACY_PROFILE_FIELDS = PROFILE_FIELDS
  .split(",")
  .filter((field) => !["show_stats", "public_profile"].includes(field))
  .join(",")

const normalizeHandle = (value: string) =>
  String(value || "").replace(/^@/, "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "")

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle: rawHandle } = await params
  const handle = normalizeHandle(rawHandle)
  if (!handle) return NextResponse.json({ state: "missing" }, { status: 404 })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Profile service is not configured." }, { status: 503 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let result = await admin.from("public_profiles").select(PROFILE_FIELDS).eq("handle", handle).maybeSingle()
  let legacySchema = false
  if (result.error && ["42703", "PGRST204"].includes(String(result.error.code || ""))) {
    legacySchema = true
    result = await admin.from("public_profiles").select(LEGACY_PROFILE_FIELDS).eq("handle", handle).maybeSingle()
  }

  if (result.error) {
    return NextResponse.json({ error: "Profile service is temporarily unavailable." }, { status: 503 })
  }
  const profile = result.data as Record<string, any> | null
  if (!profile) return NextResponse.json({ state: "missing" }, { status: 404 })
  if (!legacySchema && profile.public_profile === false) {
    return NextResponse.json(
      { state: "private" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    )
  }

  const { data: foundingMember } = await admin
    .from("founding_members")
    .select("member_number, active")
    .eq("user_id", profile.user_id)
    .maybeSingle()
  profile.founding_member_number = foundingMember?.active ? Number(foundingMember.member_number) : null

  return NextResponse.json(
    { state: "public", profile },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  )
}
