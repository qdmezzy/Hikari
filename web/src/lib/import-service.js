import client from "@/lib/client"

// Reusable list-import logic (AniList username + connected MyAnimeList).
// Mirrors the manual /import page but packaged for the onboarding flow.

const STATUS_MAP = {
  CURRENT: "watching",
  COMPLETED: "completed",
  PAUSED: "on_hold",
  DROPPED: "dropped",
  PLANNING: "plan_to_watch",
  REPEATING: "rewatching",
}

const MAL_STATUS_MAP = {
  watching: "watching",
  completed: "completed",
  on_hold: "on_hold",
  dropped: "dropped",
  plan_to_watch: "plan_to_watch",
  reading: "watching",
  plan_to_read: "plan_to_watch",
  rereading: "rewatching",
  rewatching: "rewatching",
}

const ALLOWED_STATUSES = new Set([
  "watching",
  "completed",
  "rewatching",
  "dropped",
  "on_hold",
  "plan_to_watch",
])

const ANILIST_LIST_QUERY = `
query ($userName: String, $type: MediaType) {
  MediaListCollection(userName: $userName, type: $type) {
    user { mediaListOptions { scoreFormat } }
    lists {
      status
      entries {
        status
        progress
        score
        startedAt { year month day }
        completedAt { year month day }
        media { id type }
      }
    }
  }
}
`

// AniList fuzzy dates → ISO date string (or null if incomplete).
const fuzzyDateToISO = (date) => {
  if (!date?.year || !date?.month || !date?.day) return null
  const mm = String(date.month).padStart(2, "0")
  const dd = String(date.day).padStart(2, "0")
  return `${date.year}-${mm}-${dd}`
}

// "YYYY-MM-DD" (MAL) → ISO date string, else null.
const malDateToISO = (value) => {
  if (!value || typeof value !== "string") return null
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null
}

// AniList returns scores in the user's chosen format; normalize everything to 1-10.
const aniListScoreTo10 = (score, format) => {
  const value = Number(score)
  if (!Number.isFinite(value) || value <= 0) return null
  switch (format) {
    case "POINT_100":
      return Math.round(value / 10)
    case "POINT_5":
      return Math.round(value * 2)
    case "POINT_3":
      return value >= 3 ? 10 : value === 2 ? 7 : 3
    case "POINT_10_DECIMAL":
    case "POINT_10":
    default:
      return Math.round(value)
  }
}

const MAL_MAPPING_QUERY = `
query ($ids: [Int], $type: MediaType) {
  Page(perPage: 50) { media(idMal_in: $ids, type: $type) { id idMal } }
}
`

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const mapStatus = (raw, fallback = "plan_to_watch") => {
  if (!raw) return fallback
  const direct = STATUS_MAP[raw]
  if (direct) return direct
  const normalized = String(raw).trim()
  return MAL_STATUS_MAP[normalized] || MAL_STATUS_MAP[normalized.toLowerCase()] || fallback
}

const normalizeStatus = (status, fallback = "watching") =>
  status && ALLOWED_STATUSES.has(status) ? status : fallback

const normalizeScore = (score) => {
  if (!Number.isFinite(score)) return null
  if (score > 10 && score <= 100) return Math.round(score / 10)
  if (score > 20 && score <= 1000) return Math.round(score / 100)
  return Math.round(score)
}

const dedupe = (entries) => {
  const map = new Map()
  entries.forEach((e) => {
    if (!e?.mediaId || !e?.mediaType) return
    map.set(`${e.mediaId}-${e.mediaType}`, e)
  })
  return Array.from(map.values())
}

const anilistRequest = async (query, variables) => {
  const res = await fetch("/api/anilist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (!res.ok || json?.errors) {
    throw new Error(json?.errors?.[0]?.message || "AniList request failed.")
  }
  return json?.data
}

const extractAniListEntries = (payload, typeOverride) => {
  const scoreFormat = payload?.MediaListCollection?.user?.mediaListOptions?.scoreFormat || "POINT_10"
  const lists = payload?.MediaListCollection?.lists || []
  const entries = []
  lists.forEach((list) => {
    ;(list?.entries || []).forEach((entry) => {
      const media = entry?.media || {}
      const mediaId = media?.id
      const mediaType = media?.type || typeOverride
      if (!mediaId || !mediaType) return
      entries.push({
        mediaId,
        mediaType,
        status: mapStatus(entry?.status || list?.status),
        progress: Number(entry?.progress) || 0,
        score: aniListScoreTo10(entry?.score, scoreFormat),
        startedAt: fuzzyDateToISO(entry?.startedAt),
        finishedAt: fuzzyDateToISO(entry?.completedAt),
      })
    })
  })
  return entries
}

