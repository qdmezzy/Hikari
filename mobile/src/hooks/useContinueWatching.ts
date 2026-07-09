import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "./useAuth"
import {
  fetchAniList,
  getMediaTitle,
  getEpisodeCount,
  type AniListMedia,
} from "@/lib/anilist"
import { formatRelativeTime } from "@/lib/utils"
import type { ContinueWatchingItem } from "./useHomeData"

const MEDIA_BY_IDS_QUERY = `
query ($ids: [Int], $perPage: Int) {
  Page(perPage: $perPage) {
    media(id_in: $ids, sort: POPULARITY_DESC) {
      id title { romaji english native }
      coverImage { extraLarge large }
      episodes nextAiringEpisode { episode airingAt }
    }
  }
}
`

/**
 * Loads the signed-in user's "watching"/"rewatching" list entries with
 * progress > 0, then hydrates each with AniList cover/episode metadata.
 * Mirrors the web home's `loadContinueWatching` effect.
 */
export function useContinueWatching() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<ContinueWatchingItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const load = async () => {
      if (authLoading) return
      if (!user) {
        setItems([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("list_entries")
          .select("id, media_id, status, progress, media_type, updated_at")
          .eq("user_id", user.id)
          .eq("media_type", "ANIME")
          .in("status", ["watching", "rewatching"])
          .gt("progress", 0)
          .order("updated_at", { ascending: false })
          .limit(6)

        if (!active) return
        if (error || !data?.length) {
          setItems([])
          return
        }

        const ids = data.map((e: any) => Number(e.media_id))
        const res = await fetchAniList<{ Page: { media: AniListMedia[] } }>(MEDIA_BY_IDS_QUERY, {
          ids,
          perPage: ids.length,
        })
        if (!active) return

        const byId = new Map((res?.Page?.media ?? []).map((m) => [m.id, m]))
        setItems(
          data
            .map((entry: any) => {
              const media = byId.get(Number(entry.media_id))
              if (!media) return null
              const totalEp = getEpisodeCount(media)
              const currentEp = Number(entry.progress || 0)
              const progress = totalEp ? Math.min(Math.round((currentEp / totalEp) * 100), 100) : 0
              return {
                id: media.id,
                title: getMediaTitle(media),
                cover: media?.coverImage?.extraLarge || media?.coverImage?.large || "",
                progress,
                currentEp,
                totalEp,
                nextEpIn: media?.nextAiringEpisode?.airingAt
                  ? formatRelativeTime(new Date(media.nextAiringEpisode.airingAt * 1000))
                  : "",
              } as ContinueWatchingItem
            })
            .filter(Boolean) as ContinueWatchingItem[],
        )
      } catch (e) {
        console.warn("[hikari] continue watching failed:", e)
        if (active) setItems([])
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [user, authLoading])

  return { items, loading }
}
