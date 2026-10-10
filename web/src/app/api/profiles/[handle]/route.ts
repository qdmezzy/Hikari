import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { calculatePublicStats } from "@/lib/public-profile-stats.mjs"

const noStore = { "Cache-Control": "private, no-store, max-age=0" }

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
  if (!handle) return NextResponse.json({ state: "missing" }, { status: 404, headers: noStore })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Profile service is not configured." }, { status: 503, headers: noStore })
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
    return NextResponse.json({ error: "Profile service is temporarily unavailable." }, { status: 503, headers: noStore })
  }
  const profile = result.data as Record<string, any> | null
  if (!profile) return NextResponse.json({ state: "missing" }, { status: 404, headers: noStore })
  if (!legacySchema && profile.public_profile === false) {
    return NextResponse.json(
      { state: "private" },
      { status: 403, headers: noStore },
    )
  }

  const { data: foundingMember } = await admin
    .from("founding_members")
    .select("member_number, active")
    .eq("user_id", profile.user_id)
    .maybeSingle()
  profile.founding_member_number = foundingMember?.active ? Number(foundingMember.member_number) : null

  if (profile.show_stats !== false && profile.show_watch_activity === false) {
    const entries: Record<string, any>[] = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin
        .from("list_entries")
        .select("status,progress,score,media_type,created_at,updated_at,finished_at,hide_from_profile")
        .eq("user_id", profile.user_id)
        .range(offset, offset + 999)
      if (error) return NextResponse.json({ error: "Profile statistics are temporarily unavailable." }, { status: 503, headers: noStore })
      entries.push(...(data || []))
      if (!data || data.length < 1000) break
    }
    profile.shared_stats = calculatePublicStats(entries)
  }

  return NextResponse.json(
    { state: "public", profile },
    { headers: noStore },
  )
}
