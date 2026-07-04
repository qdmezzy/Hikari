// Server-side media lookup shared by generateMetadata and the OG image.
// Cached by Next's data cache for a day so crawlers don't hammer AniList.

const META_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    type
    title { romaji english native }
    coverImage { extraLarge large color }
    bannerImage
    averageScore
    episodes
    chapters
    genres
    description(asHtml: false)
    startDate { year }
    isAdult
  }
}
`

export type MediaMeta = {
  id: number
  title: string
  description: string
  cover: string
  banner: string
  color: string
  score: number | null
  year: number | null
  episodes: number | null
  chapters: number | null
  genres: string[]
  type: string
}

export const parseMediaId = (raw: string): number | null => {
  const id = Number.parseInt(String(raw || ""), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

const stripHtml = (value: unknown) =>
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

export const fetchMediaMeta = async (rawId: string): Promise<MediaMeta | null> => {
  const id = parseMediaId(rawId)
  if (!id) return null

  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: META_QUERY, variables: { id } }),
      next: { revalidate: 86400 },
      // Never let a slow AniList response hold up page metadata — the page
      // still renders fine with the generic embed if this times out.
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null

    const json = await res.json().catch(() => null)
    const media = json?.data?.Media
    if (!media || media.isAdult === true) return null

    return {
      id: media.id,
      title: media.title?.english || media.title?.romaji || media.title?.native || "Untitled",
      description: stripHtml(media.description).slice(0, 300),
      cover: media.coverImage?.extraLarge || media.coverImage?.large || "",
      banner: media.bannerImage || "",
      color: media.coverImage?.color || "#f2d16b",
      score: typeof media.averageScore === "number" ? media.averageScore : null,
      year: media.startDate?.year || null,
      episodes: media.episodes || null,
      chapters: media.chapters || null,
      genres: Array.isArray(media.genres) ? media.genres.slice(0, 3) : [],
      type: media.type === "MANGA" ? "Manga" : "Anime",
    }
  } catch {
    return null
  }
}
