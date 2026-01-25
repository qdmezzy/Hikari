import client from "@/lib/client"
import { reportContent } from "@/lib/reporting"

const normalizeHandle = (value) => (value || "").replace(/^@/, "").trim()

export const buildUserProfile = (user) => {
  if (!user) {
    return {
      displayName: "User",
      handle: "@user",
      avatarUrl: "",
      avatarInitial: "U",
    }
  }
  const displayName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || "User"
  const rawHandle =
    user.user_metadata?.handle ||
    user.user_metadata?.username ||
    (user.email ? user.email.split("@")[0] : "user")
  const handle = `@${normalizeHandle(rawHandle)}`
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.avatar || ""
  const avatarInitial = displayName.slice(0, 1).toUpperCase() || "U"
  return { displayName, handle, avatarUrl, avatarInitial }
}

const hydratePosts = async (posts, userId) => {
  if (!posts || posts.length === 0) return []
  const postIds = posts.map((post) => post.id)

  const [{ data: reactions }, { data: comments }, { data: pollVotes }] = await Promise.all([
    client
      .from("social_reactions")
      .select("post_id, user_id, reaction_type")
      .in("post_id", postIds),
    client
      .from("social_comments")
      .select("post_id")
      .in("post_id", postIds),
    client
      .from("social_poll_votes")
      .select("post_id, user_id, option_index")
      .in("post_id", postIds),
  ])

  const reactionMap = new Map()
  const userReactionMap = new Map()

  ;(reactions || []).forEach((reaction) => {
    const key = reaction.post_id
    if (!reactionMap.has(key)) {
      reactionMap.set(key, { like: 0, repost: 0, save: 0 })
    }
    const counts = reactionMap.get(key)
    counts[reaction.reaction_type] = (counts[reaction.reaction_type] || 0) + 1
    if (userId && reaction.user_id === userId) {
      const userState = userReactionMap.get(key) || {}
      userState[reaction.reaction_type] = true
      userReactionMap.set(key, userState)
    }
  })

  const commentCounts = new Map()
  ;(comments || []).forEach((comment) => {
    commentCounts.set(comment.post_id, (commentCounts.get(comment.post_id) || 0) + 1)
  })

  const pollCountsMap = new Map()
  const pollUserVoteMap = new Map()
  ;(pollVotes || []).forEach((vote) => {
    const key = vote.post_id
    if (!pollCountsMap.has(key)) {
      pollCountsMap.set(key, {})
    }
    const counts = pollCountsMap.get(key)
    counts[vote.option_index] = (counts[vote.option_index] || 0) + 1
    if (userId && vote.user_id === userId) {
      pollUserVoteMap.set(key, vote.option_index)
    }
  })

  return posts.map((post) => {
    const counts = reactionMap.get(post.id) || { like: 0, repost: 0, save: 0 }
    const userState = userReactionMap.get(post.id) || {}
    const pollOptions = Array.isArray(post.poll_options) ? post.poll_options : []
    const pollCounts = pollOptions.map((_, index) => (pollCountsMap.get(post.id) || {})[index] || 0)
    const pollTotal = pollCounts.reduce((sum, value) => sum + value, 0)
    const pollUserVote = pollUserVoteMap.has(post.id) ? pollUserVoteMap.get(post.id) : null
    return {
      ...post,
      like_count: counts.like,
      repost_count: counts.repost,
      save_count: counts.save,
      comment_count: commentCounts.get(post.id) || 0,
      is_liked: Boolean(userState.like),
      is_reposted: Boolean(userState.repost),
      is_saved: Boolean(userState.save),
      poll_counts: pollCounts,
      poll_total: pollTotal,
      poll_user_vote: pollUserVote,
    }
  })
}

export const fetchSocialPosts = async (userId, limit = 100) => {
  const { data, error } = await client
    .from("social_posts")
    .select("*")
    .eq("is_removed", false)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message || "Failed to load social posts.")
  }

  return hydratePosts(data || [], userId)
}

export const fetchSocialPostsByUser = async (userId) => {
  if (!userId) return []
  const { data, error } = await client
    .from("social_posts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_removed", false)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message || "Failed to load posts.")
  }

  return hydratePosts(data || [], userId)
}

export const fetchSocialPost = async (postId, userId) => {
  const { data, error } = await client
    .from("social_posts")
    .select("*")
    .eq("id", postId)
    .eq("is_removed", false)
    .single()

  if (error) {
    throw new Error(error.message || "Post not found.")
  }

  const hydrated = await hydratePosts([data], userId)
  return hydrated[0] || null
}

export const fetchSocialComments = async (postId) => {
  const { data, error } = await client
    .from("social_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })

  if (error) {
    throw new Error(error.message || "Failed to load comments.")
  }

  return data || []
}

export const createSocialPost = async (payload) => {
  const { data, error } = await client.from("social_posts").insert(payload).select("*").single()
  if (error) {
    throw new Error(error.message || "Failed to create post.")
  }
  return data
}

export const createSocialComment = async (payload) => {
  const { data, error } = await client.from("social_comments").insert(payload).select("*").single()
  if (error) {
    throw new Error(error.message || "Failed to create comment.")
  }
  return data
}

export const deleteSocialComment = async (commentId, userId) => {
  const { error } = await client
    .from("social_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", userId)
  if (error) {
    throw new Error(error.message || "Failed to delete comment.")
  }
}

export const toggleReaction = async ({ postId, userId, type, isActive }) => {
  if (isActive) {
    const { error } = await client
      .from("social_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId)
      .eq("reaction_type", type)
    if (error) {
      throw new Error(error.message || "Failed to remove reaction.")
    }
    return false
  }

  const { error } = await client.from("social_reactions").insert({
    post_id: postId,
    user_id: userId,
    reaction_type: type,
  })

  if (error) {
    throw new Error(error.message || "Failed to add reaction.")
  }

  return true
}

export const voteOnPoll = async ({ postId, userId, optionIndex }) => {
  const { error } = await client.from("social_poll_votes").upsert(
    {
      post_id: postId,
      user_id: userId,
      option_index: optionIndex,
    },
    { onConflict: "post_id,user_id" },
  )

  if (error) {
    throw new Error(error.message || "Failed to vote on poll.")
  }

  return true
}

export const reportSocialPost = async ({ postId, reporterId, reason, target }) => {
  return reportContent({
    reporterId,
    reason,
    targetType: "social_post",
    targetId: postId,
    postId,
    targetLabel: target?.label,
    targetUrl: target?.url,
    targetUserId: target?.userId,
    targetUserHandle: target?.userHandle,
    targetUserDisplayName: target?.userDisplayName,
    targetUserAvatarUrl: target?.userAvatarUrl,
  })
}

export const fetchFollowingIds = async (userId) => {
  if (!userId) return []
  const { data, error } = await client
    .from("social_follows")
    .select("following_id")
    .eq("follower_id", userId)

  if (error) {
    throw new Error(error.message || "Failed to load following.")
  }

  return (data || []).map((row) => row.following_id)
}

export const toggleFollow = async ({ followerId, followingId, isFollowing }) => {
  if (isFollowing) {
    const { error } = await client
      .from("social_follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
    if (error) {
      throw new Error(error.message || "Failed to unfollow.")
    }
    return false
  }

  const { error } = await client.from("social_follows").insert({
    follower_id: followerId,
    following_id: followingId,
  })

  if (error) {
    throw new Error(error.message || "Failed to follow.")
  }

  return true
}