const mapMalIdsToAniList = async (ids, type) => {
  const map = new Map()
  for (const batch of chunk(ids, 50)) {
    const data = await anilistRequest(MAL_MAPPING_QUERY, { ids: batch, type })
    ;(data?.Page?.media || []).forEach((item) => {
      if (Number.isFinite(item?.idMal) && Number.isFinite(item?.id)) map.set(item.idMal, item.id)
    })
  }
  return map
}

const resolveMalEntries = async (entries) => {
  const grouped = { ANIME: [], MANGA: [] }
  entries.forEach((e) => {
    if (grouped[e.mediaType]) grouped[e.mediaType].push(e)
  })

  const resolved = []
  let unmatched = 0
  for (const type of ["ANIME", "MANGA"]) {
    const list = grouped[type]
    if (!list.length) continue
    const idMap = await mapMalIdsToAniList(list.map((e) => e.sourceId), type)
    list.forEach((e) => {
      const mediaId = idMap.get(e.sourceId)
      if (mediaId) {
        resolved.push({
          mediaId,
          mediaType: e.mediaType,
          status: mapStatus(e.status),
          progress: e.progress,
          score: e.score,
          startedAt: e.startedAt,
          finishedAt: e.finishedAt,
        })
      } else {
        unmatched += 1
      }
    })
  }
  return { resolved, unmatched }
}

const upsertEntries = async (userId, entries, onProgress) => {
  const normalized = dedupe(entries)
  if (!normalized.length) return { total: 0, anime: 0, manga: 0 }

  const payload = normalized.map((e) => ({
    user_id: userId,
    media_id: e.mediaId,
    media_type: e.mediaType,
    status: normalizeStatus(e.status || "plan_to_watch"),
    progress: Number(e.progress) || 0,
    score: normalizeScore(Number(e.score)),
    started_at: e.startedAt || null,
    finished_at: e.finishedAt || null,
  }))

  let processed = 0
  for (const batch of chunk(payload, 100)) {
    const { error } = await client.from("list_entries").upsert(batch, { onConflict: "user_id,media_id" })
    if (error) throw new Error(error.message || "Could not save imported entries.")
    processed += batch.length
    onProgress?.(Math.round((processed / payload.length) * 100))
  }

  return {
    total: normalized.length,
    anime: normalized.filter((e) => e.mediaType === "ANIME").length,
    manga: normalized.filter((e) => e.mediaType === "MANGA").length,
  }
}

/** Import an AniList user's anime + manga lists by username. */
export const importFromAniListUsername = async ({ userId, username, onProgress }) => {
  if (!userId) throw new Error("You must be signed in.")
  const name = String(username || "").trim()
  if (!name) throw new Error("Enter an AniList username.")

  const [animeData, mangaData] = await Promise.all([
    anilistRequest(ANILIST_LIST_QUERY, { userName: name, type: "ANIME" }),
    anilistRequest(ANILIST_LIST_QUERY, { userName: name, type: "MANGA" }).catch(() => null),
  ])

  const entries = [
    ...extractAniListEntries(animeData, "ANIME"),
    ...(mangaData ? extractAniListEntries(mangaData, "MANGA") : []),
  ]
  if (!entries.length) throw new Error("No public lists found for that username.")

  const summary = await upsertEntries(userId, entries, onProgress)
  return { ...summary, unmatched: 0 }
}

/** Import the currently connected MyAnimeList account's list. */
export const importFromMal = async ({ userId, onProgress }) => {
  if (!userId) throw new Error("You must be signed in.")
  const res = await fetch("/api/mal/list")
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || "Failed to fetch your MAL list.")

  const entries = (json?.entries || []).map((entry) => ({
    sourceId: entry.sourceId,
    mediaType: entry.mediaType,
    status: entry.status,
    progress: entry.progress,
    score: entry.score,
    startedAt: malDateToISO(entry.startDate),
    finishedAt: malDateToISO(entry.finishDate),
  }))
  if (!entries.length) throw new Error("Your MAL list looks empty.")

  const { resolved, unmatched } = await resolveMalEntries(entries)
  const summary = await upsertEntries(userId, resolved, onProgress)
  return { ...summary, unmatched }
}
