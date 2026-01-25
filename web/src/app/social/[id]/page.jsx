"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { Navigation } from "@/components/Navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageCircle, Trash2, CornerUpRight } from "lucide-react"
import { SocialPost } from "@/components/social/SocialPost"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import {
  buildUserProfile,
  createSocialComment,
  deleteSocialComment,
  fetchSocialComments,
  fetchSocialPost,
  reportSocialPost,
  toggleReaction,
  voteOnPoll,
} from "@/lib/social-service"
import { awardXp, XP_ACTIONS } from "@/lib/xp"
import { parseVideoUrl } from "@/lib/video-utils"
import { addNotification } from "@/lib/notifications-store"
import { reportContent } from "@/lib/reporting"

const buildThreads = (comments) => {
  const byParent = new Map()
  const roots = []

  comments.forEach((comment) => {
    const parentKey = comment.parent_id || "root"
    if (!byParent.has(parentKey)) {
      byParent.set(parentKey, [])
    }
    byParent.get(parentKey).push(comment)
  })

  byParent.get("root")?.forEach((comment) => {
    roots.push(comment)
  })

  const build = (comment) => ({
    ...comment,
    replies: (byParent.get(comment.id) || []).map(build),
  })

  return roots.map(build)
}

export default function SocialPostPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [post, setPost] = useState(null)
  const [loadingPost, setLoadingPost] = useState(true)
  const [postError, setPostError] = useState("")
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentError, setCommentError] = useState("")
  const [commentText, setCommentText] = useState("")
  const [replyTo, setReplyTo] = useState(null)
  const [commentSubmitting, setCommentSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    const loadPost = async () => {
      setLoadingPost(true)
      setPostError("")
      try {
        const data = await fetchSocialPost(id, user?.id)
        if (active) {
          setPost(data)
        }
      } catch (error) {
        if (active) {
          setPost(null)
          setPostError(error.message || "Post not found.")
        }
      } finally {
        if (active) setLoadingPost(false)
      }
    }

    loadPost()

    return () => {
      active = false
    }
  }, [id, user?.id])

  useEffect(() => {
    let active = true

    const loadComments = async () => {
      setLoadingComments(true)
      setCommentError("")
      try {
        const data = await fetchSocialComments(id)
        if (active) {
          setComments(data)
        }
      } catch (error) {
        if (active) {
          setComments([])
          setCommentError(error.message || "Could not load comments.")
        }
      } finally {
        if (active) setLoadingComments(false)
      }
    }

    loadComments()

    return () => {
      active = false
    }
  }, [id])

  const commentThreads = useMemo(() => buildThreads(comments), [comments])

  const handleToggleReaction = async (type) => {
    if (!user || !post) return
    const current =
      type === "like" ? post.is_liked : type === "repost" ? post.is_reposted : post.is_saved
    const countKey = type === "like" ? "like_count" : type === "repost" ? "repost_count" : "save_count"
    const activeKey = type === "like" ? "is_liked" : type === "repost" ? "is_reposted" : "is_saved"
    const nextActive = !current

    setPost((prev) => ({
      ...prev,
      [activeKey]: nextActive,
      [countKey]: Math.max(0, (prev[countKey] || 0) + (nextActive ? 1 : -1)),
    }))

    try {
      await toggleReaction({ postId: post.id, userId: user.id, type, isActive: current })
    } catch (error) {
      setPost((prev) => ({
        ...prev,
        [activeKey]: current,
        [countKey]: post[countKey] || 0,
      }))
    }
  }

  const handleSubmitComment = async () => {
    if (!user || !commentText.trim()) return
    const profile = buildUserProfile(user)
    setCommentSubmitting(true)
    setCommentError("")

    try {
      const created = await createSocialComment({
        post_id: id,
        user_id: user.id,
        parent_id: replyTo?.id || null,
        content: commentText.trim(),
        user_display_name: profile.displayName,
        user_handle: profile.handle,
        user_avatar_url: profile.avatarUrl,
      })

      setComments((prev) => [...prev, created])
      setCommentText("")
      setReplyTo(null)
      awardXp(user, XP_ACTIONS.social_comment, "social_comment")
    } catch (error) {
      setCommentError(error.message || "Could not post comment.")
    } finally {
      setCommentSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!user) return
    try {
      await deleteSocialComment(commentId, user.id)
      setComments((prev) => prev.filter((comment) => comment.id !== commentId))
    } catch (error) {
      setCommentError(error.message || "Could not delete comment.")
    }
  }

  const renderComment = (comment, depth = 0) => {
    const avatarInitial = comment.user_display_name?.slice(0, 1).toUpperCase() || "U"
    return (
      <div key={comment.id} className="space-y-2">
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            {comment.user_avatar_url ? (
              <AvatarImage src={comment.user_avatar_url} alt={comment.user_display_name || "User"} />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-500 text-white text-xs">
              {avatarInitial}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{comment.user_display_name || "User"}</span>
              <span>{comment.user_handle || ""}</span>
              <span>-</span>
              <span>{new Date(comment.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm mt-1">{comment.content}</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setReplyTo(comment)}
              >
                <CornerUpRight className="h-3 w-3" />
                Reply
              </Button>
              {user?.id === comment.user_id && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs gap-1 text-destructive"
                  onClick={() => handleDeleteComment(comment.id)}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
        {comment.replies?.length ? (
          <div className="ml-10 space-y-3 border-l border-border/50 pl-4">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        ) : null}
      </div>
    )
  }

  const handleReportPost = async () => {
    if (!user || !post) return
    try {
      await reportSocialPost({
        postId: post.id,
        reporterId: user.id,
        target: {
          label: post.content?.slice(0, 140),
          url: `/social/${post.id}`,
          userId: post.user_id,
          userHandle: post.user_handle,
          userDisplayName: post.user_display_name,
          userAvatarUrl: post.user_avatar_url,
        },
      })
      addNotification(user.id, {
        title: "Report sent",
        message: "Thanks for letting us know. We'll review this post.",
        type: "report",
      })
    } catch (error) {
      addNotification(user.id, {
        title: "Report failed",
        message: error.message || "Could not report this post.",
        type: "report",
      })
    }
  }

  const handleReportUser = async () => {
    if (!user || !post?.user_id) return
    try {
      await reportContent({
        reporterId: user.id,
        targetType: "profile",
        targetId: post.user_id,
        targetLabel: post.user_display_name || post.user_handle || "Profile",
        targetUserId: post.user_id,
        targetUserHandle: post.user_handle,
        targetUserDisplayName: post.user_display_name,
        targetUserAvatarUrl: post.user_avatar_url,
      })
      addNotification(user.id, {
        title: "Profile reported",
        message: "We'll review this profile shortly.",
        type: "report",
      })
    } catch (error) {
      addNotification(user.id, {
        title: "Report failed",
        message: error.message || "Could not report this profile.",
        type: "report",
      })
    }
  }

  const handleMuteUser = async () => {
    if (!user || !post?.user_id) return
    const ids = Array.isArray(user?.user_metadata?.muted_user_ids)
      ? user.user_metadata.muted_user_ids
      : []
    const nextIds = Array.from(new Set([...ids.map((value) => String(value)), String(post.user_id)]))
    const { error } = await client.auth.updateUser({
      data: { muted_user_ids: nextIds },
    })

    if (error) {
      console.error("Failed to mute user:", error)
      return
    }

    addNotification(user.id, {
      title: "User muted",
      message: "This user will no longer appear in your feed.",
      type: "mute",
    })
    setPost(null)
    setPostError("You muted this user.")
  }

  const clipUrl = post?.clip_url || ""
  const clipMeta = clipUrl ? parseVideoUrl(clipUrl) : null
  const linkEmbed = clipUrl
    ? {
        url: clipUrl,
        title: post?.content?.slice(0, 80) || "Watch clip",
        thumbnails: clipMeta?.thumbnail ? [clipMeta.thumbnail] : [],
        siteName: clipMeta?.site,
        type: "video",
      }
    : undefined

  const handleVotePoll = async (optionIndex) => {
    if (!user || !post || !Array.isArray(post.poll_counts)) return
    const previousCounts = post.poll_counts
    const previousVote = post.poll_user_vote
    const nextCounts = [...previousCounts]

    if (Number.isInteger(previousVote)) {
      nextCounts[previousVote] = Math.max(0, (nextCounts[previousVote] || 0) - 1)
    }
    nextCounts[optionIndex] = (nextCounts[optionIndex] || 0) + 1
    const nextTotal = nextCounts.reduce((sum, value) => sum + value, 0)

    setPost((prev) => ({
      ...prev,
      poll_counts: nextCounts,
      poll_total: nextTotal,
      poll_user_vote: optionIndex,
    }))

    try {
      await voteOnPoll({ postId: post.id, userId: user.id, optionIndex })
    } catch (error) {
      setPost((prev) => ({
        ...prev,
        poll_counts: previousCounts,
        poll_total: previousCounts.reduce((sum, value) => sum + value, 0),
        poll_user_vote: previousVote,
      }))
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="pt-28 pb-20 md:pb-8">
        <div className="mx-auto max-w-4xl px-4 space-y-6">
          {loadingPost ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground">Loading post...</CardContent>
            </Card>
          ) : postError ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground">{postError}</CardContent>
            </Card>
          ) : post ? (
            <SocialPost
              post={{
                id: post.id,
                user: {
                  name: post.user_display_name || "User",
                  handle: post.user_handle || "@user",
                  avatar: post.user_display_name?.slice(0, 1).toUpperCase() || "U",
                },
                userAvatarUrl: post.user_avatar_url || undefined,
                content: post.content,
                timestamp: new Date(post.created_at).toLocaleString(),
                isLiked: post.is_liked,
                isReposted: post.is_reposted,
                isSaved: post.is_saved,
                likes: post.like_count || 0,
                reposts: post.repost_count || 0,
                comments: post.comment_count || 0,
                hasSpoilers: post.has_spoilers,
                spoilerRange: post.spoiler_range,
                attachedMedia: post.attached_media_title,
                attachedMediaId: post.attached_media_id,
                attachedList: post.attached_list_name,
                attachedListId: post.attached_list_id,
                fandom: post.fandom,
                postType: post.post_type,
                linkEmbed,
                pollOptions: post.poll_options,
                pollCounts: post.poll_counts,
                pollTotal: post.poll_total,
                pollUserVote: post.poll_user_vote,
                postUrl: `/social/${post.id}`,
              }}
              onToggleLike={() => handleToggleReaction("like")}
              onToggleRepost={() => handleToggleReaction("repost")}
              onToggleSave={() => handleToggleReaction("save")}
              onVotePoll={user ? handleVotePoll : undefined}
              onReport={user ? handleReportPost : undefined}
              onReportUser={user ? handleReportUser : undefined}
              onMuteUser={user ? handleMuteUser : undefined}
            />
          ) : null}

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!user ? (
                <p className="text-sm text-muted-foreground">Sign in to join the discussion.</p>
              ) : (
                <div className="space-y-2">
                  {replyTo && (
                    <div className="rounded-lg border border-border/50 bg-secondary/30 p-2 text-xs text-muted-foreground">
                      Replying to {replyTo.user_display_name || "User"}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-2 h-6 px-2 text-xs"
                        onClick={() => setReplyTo(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                  <Textarea
                    placeholder="Write a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="min-h-24"
                  />
                  {commentError && <p className="text-xs text-destructive">{commentError}</p>}
                  <Button
                    onClick={handleSubmitComment}
                    disabled={commentSubmitting || !commentText.trim()}
                  >
                    {commentSubmitting ? "Posting..." : "Post Comment"}
                  </Button>
                </div>
              )}

              {loadingComments ? (
                <p className="text-sm text-muted-foreground">Loading comments...</p>
              ) : commentThreads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                <div className="space-y-4">
                  {commentThreads.map((comment) => renderComment(comment))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}



