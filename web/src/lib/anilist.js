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
      chapters
      nextAiringEpisode { episode airingAt }
      averageScore
      status
      genres
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

const STREAMING_SITE_PRIORITY = [
  "Crunchyroll",
  "Netflix",
  "Hulu",
  "HIDIVE",
  "Funimation",
  "Amazon Prime Video",
  "Disney Plus",
  "Max",
  "Bilibili",
  "Apple TV",
  "YouTube",
]

export const chunkIds = (ids = [], size = 50) => {
  const batches = []
  for (let index = 0; index < ids.length; index += size) {
    batches.push(ids.slice(index, index + size))
  }
  return batches
}

export const fetchAniList = async (query, variables = {}) => {
  const response = await fetch("/api/anilist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  })

  const json = await response.json().catch(() => ({}))
  if (!response.ok || json?.errors) {
    throw new Error(json?.errors?.[0]?.message || "Failed to load AniList data")
  }

  return json?.data
}

// Media metadata (covers/titles/etc.) is stable, so cache it per session to
// avoid refetching the same titles on every navigation.
const mediaCache = new Map()
const MEDIA_CACHE_KEY = "hikari:media-cache:v1"
const MEDIA_CACHE_CAP = 400
let mediaCacheHydrated = false

const hydrateMediaCache = () => {
  if (mediaCacheHydrated || typeof window === "undefined") return
  mediaCacheHydrated = true
  try {
    const raw = window.sessionStorage.getItem(MEDIA_CACHE_KEY)
    if (raw) {
      const obj = JSON.parse(raw)
      Object.entries(obj).forEach(([id, media]) => mediaCache.set(Number(id), media))
    }
  } catch {
    /* ignore */
  }
}

const persistMediaCache = () => {
  if (typeof window === "undefined") return
  try {
    const entries = Array.from(mediaCache.entries()).slice(-MEDIA_CACHE_CAP)
    const obj = {}
    entries.forEach(([id, media]) => {
      obj[id] = media
    })
    window.sessionStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify(obj))
  } catch {
    /* sessionStorage full / unavailable — non-fatal */
  }
}

export const fetchAniListMediaByIds = async (ids = []) => {
  hydrateMediaCache()
  const uniqueIds = Array.from(new Set((ids || []).map((value) => Number(value)).filter(Number.isFinite)))
  const mediaById = new Map()
  const missing = []

  uniqueIds.forEach((id) => {
    if (mediaCache.has(id)) mediaById.set(id, mediaCache.get(id))
    else missing.push(id)
  })

  if (missing.length) {
    for (const batch of chunkIds(missing, 50)) {
      const data = await fetchAniList(MEDIA_BY_IDS_QUERY, {
        ids: batch,
        perPage: batch.length,
      })
      const mediaList = data?.Page?.media || []
      mediaList.forEach((media) => {
        mediaCache.set(media.id, media)
        mediaById.set(media.id, media)
      })
    }
    persistMediaCache()
  }

  return mediaById
}

export const getMediaTitle = (media) =>
  media?.title?.english || media?.title?.romaji || media?.title?.native || "Untitled"

export const slugifyMediaTitle = (value) =>
  sanitizeDescription(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

export const getMediaHref = (mediaOrId, maybeTitle) => {
  const id = Number(typeof mediaOrId === "object" ? mediaOrId?.id : mediaOrId)
  const title = typeof mediaOrId === "object" ? getMediaTitle(mediaOrId) : maybeTitle
  const slug = slugifyMediaTitle(title)

  if (Number.isFinite(id) && slug) return `/media/${id}-${slug}`
  if (Number.isFinite(id)) return `/media/${id}`
  if (slug) return `/media/${slug}`
  return "/search"
}

export const getPrimaryStudio = (media) => media?.studios?.nodes?.[0]?.name || ""

export const getStreamingLinks = (media) => {
  const links = Array.isArray(media?.externalLinks) ? media.externalLinks : []
  const normalized = links.filter(
    (link) =>
      link?.url &&
      (String(link?.type || "").toLowerCase() === "streaming" || STREAMING_SITE_PRIORITY.includes(String(link?.site || ""))),
  )

  return normalized.sort((left, right) => {
    const leftIndex = STREAMING_SITE_PRIORITY.indexOf(String(left?.site || ""))
    const rightIndex = STREAMING_SITE_PRIORITY.indexOf(String(right?.site || ""))
    const safeLeft = leftIndex === -1 ? STREAMING_SITE_PRIORITY.length : leftIndex
    const safeRight = rightIndex === -1 ? STREAMING_SITE_PRIORITY.length : rightIndex
    return safeLeft - safeRight
  })
}

export const getPreferredStreamingLink = (media) => getStreamingLinks(media)[0] || null

export const sanitizeDescription = (value) =>
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

export const formatAniListStatus = (status) => {
  switch (status) {
    case "RELEASING":
      return "Airing"
    case "FINISHED":
      return "Completed"
    case "NOT_YET_RELEASED":
      return "Coming Soon"
    case "CANCELLED":
      return "Cancelled"
    case "HIATUS":
      return "Hiatus"
    default:
      return "Unknown"
  }
}

export const formatCompactNumber = (value) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 1000000 ? 1 : 0,
  }).format(Number(value) || 0)

export const formatRelativeTime = (value) => {
  if (!value) return ""

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const absoluteSeconds = Math.abs(diffSeconds)
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (absoluteSeconds < 60) return formatter.format(diffSeconds, "second")
  if (absoluteSeconds < 3600) return formatter.format(Math.round(diffSeconds / 60), "minute")
  if (absoluteSeconds < 86400) return formatter.format(Math.round(diffSeconds / 3600), "hour")
  if (absoluteSeconds < 604800) return formatter.format(Math.round(diffSeconds / 86400), "day")

  return date.toLocaleDateString()
}

export const getEpisodeCount = (media) => {
  if (media?.episodes) return media.episodes
  if (media?.nextAiringEpisode?.episode) {
    return Math.max(media.nextAiringEpisode.episode - 1, 0)
  }
  return null
}
