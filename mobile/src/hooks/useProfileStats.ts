import { useEffect, useMemo, useState } from "react"
import { useAuth } from "./useAuth"
import { useMyList } from "./useMyList"
import { fetchFollowCounts } from "@/lib/social"
import { fetchAniList, getMediaTitle, type AniListMedia } from "@/lib/anilist"

const FAVORITES_QUERY = `
query ($ids: [Int], $perPage: Int) {
  Page(perPage: $perPage) {
    media(id_in: $ids) {
      id type title { romaji english native }
      coverImage { extraLarge large }
    }
  }
}
`

export interface FavoriteMedia {
  id: number
  type: string
  title: string
  cover: string
}

/**
 * Profile stats derived from the user's list (same math as the web profile:
 * days watched = episodes x 24min / 60 / 24), plus follower counts and the
 * user's favorites (user_metadata.favorite_media_ids, hydrated via AniList).
 */
export function useProfileStats() {
  const { user } = useAuth()
  const { entries, loading: listLoading, refreshing, refresh } = useMyList()
  const [follows, setFollows] = useState<{ followers: number; following: number }>({ followers: 0, following: 0 })
  const [favorites, setFavorites] = useState<FavoriteMedia[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)

  // Follower / following counts.
  useEffect(() => {
    let active = true
    if (!user) {
      setFollows({ followers: 0, following: 0 })
      return
    }
    fetchFollowCounts(user.id)
      .then((counts) => active && setFollows(counts))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [user])

  // Favorites from user_metadata (same source as the web profile/favorites page).
  useEffect(() => {
    let active = true
    const raw = (user?.user_metadata as any)?.favorite_media_ids
    const ids: number[] = Array.isArray(raw)
      ? Array.from(new Set(raw.map((id: any) => Number(id)).filter(Number.isFinite)))
      : []
    if (!ids.length) {
      setFavorites([])
      return
    }
    setFavoritesLoading(true)
    fetchAniList<{ Page: { media: AniListMedia[] } }>(FAVORITES_QUERY, { ids: ids.slice(0, 25), perPage: 25 })
      .then((res) => {
        if (!active) return
        const byId = new Map((res?.Page?.media ?? []).map((m) => [m.id, m]))
        setFavorites(
          ids
            .map((id) => byId.get(id))
            .filter(Boolean)
            .map((m) => ({
              id: m!.id,
              type: m!.type || "ANIME",
              title: getMediaTitle(m),
              cover: m!.coverImage?.extraLarge || m!.coverImage?.large || "",
            })),
        )
      })
      .catch(() => active && setFavorites([]))
      .finally(() => active && setFavoritesLoading(false))
    return () => {
      active = false
    }
  }, [user])

  const stats = useMemo(() => {
    const anime = entries.filter((e) => (e.mediaType || "ANIME") === "ANIME")
    const manga = entries.filter((e) => e.mediaType === "MANGA")
    const episodesWatched = anime.reduce((sum, e) => sum + (e.progress || 0), 0)
    const chaptersRead = manga.reduce((sum, e) => sum + (e.progress || 0), 0)
    // Same formula as web/src/app/profile/page.tsx (assumes ~24 min per episode).
    const daysWatched = Number((Math.round((episodesWatched * 24) / 60) / 24).toFixed(1))
    const completedAnime = anime.filter((e) => e.status === "completed").length
    const meanScore = (() => {
      const scored = entries.filter((e) => e.score > 0)
      if (!scored.length) return 0
      return Number((scored.reduce((sum, e) => sum + e.score, 0) / scored.length).toFixed(1))
    })()

    return {
      totalAnime: anime.length,
      totalManga: manga.length,
      episodesWatched,
      chaptersRead,
      daysWatched,
      completedAnime,
      meanScore,
    }
  }, [entries])

  return {
    stats,
    follows,
    favorites,
    loading: listLoading,
    favoritesLoading,
    refreshing,
    refresh,
  }
}
