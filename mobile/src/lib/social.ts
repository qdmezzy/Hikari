/**
 * Mobile port of the web social layer (web/src/lib/social-service.js +
 * activity-service.js). Same Supabase tables, so activity recorded on mobile
 * shows up on the web community feed and vice versa.
 *
 * Tables: social_posts (post_type "activity" | "text" | ...), social_reactions,
 * social_comments, social_follows, public_profiles.
 */
import type { User } from "@supabase/supabase-js"
import { supabase } from "./supabase"

const COALESCE_WINDOW_MS = 1000 * 60 * 60 * 12 // merge repeated updates within 12h

export interface SocialPost {
  id: string
  user_id: string
  content: string
  post_type: string
  created_at: string
  attached_media_id: number | null
  attached_media_title: string | null
  attached_media_type: string | null
  user_display_name: string | null
  user_handle: string | null
  user_avatar_url: string | null
  is_removed?: boolean
  // Hydrated fields
  like_count: number
  comment_count: number
  is_liked: boolean
}

const normalizeHandle = (value: string | null | undefined) => (value || "").replace(/^@/, "").trim()

const isManga = (mediaType: string | null | undefined) => String(mediaType || "").toUpperCase() === "MANGA"

/** Human-readable action sentence for a list update ("Watched episode 12"). */
export function describeListActivity({
  mediaType,
  status,
  progress,
}: {
  mediaType?: string | null
  status?: string | null
  progress?: number | null
}): string {
  const manga = isManga(mediaType)
  const unit = manga ? "chapter" : "episode"
  const count = Number(progress || 0)

  switch (status) {
    case "completed":
      return manga ? "Finished reading" : "Completed"
    case "plan_to_watch":
    case "planned":
      return manga ? "Plans to read" : "Plans to watch"
    case "on_hold":
      return "Put on hold"
    case "dropped":
      return "Dropped"
    case "rewatching":
      return manga ? `Rereading ${unit} ${count}` : `Rewatching ${unit} ${count}`
    case "watching":
    default:
      if (count > 0) return manga ? `Read ${unit} ${count}` : `Watched ${unit} ${count}`
      return manga ? "Started reading" : "Started watching"
  }
}

export function buildUserProfile(user: User | null | undefined) {
  if (!user) {
    return { displayName: "User", handle: "@user", avatarUrl: "", avatarInitial: "U" }
  }
  const meta = (user.user_metadata || {}) as Record<string, any>
  const displayName = meta.display_name || meta.full_name || user.email || "User"
  const rawHandle = meta.handle || meta.username || (user.email ? user.email.split("@")[0] : "user")
  const handle = `@${normalizeHandle(rawHandle)}`
  const avatarUrl = meta.avatar_url || meta.avatar || ""
  const avatarInitial = String(displayName).slice(0, 1).toUpperCase() || "U"
  return { displayName, handle, avatarUrl, avatarInitial }
}

/**
 * Record a list update to the community activity feed. Best-effort: never
 * throws — list mutations are never blocked by activity logging. Coalesces
 * repeated updates for the same media within a 12h window (same as web).
 */
export async function logListActivity({
  user,
  mediaId,
  mediaTitle,
  mediaType,
  status,
  progress,
}: {
  user: User | null
  mediaId: number
  mediaTitle?: string | null
  mediaType?: string | null
  status?: string | null
  progress?: number | null
}) {
  try {
    if (!user?.id || !Number.isFinite(mediaId)) return

    const resolvedMediaType = (mediaType || "ANIME").toUpperCase()
    const content = describeListActivity({ mediaType: resolvedMediaType, status, progress })
    const profile = buildUserProfile(user)
    const nowIso = new Date().toISOString()

    const { data: existing } = await supabase
      .from("social_posts")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("post_type", "activity")
      .eq("attached_media_id", mediaId)
      .eq("is_removed", false)
      .order("created_at", { ascending: false })
      .limit(1)

    const latest = existing?.[0]
    const isRecent =
      latest?.created_at && Date.now() - new Date(latest.created_at).getTime() < COALESCE_WINDOW_MS

    if (latest && isRecent) {
      await supabase
        .from("social_posts")
        .update({
          content,
          attached_media_title: mediaTitle ?? null,
          attached_media_type: resolvedMediaType,
          created_at: nowIso,
          user_display_name: profile.displayName,
          user_handle: profile.handle,
          user_avatar_url: profile.avatarUrl,
        })
        .eq("id", latest.id)
      return
    }

    await supabase.from("social_posts").insert({
      user_id: user.id,
      content,
      post_type: "activity",
      attached_media_id: mediaId,
      attached_media_title: mediaTitle ?? null,
      attached_media_type: resolvedMediaType,
      user_display_name: profile.displayName,
      user_handle: profile.handle,
      user_avatar_url: profile.avatarUrl,
    })
  } catch {
    // best-effort
  }
}

