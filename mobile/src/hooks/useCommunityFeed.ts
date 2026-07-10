import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "./useAuth"
import { fetchFeedPosts, fetchFollowingIds, toggleLike, type SocialPost } from "@/lib/social"
import { fetchAniList, type AniListMedia } from "@/lib/anilist"

const MEDIA_COVERS_QUERY = `
query ($ids: [Int], $perPage: Int) {
  Page(perPage: $perPage) {
    media(id_in: $ids) { id coverImage { large medium } }
  }
}
`

export interface FeedPost extends SocialPost {
  /** AniList cover for the attached media (activity posts). */
  mediaCover: string | null
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * The community activity feed — social_posts hydrated with AniList covers for
 * attached media, plus a Following filter (social_follows).
 */
export function useCommunityFeed() {
  const { user, loading: authLoading } = useAuth()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [followingIds, setFollowingIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(
    async (asRefresh = false) => {
      if (asRefresh) setRefreshing(true)
      else setLoading(true)
      setError("")

      try {
        const [rawPosts, follows] = await Promise.all([
          fetchFeedPosts(user?.id ?? null),
          fetchFollowingIds(user?.id ?? null),
        ])
        setFollowingIds(follows)

        // Hydrate AniList covers for activity posts.
        const mediaIds = Array.from(
          new Set(
            rawPosts
              .map((p) => Number(p.attached_media_id))
              .filter((id) => Number.isFinite(id) && id > 0),
          ),
        )
        const coverById = new Map<number, string>()
        for (const batch of chunk(mediaIds, 50)) {
          try {
            const res = await fetchAniList<{ Page: { media: AniListMedia[] } }>(MEDIA_COVERS_QUERY, {
              ids: batch,
              perPage: batch.length,
            })
            for (const media of res?.Page?.media ?? []) {
              const cover = media?.coverImage?.large || (media?.coverImage as any)?.medium || ""
              if (cover) coverById.set(media.id, cover)
            }
          } catch {
            // A failed cover batch shouldn't blank the feed.
          }
        }

        setPosts(
          rawPosts.map((post): FeedPost => ({
            ...post,
            mediaCover: post.attached_media_id ? coverById.get(Number(post.attached_media_id)) ?? null : null,
          })),
        )
      } catch (e: any) {
        setError(e?.message || "Could not load the feed.")
        setPosts([])
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

  const followingSet = useMemo(() => new Set(followingIds), [followingIds])

  const like = useCallback(
    async (post: FeedPost) => {
      if (!user) return
      const wasLiked = post.is_liked
      // Optimistic update.
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? { ...item, is_liked: !wasLiked, like_count: Math.max(0, item.like_count + (wasLiked ? -1 : 1)) }
            : item,
        ),
      )
      try {
        await toggleLike({ postId: post.id, userId: user.id, isLiked: wasLiked })
      } catch {
        // Revert on failure.
        setPosts((current) =>
          current.map((item) =>
            item.id === post.id
              ? { ...item, is_liked: wasLiked, like_count: Math.max(0, item.like_count + (wasLiked ? 1 : -1)) }
              : item,
          ),
        )
      }
    },
    [user],
  )

  return { posts, followingSet, loading, refreshing, error, refresh: () => load(true), like }
}
