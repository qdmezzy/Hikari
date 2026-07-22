import { ImageResponse } from "next/og"
import { createClient } from "@supabase/supabase-js"

export const alt = "Hikari profile"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const normalizeHandle = (value: string) =>
  String(value || "").replace(/^@/, "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "")

export default async function ProfileOg({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  let name = handle || "Anime fan"
  let displayHandle = normalizeHandle(handle) || "user"
  const stats = { total: 0, completed: 0, watching: 0 }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    if (url && key) {
      const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      const { data: profile } = await sb
        .from("public_profiles")
        .select("user_id, display_name, handle, public_profile")
        .eq("handle", displayHandle)
        .eq("public_profile", true)
        .maybeSingle()

      if (profile) {
        name = profile.display_name || profile.handle || name
        displayHandle = profile.handle || displayHandle
        const { data: entries } = await sb
          .from("list_entries")
          .select("status")
          .eq("user_id", profile.user_id)
          .limit(5000)
        if (entries) {
          stats.total = entries.length
          stats.completed = entries.filter((e: any) => e.status === "completed").length
          stats.watching = entries.filter((e: any) => ["watching", "rewatching"].includes(e.status)).length
        }
      }
    }
  } catch {
    /* fall back to defaults */
  }

  const initial = (name || "H").charAt(0).toUpperCase()
  const tile = (label: string, value: number) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "22px 34px",
        borderRadius: 20,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ display: "flex", fontSize: 56, fontWeight: 800, color: "#fff" }}>{value}</div>
      <div style={{ display: "flex", fontSize: 22, color: "#9aa6b8" }}>{label}</div>
    </div>
  )

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #0e131c 0%, #141b27 55%, #0b1018 100%)",
          color: "#e6ebf2",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 132,
              height: 132,
              borderRadius: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #faf0c7, #f3d36b)",
              fontSize: 70,
              fontWeight: 800,
              color: "#171a40",
            }}
          >
            {initial}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 60, fontWeight: 800, color: "#fff" }}>{name}</div>
            <div style={{ display: "flex", fontSize: 30, color: "#5b6b85" }}>@{displayHandle}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 22 }}>
          {tile("Total", stats.total)}
          {tile("Completed", stats.completed)}
          {tile("Watching", stats.watching)}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 30, color: "#9aa6b8" }}>See my anime on Hikari</div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: "#faf0c7" }}>Hikari</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
