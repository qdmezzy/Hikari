import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Your media API. The app calls this for media-by-ids hydration instead of
// AniList directly. It serves from the media_cache table first and only hits
// AniList for misses / stale rows, then caches what it fetched. This is the
// single seam you can later point at your own synced catalog.

const MEDIA_TTL_MS = 1000 * 60 * 60 * 24 // 24h — covers/titles/genres are stable

const MEDIA_BY_IDS_QUERY = `
query ($ids: [Int], $perPage: Int) {
  Page(perPage: $perPage) {
    media(id_in: $ids, sort: POPULARITY_DESC) {
      id
      type
      title { romaji english native }
      coverImage { extraLarge large color }
      bannerImage
      episodes
      duration
      chapters
      nextAiringEpisode { episode airingAt }
      averageScore
      status
      genres
      trailer { id site }
      popularity
      favourites
      description(asHtml: false)
      startDate { year month day }
      studios(isMain: true) { nodes { name } }
      externalLinks { site url type }
    }
  }
}
`

const readFirstEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim()
    if (value) return value
  }
  return ""
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const fetchFromAniList = async (ids: number[]) => {
  const all: any[] = []
  for (const batch of chunk(ids, 50)) {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: MEDIA_BY_IDS_QUERY, variables: { ids: batch, perPage: batch.length } }),
    })
    if (!res.ok) continue
    const json = await res.json().catch(() => null)
    const media = json?.data?.Page?.media
    if (Array.isArray(media)) all.push(...media)
  }
  return all
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const ids = Array.from(
      new Set((Array.isArray(body?.ids) ? body.ids : []).map((v: unknown) => Number(v)).filter(Number.isFinite)),
    ) as number[]
    if (!ids.length) return NextResponse.json({ media: [] })

    const url = readFirstEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
    const serviceKey = readFirstEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY")

    // If the cache isn't configured, just proxy AniList so the app still works.
    if (!url || !serviceKey) {
      return NextResponse.json({ media: await fetchFromAniList(ids) })
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

    // 1) Read the cache.
    const cached = new Map<number, any>()
    try {
      const { data: rows } = await admin
        .from("media_cache")
        .select("media_id, data, fetched_at")
        .in("media_id", ids)
      const now = Date.now()
      ;(rows || []).forEach((row: any) => {
        const fresh = now - new Date(row.fetched_at).getTime() < MEDIA_TTL_MS
        if (fresh && row.data) cached.set(Number(row.media_id), row.data)
      })
    } catch {
      /* cache table may not exist yet — fall through to AniList */
    }

    // 2) Fetch misses from AniList and write them back to the cache.
    const missing = ids.filter((id) => !cached.has(id))
    let fetched: any[] = []
    if (missing.length) {
      fetched = await fetchFromAniList(missing)
      if (fetched.length) {
        const upsertRows = fetched
          .filter((m) => Number.isFinite(m?.id))
          .map((m) => ({ media_id: m.id, data: m, fetched_at: new Date().toISOString() }))
        try {
          await admin.from("media_cache").upsert(upsertRows, { onConflict: "media_id" })
        } catch {
          /* non-fatal — still return the data */
        }
      }
    }

    return NextResponse.json({ media: [...cached.values(), ...fetched] })
  } catch (err) {
    return NextResponse.json({ error: "media endpoint failed", details: String(err) }, { status: 500 })
  }
}
