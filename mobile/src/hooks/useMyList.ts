import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "./useAuth"
import { fetchAniList, getMediaTitle, type AniListMedia } from "@/lib/anilist"

const MEDIA_BY_IDS_QUERY = `
query ($ids: [Int], $perPage: Int) {
  Page(perPage: $perPage) {
    media(id_in: $ids) {
      id type title { romaji english native }
      coverImage { extraLarge large }
      episodes chapters nextAiringEpisode { episode airingAt }
    }
  }
}
`

export interface MyListEntry {
  id: string
  mediaId: number
  status: string
  progress: number
  score: number
  mediaType: string
  title: string
  cover: string
  /** Episodes for anime, chapters for manga. Null when unknown/ongoing. */
  total: number | null
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * The signed-in user's full list, hydrated with AniList metadata, plus the
 * same +1 behaviour as the web list page (auto-complete on the last episode).
 */
export function useMyList() {
  const { user, loading: authLoading } = useAuth()
  const [entries, setEntries] = useState<MyListEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (asRefresh = false) => {
      if (!user) {
        setEntries([])
        setLoading(false)
        return
      }
      if (asRefresh) setRefreshing(true)
      else setLoading(true)

      try {
        const { data, error } = await supabase
          .from("list_entries")
          .select("id, media_id, status, progress, score, media_type, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
        if (error) throw error

        const rows = data || []
        const ids = Array.from(new Set(rows.map((r: any) => Number(r.media_id))))
        const byId = new Map<number, AniListMedia>()
        for (const batch of chunk(ids, 50)) {
          try {
            const res = await fetchAniList<{ Page: { media: AniListMedia[] } }>(MEDIA_BY_IDS_QUERY, {
              ids: batch,
              perPage: batch.length,
            })
            for (const media of res?.Page?.media ?? []) byId.set(media.id, media)
          } catch {
            // A failed batch shouldn't blank the whole list.
          }
        }

        setEntries(
          rows.map((entry: any): MyListEntry => {
            const media = byId.get(Number(entry.media_id))
            const isManga = (entry.media_type || "ANIME") === "MANGA"
            return {
              id: String(entry.id),
              mediaId: Number(entry.media_id),
              status: String(entry.status || "watching"),
              progress: Number(entry.progress || 0),
              score: Number(entry.score || 0),
              mediaType: entry.media_type || "ANIME",
              title: media ? getMediaTitle(media) : `#${entry.media_id}`,
              cover: media?.coverImage?.extraLarge || media?.coverImage?.large || "",
              total: isManga ? media?.chapters ?? null : media?.episodes ?? null,
            }
          }),
        )
      } catch (e) {
        console.warn("[hikari] list load failed:", e)
        setEntries([])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [user],
  )

  useEffect(() => {
    if (authLoading) return
    load()
  }, [authLoading, load])

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const entry of entries) map[entry.status] = (map[entry.status] || 0) + 1
    return map
  }, [entries])

  /** +1 episode/chapter; marks completed when the total is reached. */
  const plusOne = useCallback(
    async (entry: MyListEntry) => {
      if (!user) return
      const nextProgress = entry.total ? Math.min(entry.progress + 1, entry.total) : entry.progress + 1
      const nextStatus = entry.total && nextProgress >= entry.total ? "completed" : entry.status === "plan_to_watch" ? "watching" : entry.status
      const previous = entries
      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id ? { ...item, progress: nextProgress, status: nextStatus } : item,
        ),
      )
      const { error } = await supabase
        .from("list_entries")
        .update({ progress: nextProgress, status: nextStatus })
        .eq("id", entry.id)
      if (error) {
        console.warn("[hikari] plus one failed:", error)
        setEntries(previous)
      }
    },
    [entries, user],
  )

  return { entries, counts, loading, refreshing, refresh: () => load(true), plusOne }
}