/** Live public_profiles snapshots so renamed handles/avatars reflect everywhere. */
async function loadProfileSnapshots(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  const map = new Map<string, { handle?: string; display_name?: string; avatar_url?: string }>()
  if (!ids.length) return map
  try {
    const { data, error } = await supabase
      .from("public_profiles")
      .select("user_id, handle, display_name, avatar_url")
      .in("user_id", ids)
    if (error) return map
    for (const row of data || []) {
      if (row?.user_id) map.set(String(row.user_id), row)
    }
  } catch {
    // profiles are a nice-to-have; stored snapshots still render
  }
  return map
}

/** Fetch feed posts hydrated with like/comment counts + the viewer's like state. */
export async function fetchFeedPosts(viewerId: string | null, limit = 60): Promise<SocialPost[]> {
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("is_removed", false)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message || "Failed to load the feed.")

  const posts = data || []
  if (!posts.length) return []

  const postIds = posts.map((p: any) => p.id)
  const [{ data: reactions }, { data: comments }, profiles] = await Promise.all([
    supabase.from("social_reactions").select("post_id, user_id, reaction_type").in("post_id", postIds),
    supabase.from("social_comments").select("post_id").in("post_id", postIds),
    loadProfileSnapshots(posts.map((p: any) => String(p.user_id))),
  ])

  const likeCounts = new Map<string, number>()
  const likedByViewer = new Set<string>()
  for (const r of reactions || []) {
    if (r.reaction_type !== "like") continue
    likeCounts.set(r.post_id, (likeCounts.get(r.post_id) || 0) + 1)
    if (viewerId && r.user_id === viewerId) likedByViewer.add(r.post_id)
  }

  const commentCounts = new Map<string, number>()
  for (const c of comments || []) {
    commentCounts.set(c.post_id, (commentCounts.get(c.post_id) || 0) + 1)
  }

  return posts.map((post: any): SocialPost => {
    const live = profiles.get(String(post.user_id))
    const liveHandle = live?.handle ? `@${normalizeHandle(live.handle)}` : null
    return {
      ...post,
      user_display_name: live?.display_name || post.user_display_name,
      user_handle: liveHandle || post.user_handle,
      user_avatar_url: live?.avatar_url || post.user_avatar_url,
      like_count: likeCounts.get(post.id) || 0,
      comment_count: commentCounts.get(post.id) || 0,
      is_liked: likedByViewer.has(post.id),
    }
  })
}

export async function toggleLike({
  postId,
  userId,
  isLiked,
}: {
  postId: string
  userId: string
  isLiked: boolean
}): Promise<boolean> {
  if (isLiked) {
    const { error } = await supabase
      .from("social_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId)
      .eq("reaction_type", "like")
    if (error) throw new Error(error.message || "Failed to unlike.")
    return false
  }
  const { error } = await supabase
    .from("social_reactions")
    .insert({ post_id: postId, user_id: userId, reaction_type: "like" })
  if (error) throw new Error(error.message || "Failed to like.")
  return true
}

export async function fetchFollowingIds(userId: string | null): Promise<string[]> {
  if (!userId) return []
  const { data, error } = await supabase
    .from("social_follows")
    .select("following_id")
    .eq("follower_id", userId)
  if (error) return []
  return (data || []).map((row: any) => String(row.following_id))
}

export async function fetchFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    supabase.from("social_follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("social_follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
  ])
  return { followers: followers.count ?? 0, following: following.count ?? 0 }
}

/** "3m ago" / "2h ago" / "5d ago" relative timestamps for the feed. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ""
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? "" : "s"} ago`
}
