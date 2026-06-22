import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Public status endpoint. Checks the live services + data sources, reports the
// catalog size (rows in media_cache), the bot heartbeat, and recent incidents.
// Everything degrades gracefully: missing tables/envs never throw.

export const dynamic = "force-dynamic"

const BOT_STALE_MS = 1000 * 60 * 5 // heartbeat older than 5m => bot down

const readFirstEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim()
    if (value) return value
  }
  return ""
}

type Probe = { ok: boolean; ms: number; status: number }

const timedFetch = async (url: string, opts: RequestInit = {}, timeoutMs = 6000): Promise<Probe> => {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, cache: "no-store" })
    return { ok: res.ok, ms: Date.now() - start, status: res.status }
  } catch {
    return { ok: false, ms: Date.now() - start, status: 0 }
  } finally {
    clearTimeout(timer)
  }
}

export async function GET() {
  const url = readFirstEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
  const serviceKey = readFirstEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY")
  const admin =
    url && serviceKey
      ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : null

  // External data sources — checked in parallel.
  const [anilist, mangadex] = await Promise.all([
    timedFetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: "{ Media(id: 1) { id } }" }),
    }),
    timedFetch("https://api.mangadex.org/ping", { method: "GET" }),
  ])

  let database: Probe = { ok: false, ms: 0, status: 0 }
  let catalogCount: number | null = null
  let botStatus: "operational" | "down" | "unknown" = "unknown"
  let botLastSeen: string | null = null
  let incidents: Array<Record<string, unknown>> = []

  if (admin) {
    const dbStart = Date.now()
    try {
      const { count, error } = await admin
        .from("media_cache")
        .select("media_id", { count: "exact", head: true })
      database = { ok: !error, ms: Date.now() - dbStart, status: error ? 0 : 200 }
      if (!error) catalogCount = count ?? null
    } catch {
      database = { ok: false, ms: Date.now() - dbStart, status: 0 }
    }

    try {
      const { data } = await admin
        .from("service_heartbeats")
        .select("last_seen")
        .eq("service", "discord-bot")
        .maybeSingle()
      if (data?.last_seen) {
        botLastSeen = data.last_seen as string
        const age = Date.now() - new Date(data.last_seen as string).getTime()
        botStatus = age < BOT_STALE_MS ? "operational" : "down"
      }
    } catch {
      /* table may not exist yet */
    }

    try {
      const { data } = await admin
        .from("status_incidents")
        .select("id, created_at, severity, title, body, resolved, resolved_at")
        .order("created_at", { ascending: false })
        .limit(10)
      incidents = data || []
    } catch {
      /* table may not exist yet */
    }
  }

  const services = [
    { id: "web", label: "Website", status: "operational" as const, ms: null as number | null },
    { id: "bot", label: "Discord Bot", status: botStatus, ms: null, lastSeen: botLastSeen },
    { id: "database", label: "Database", status: database.ok ? "operational" : "down", ms: database.ms },
    { id: "anilist", label: "AniList · anime data", status: anilist.ok ? "operational" : "down", ms: anilist.ms },
    { id: "mangadex", label: "MangaDex · manga data", status: mangadex.ok ? "operational" : "down", ms: mangadex.ms },
  ]

  const anyDown = services.some((s) => s.status === "down")
  const overall: "operational" | "degraded" = anyDown ? "degraded" : "operational"

  return NextResponse.json(
    { updatedAt: new Date().toISOString(), overall, services, catalogCount, incidents },
    { headers: { "Cache-Control": "no-store" } },
  )
}
