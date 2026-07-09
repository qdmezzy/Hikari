import { useCallback, useEffect, useState } from "react"
import {
  fetchAniList,
  type AniListMedia,
} from "@/lib/anilist"

export interface DiscoverItem extends AniListMedia {
  vibes: string[]
  likes: number
}

const DISCOVER_QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $genreIn: [String]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { currentPage hasNextPage }
    media(type: ANIME, sort: $sort, isAdult: false, genre_in: $genreIn) {
      id
      title { romaji english native }
      coverImage { extraLarge large }
      bannerImage
      trailer { id site thumbnail }
      averageScore episodes
      description(asHtml: false)
      genres tags { name }
      popularity favourites
    }
  }
}
`

const VIBE_GENRES: Record<string, string[]> = {
  hype: ["Action", "Adventure", "Shounen"],
  action: ["Action"],
  chill: ["Slice of Life", "Comedy", "Iyashikei"],
  dark: ["Psychological", "Thriller", "Horror"],
  romance: ["Romance"],
}

function getVibes(
  genres: Array<string | null> = [],
  tags: Array<{ name?: string | null }> = [],
): string[] {
  const set = new Set<string>()
  const lower = (Array.isArray(genres) ? genres : []).filter(Boolean).map((g) => String(g).toLowerCase())
  const tagNames = (Array.isArray(tags) ? tags : []).map((t) => String(t?.name || "").toLowerCase())

  if (lower.some((g) => ["action", "adventure", "shounen"].includes(g))) set.add("hype")
  if (lower.includes("action")) set.add("action")
  if (lower.some((g) => ["slice of life", "comedy"].includes(g))) set.add("chill")
  if (lower.some((g) => ["psychological", "thriller", "horror"].includes(g))) set.add("dark")
  if (lower.includes("romance")) set.add("romance")
  if (tagNames.some((t) => t.includes("tearjerker"))) set.add("dark")
  if (tagNames.some((t) => t.includes("heartwarming"))) set.add("chill")

  return Array.from(set)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function useDiscoverFeed(vibe: string) {
  const [items, setItems] = useState<DiscoverItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const genreIn = vibe !== "all" ? VIBE_GENRES[vibe] : undefined
      const [byPop, byTrend] = await Promise.all([
        fetchAniList<{ Page: { media: AniListMedia[] } }>(DISCOVER_QUERY, {
          page: 1,
          perPage: 15,
          sort: ["POPULARITY_DESC"],
          genreIn,
        }),
        fetchAniList<{ Page: { media: AniListMedia[] } }>(DISCOVER_QUERY, {
          page: 1,
          perPage: 15,
          sort: ["TRENDING_DESC"],
          genreIn,
        }),
      ])

      const merged = [...(byPop?.Page?.media ?? []), ...(byTrend?.Page?.media ?? [])]
      const seen = new Set<number>()
      const deduped = merged.filter((m) => {
        if (seen.has(m.id)) return false
        seen.add(m.id)
        return !!m?.bannerImage || !!m?.coverImage?.extraLarge
      })

      const enriched: DiscoverItem[] = shuffle(deduped).map((m) => ({
        ...m,
        vibes: getVibes(m.genres, (m as any).tags),
        likes: Math.round((m.favourites ?? 0) / 100),
      }))

      setItems(enriched)
    } catch (e: any) {
      setError(e?.message || "Could not load discover feed.")
    } finally {
      setLoading(false)
    }
  }, [vibe])

  useEffect(() => {
    load()
  }, [load])

  return { items, loading, error, reload: load }
}
