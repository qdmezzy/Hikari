/**
 * AniList GraphQL client for mobile.
 *
 * The web app proxies AniList through `/api/anilist` (server-cached). On mobile
 * we hit the public AniList GraphQL endpoint directly — it's public, no auth
 * required for catalog reads, and keeps the app standalone for now.
 */

const ANILIST_ENDPOINT = "https://graphql.anilist.co"

export interface AniListMedia {
  id: number
  type?: string
  title?: { romaji?: string | null; english?: string | null; native?: string | null }
  coverImage?: { extraLarge?: string | null; large?: string | null; color?: string | null }
  bannerImage?: string | null
  episodes?: number | null
  duration?: number | null
  chapters?: number | null
  nextAiringEpisode?: { episode: number; airingAt: number } | null
  averageScore?: number | null
  status?: string | null
  genres?: string[]
  trailer?: { id: string; site: string; thumbnail?: string | null } | null
  popularity?: number | null
  favourites?: number | null
  description?: string | null
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null
  studios?: { nodes?: { name: string }[] } | null
  externalLinks?: { site: string; url: string; type?: string }[]
  season?: string | null
  seasonYear?: number | null
}

export async function fetchAniList<T = any>(
  query: string,
  variables: Record<string, any> = {},
): Promise<T> {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  })

  const json = await response.json().catch(() => ({}))
  if (!response.ok || json?.errors) {
    throw new Error(json?.errors?.[0]?.message || "Failed to load AniList data")
  }
  return json?.data as T
}

// --- Helpers (ported from web/src/lib/anilist.js) ------------------------

export function getMediaTitle(media: AniListMedia | null | undefined): string {
  if (!media?.title) return "Untitled"
  return (
    media.title.english ||
    media.title.romaji ||
    media.title.native ||
    "Untitled"
  )
}

export function getEpisodeCount(media: AniListMedia | null | undefined): number | null {
  return media?.episodes ?? media?.chapters ?? null
}

export function formatAniListStatus(status: string | null | undefined): string {
  if (!status) return ""
  const map: Record<string, string> = {
    FINISHED: "Finished",
    RELEASING: "Airing",
    NOT_YET_RELEASED: "Upcoming",
    CANCELLED: "Cancelled",
  }
  return map[status] ?? status
}

export function getPrimaryStudio(media: AniListMedia | null | undefined): string {
  return media?.studios?.nodes?.[0]?.name ?? ""
}

export function sanitizeDescription(value: string | null | undefined): string {
  if (!value) return ""
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

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

export function getPreferredStreamingLink(
  media: AniListMedia | null | undefined,
): { site: string; url: string } | null {
  const links = media?.externalLinks || []
  const streaming = links.filter((l) => l.type === "STREAMING")
  if (!streaming.length) return null
  for (const site of STREAMING_SITE_PRIORITY) {
    const match = streaming.find((l) => l.site.toLowerCase() === site.toLowerCase())
    if (match) return { site: match.site, url: match.url }
  }
  return { site: streaming[0].site, url: streaming[0].url }
}

// --- Queries (ported from web home + discover) ----------------------------

export const HOME_TRENDING_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
      id title { romaji english native }
      coverImage { extraLarge large }
      bannerImage averageScore episodes
      nextAiringEpisode { episode airingAt }
      description(asHtml: false) genres popularity status
      studios(isMain: true) { nodes { name } }
      externalLinks { site url type }
    }
  }
}
`

export const HOME_SEASONAL_QUERY = `
query ($season: MediaSeason, $seasonYear: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, isAdult: false) {
      id title { romaji english native }
      coverImage { extraLarge large }
      averageScore episodes nextAiringEpisode { episode airingAt }
      status description(asHtml: false) genres
      studios(isMain: true) { nodes { name } }
      externalLinks { site url type }
    }
  }
}
`

export const SEARCH_QUERY = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { currentPage hasNextPage }
    media(type: ANIME, search: $search, sort: SEARCH_MATCH, isAdult: false) {
      id title { romaji english native }
      coverImage { extraLarge large }
      averageScore episodes status
      startDate { year }
      studios(isMain: true) { nodes { name } }
    }
  }
}
`

export const MEDIA_DETAILS_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id type
    title { romaji english native }
    coverImage { extraLarge large color }
    bannerImage
    episodes duration chapters
    nextAiringEpisode { episode airingAt }
    averageScore meanScore popularity favourites
    status season seasonYear
    description(asHtml: false) genres
    trailer { id site thumbnail }
    startDate { year month day }
    studios(isMain: true) { nodes { name } }
    externalLinks { site url type }
  }
}
`

export function getCurrentSeason(date = new Date()) {
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  if (month <= 3) return { season: "WINTER" as const, year }
  if (month <= 6) return { season: "SPRING" as const, year }
  if (month <= 9) return { season: "SUMMER" as const, year }
  return { season: "FALL" as const, year }
}
