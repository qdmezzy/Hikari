import client from "@/lib/client"
import { buildUserProfile } from "@/lib/social-service"
import { fetchAniListMediaByIds, getMediaTitle } from "@/lib/anilist"

// Activities are stored as social_posts with post_type "activity" so that the
// existing reactions (social_reactions) and comments (social_comments) systems
// work on them with zero extra schema.

const COALESCE_WINDOW_MS = 1000 * 60 * 60 * 12 // merge repeated updates within 12h

const isManga = (mediaType) => String(mediaType || "").toUpperCase() === "MANGA"

/**
 * Build the human-readable action sentence for a list update.
 * The media title is appended by the renderer ("... of {title}").
 */
export const describeListActivity = ({ mediaType, status, progress }) => {
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

/**
 * Record a list update to the community activity feed. Best-effort: never throws,
 * so list mutations are never blocked by activity logging.
 */
export const logListActivity = async ({ user, media, mediaId, mediaType, status, progress }) => {
  try {
    if (!user?.id) return null

    const resolvedMediaId = Number(mediaId ?? media?.id)
    if (!Number.isFinite(resolvedMediaId)) return null

    const resolvedMediaType = (mediaType || media?.type || "ANIME").toUpperCase()
    const mediaTitle = media ? getMediaTitle(media) : null
    const content = describeListActivity({ mediaType: resolvedMediaType, status, progress })
    const profile = buildUserProfile(user)
    const nowIso = new Date().toISOString()

    // Coalesce: if there's a recent activity for the same media, update it in place
    // (mirrors AniList collapsing repeated progress bumps into one entry).
    const { data: existing } = await client
      .from("social_posts")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("post_type", "activity")
      .eq("attached_media_id", resolvedMediaId)
      .eq("is_removed", false)
      .order("created_at", { ascending: false })
      .limit(1)

    const latest = existing?.[0]
    const isRecent =
      latest?.created_at && Date.now() - new Date(latest.created_at).getTime() < COALESCE_WINDOW_MS

    if (latest && isRecent) {
      const { data, error } = await client
        .from("social_posts")
        .update({
          content,
          attached_media_title: mediaTitle,
          attached_media_type: resolvedMediaType,
          created_at: nowIso,
          user_display_name: profile.displayName,
          user_handle: profile.handle,
          user_avatar_url: profile.avatarUrl,
        })
        .eq("id", latest.id)
        .select("*")
        .single()

      if (error) return null
      return data
    }

    const { data, error } = await client
      .from("social_posts")
      .insert({
        user_id: user.id,
        content,
        post_type: "activity",
        attached_media_id: resolvedMediaId,
        attached_media_title: mediaTitle,
        attached_media_type: resolvedMediaType,
        user_display_name: profile.displayName,
        user_handle: profile.handle,
        user_avatar_url: profile.avatarUrl,
      })
      .select("*")
      .single()

    if (error) return null
    return data
  } catch {
    return null
  }
}

/**
 * Fetch the most recent list-update activities, hydrated with reaction/comment
 * counts and the current user's like state.
 */
export const fetchActivityFeed = async (userId, limit = 30) => {
  // Includes both auto-generated list activity and user-written statuses/posts.
  const { data, error } = await client
    .from("social_posts")
    .select("*")
    .in("post_type", ["activity", "status", "text"])
    .eq("is_removed", false)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message || "Failed to load activity feed.")
  }

  const posts = data || []
  if (!posts.length) return []

  const postIds = posts.map((post) => post.id)

  const [{ data: reactions }, { data: comments }] = await Promise.all([
    client.from("social_reactions").select("post_id, user_id, reaction_type").in("post_id", postIds),
    client.from("social_comments").select("post_id").in("post_id", postIds),
  ])

  const likeCounts = new Map()
  const likedByUser = new Set()
  ;(reactions || []).forEach((reaction) => {
    if (reaction.reaction_type !== "like") return
    likeCounts.set(reaction.post_id, (likeCounts.get(reaction.post_id) || 0) + 1)
    if (userId && reaction.user_id === userId) likedByUser.add(reaction.post_id)
  })

  const commentCounts = new Map()
  ;(comments || []).forEach((comment) => {
    commentCounts.set(comment.post_id, (commentCounts.get(comment.post_id) || 0) + 1)
  })

  return posts.map((post) => ({
    ...post,
    like_count: likeCounts.get(post.id) || 0,
    comment_count: commentCounts.get(post.id) || 0,
    is_liked: likedByUser.has(post.id),
  }))
}

/**
 * Post a user-written status to the community activity feed.
 */
export const postStatus = async ({ user, content }) => {
  if (!user?.id || !content?.trim()) return null
  const profile = buildUserProfile(user)

  const { data, error } = await client
    .from("social_posts")
    .insert({
      user_id: user.id,
      content: content.trim(),
      post_type: "status",
      user_display_name: profile.displayName,
      user_handle: profile.handle,
      user_avatar_url: profile.avatarUrl,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message || "Could not post your status.")
  return { ...data, like_count: 0, comment_count: 0, is_liked: false }
}

/**
 * Fetch the most recent reviews across all titles, hydrated with the media
 * title and cover from AniList.
 */
export const fetchRecentReviews = async (limit = 4) => {
  const { data, error } = await client
    .from("reviews")
    .select("id, user_id, media_id, rating, review_text, user_display_name, user_avatar_url, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message || "Failed to load reviews.")
  }

  const reviews = data || []
  if (!reviews.length) return []

  const mediaIds = Array.from(new Set(reviews.map((r) => Number(r.media_id)).filter(Number.isFinite)))

  let mediaMap = new Map()
  if (mediaIds.length) {
    try {
      const fetched = await fetchAniListMediaByIds(mediaIds)
      mediaMap = new Map()
      fetched.forEach((media, id) => mediaMap.set(Number(id), media))
    } catch {
      mediaMap = new Map()
    }
  }

  return reviews.map((review) => {
    const media = mediaMap.get(Number(review.media_id))
    return {
      ...review,
      media_title: media ? getMediaTitle(media) : null,
      cover_image: media?.coverImage?.large || media?.coverImage?.extraLarge || null,
    }
  })
}
