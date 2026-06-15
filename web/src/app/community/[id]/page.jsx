"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Navigation } from "@/components/layout/Navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  MessageCircle,
  Trash2,
  CornerUpRight,
  Heart,
  Bookmark,
  Send,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  List,
  Play,
  Check,
  Clock,
} from "lucide-react"
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
import { parseVideoUrl } from "@/lib/video-utils"
import { awardXp, XP_ACTIONS } from "@/lib/xp"
import { addNotification } from "@/lib/notifications-store"
import { reportContent } from "@/lib/reporting"

const formatRelativeTime = (value) => {
  if (!value) return ""
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return ""
  const diffSeconds = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSeconds < 60) return "just now"
  const minutes = Math.floor(diffSeconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

const formatCompact = (value) => {
  const number = Number(value || 0)
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`
  return `${number}`
}

const buildPostTags = (post) => {
  const tags = []
  if (post?.fandom) tags.push(post.fandom)
  if (post?.post_type && post.post_type !== "text") tags.push(post.post_type.replace(/-/g, " "))
  if (post?.attached_list_name) tags.push("list")
  if (post?.has_spoilers) tags.push(post?.spoiler_range ? `spoilers ${post.spoiler_range}` : "spoilers")
  return Array.from(new Set(tags)).slice(0, 4)
}

const buildThreads = (comments) => {
  const byParent = new Map()
  const roots = []

  comments.forEach((comment) => {
    const parentKey = comment.parent_id || "root"
    if (!byParent.has(parentKey)) byParent.set(parentKey, [])
    byParent.get(parentKey).push(comment)
  })

  ;(byParent.get("root") || []).forEach((comment) => roots.push(comment))

  const build = (comment) => ({
    ...comment,
    replies: (byParent.get(comment.id) || []).map(build),
  })

  return roots.map(build)
}

function CommunityThreadPostCard({ post, onToggleLike, onToggleSave }) {
  const [isExpandedSpoiler, setIsExpandedSpoiler] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const avatarInitial = post?.user_display_name?.slice(0, 1).toUpperCase() || "U"
  const userHandle = post?.user_handle || "@user"
  const profileHandle = String(userHandle).replace(/^@/, "")
  const profileHref = profileHandle ? `/u/${encodeURIComponent(profileHandle)}` : null
  const postTags = buildPostTags(post)
  const clipMeta = post?.clip_url ? parseVideoUrl(post.clip_url) : null

  const handleShare = async () => {
    if (typeof window === "undefined") return
    const url = `${window.location.origin}/community/${post.id}`
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 1500)
    } catch (error) {
      window.prompt("Copy this link:", url)
    }
  }

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:bg-card/80">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="size-10 ring-2 ring-border/50">
                {post?.user_avatar_url ? (
                  <AvatarImage src={post.user_avatar_url} alt={post.user_display_name || "User"} />
                ) : null}
                <AvatarFallback>{avatarInitial}</AvatarFallback>
              </Avatar>
            </div>
            <div>
              <div className="flex items-center gap-2">
                {profileHref ? (
                  <Link href={profileHref} className="font-semibold text-foreground hover:text-primary">
                    {post?.user_display_name || "User"}
                  </Link>
                ) : (
                  <span className="font-semibold text-foreground">{post?.user_display_name || "User"}</span>
                )}
                {post?.has_spoilers ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 px-2 py-0.5 text-xs text-amber-500">
                    <AlertTriangle className="size-3" />
                    Spoiler
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-3" />
                <span>{formatRelativeTime(post?.created_at)}</span>
                {(post?.attached_media_title || post?.attached_list_name || post?.fandom) ? <span>•</span> : null}
                {post?.attached_media_title ? (
                  <span>{post.attached_media_title}</span>
                ) : post?.attached_list_name ? (
                  <span>{post.attached_list_name}</span>
                ) : post?.fandom ? (
                  <span>{post.fandom}</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {post?.has_spoilers && !isExpandedSpoiler ? (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-sm font-medium text-amber-300">
              This post contains spoilers{post?.spoiler_range ? ` up to ${post.spoiler_range}` : ""}.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-amber-500/30 bg-transparent text-amber-200 hover:bg-amber-500/10"
              onClick={() => setIsExpandedSpoiler(true)}
            >
              Show Post
            </Button>
          </div>
        ) : (
          <p className="mb-4 whitespace-pre-wrap text-foreground/90 leading-relaxed">{post?.content}</p>
        )}

        {postTags.length ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {postTags.map((tag) => (
              <span key={`${post.id}-${tag}`} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {post?.attached_media_title ? (
          <Link href={post?.attached_media_id ? `/media/${post.attached_media_id}` : "/search"} className="mb-4 block">
            <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-muted/30 p-3 transition-colors hover:border-primary/30">
              <div className="flex size-16 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Play className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-medium text-foreground">{post.attached_media_title}</h4>
                <p className="text-sm text-muted-foreground">Attached anime</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </Link>
        ) : post?.attached_list_name ? (
          <Link href={post?.attached_list_id ? `/lists/${post.attached_list_id}` : "/lists"} className="mb-4 block">
            <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-muted/30 p-3 transition-colors hover:border-primary/30">
              <div className="flex size-16 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <List className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-medium text-foreground">{post.attached_list_name}</h4>
                <p className="text-sm text-muted-foreground">Attached community list</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </Link>
        ) : clipMeta ? (
          <a
            href={post.clip_url}
            target="_blank"
            rel="noreferrer"
            className="mb-4 block rounded-xl border border-border/30 bg-muted/30 p-3 transition-colors hover:border-primary/30"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-lg bg-muted/50">
                {clipMeta.thumbnail ? (
                  <img src={clipMeta.thumbnail} alt="Clip thumbnail" className="h-full w-full object-cover" />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <Play className="size-5 text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-medium text-foreground">Attached Clip</h4>
                <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">{clipMeta.site}</p>
              </div>
              <ExternalLink className="size-4 text-muted-foreground" />
            </div>
          </a>
        ) : null}

        <div className="flex items-center justify-between border-t border-border/30 pt-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1.5 ${post?.is_liked ? "text-red-500" : "text-muted-foreground"}`}
              onClick={onToggleLike}
            >
              <Heart className={`size-4 ${post?.is_liked ? "fill-current" : ""}`} />
              <span>{formatCompact(post?.like_count)}</span>
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <MessageCircle className="size-4" />
              <span>{formatCompact(post?.comment_count)}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1.5 ${post?.is_saved ? "text-primary" : "text-muted-foreground"}`}
              onClick={onToggleSave}
            >
              <Bookmark className={`size-4 ${post?.is_saved ? "fill-current" : ""}`} />
              <span>{formatCompact(post?.save_count)}</span>
            </Button>
          </div>

          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleShare}>
            {shareCopied ? <Check className="size-4" /> : <Send className="size-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CommunityPostPage() {
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
        if (!active) return
        setPost(data)
      } catch (error) {
        if (!active) return
        setPost(null)
        setPostError(error.message || "Post not found.")
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
        if (!active) return
        setComments(data)
      } catch (error) {
        if (!active) return
        setComments([])
        setCommentError(error.message || "Could not load comments.")
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
      [countKey]: Math.max(0, Number(prev?.[countKey] || 0) + (nextActive ? 1 : -1)),
    }))

    try {
      await toggleReaction({ postId: post.id, userId: user.id, type, isActive: current })
    } catch (error) {
      setPost((prev) => ({
        ...prev,
        [activeKey]: current,
        [countKey]: post?.[countKey] || 0,
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
      setPost((prev) => (prev ? { ...prev, comment_count: Number(prev.comment_count || 0) + 1 } : prev))
      setCommentText("")
      setReplyTo(null)
      await awardXp(user, XP_ACTIONS.social_comment, "social_comment")
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
      setPost((prev) =>
        prev ? { ...prev, comment_count: Math.max(0, Number(prev.comment_count || 0) - 1) } : prev,
      )
    } catch (error) {
      setCommentError(error.message || "Could not delete comment.")
    }
  }

  const handleReportPost = async () => {
    if (!user || !post) return
    try {
      await reportSocialPost({
        postId: post.id,
        reporterId: user.id,
        target: {
          label: post.content?.slice(0, 140),
          url: `/community/${post.id}`,
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
    const ids = Array.isArray(user?.user_metadata?.muted_user_ids) ? user.user_metadata.muted_user_ids : []
    const nextIds = Array.from(new Set([...ids.map((value) => String(value)), String(post.user_id)]))
    const { error } = await client.auth.updateUser({ data: { muted_user_ids: nextIds } })
    if (error) return

    addNotification(user.id, {
      title: "User muted",
      message: "This user will no longer appear in your feed.",
      type: "mute",
    })
    setPost(null)
    setPostError("You muted this user.")
  }

  const handleVotePoll = async (optionIndex) => {
    if (!user || !post || !Array.isArray(post.poll_counts)) return
    const previousCounts = post.poll_counts
    const previousVote = post.poll_user_vote
    const nextCounts = [...previousCounts]

    if (Number.isInteger(previousVote)) {
      nextCounts[previousVote] = Math.max(0, Number(nextCounts[previousVote] || 0) - 1)
    }
    nextCounts[optionIndex] = Number(nextCounts[optionIndex] || 0) + 1
    const nextTotal = nextCounts.reduce((sum, value) => sum + Number(value || 0), 0)

    setPost((prev) => ({ ...prev, poll_counts: nextCounts, poll_total: nextTotal, poll_user_vote: optionIndex }))

    try {
      await voteOnPoll({ postId: post.id, userId: user.id, optionIndex })
    } catch (error) {
      setPost((prev) => ({
        ...prev,
        poll_counts: previousCounts,
        poll_total: previousCounts.reduce((sum, value) => sum + Number(value || 0), 0),
        poll_user_vote: previousVote,
      }))
    }
  }

  const renderComment = (comment) => {
    const avatarInitial = comment.user_display_name?.slice(0, 1).toUpperCase() || "U"
    return (
      <div key={comment.id} className="space-y-3">
        <div className="rounded-2xl border border-border/40 bg-card/40 p-4 backdrop-blur-sm">
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-border/40">
            {comment.user_avatar_url ? <AvatarImage src={comment.user_avatar_url} alt={comment.user_display_name || "User"} /> : null}
            <AvatarFallback className="bg-muted text-xs text-foreground">
              {avatarInitial}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{comment.user_display_name || "User"}</span>
              <span>{comment.user_handle || ""}</span>
              <span>•</span>
              <span>{formatRelativeTime(comment.created_at)}</span>
            </div>
            <p className="mt-2 text-sm text-foreground/90">{comment.content}</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => setReplyTo(comment)}>
                <CornerUpRight className="h-3 w-3" />
                Reply
              </Button>
              {user?.id === comment.user_id ? (
                <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-destructive" onClick={() => handleDeleteComment(comment.id)}>
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        </div>
        {comment.replies?.length ? <div className="ml-10 space-y-3 border-l border-border/50 pl-4">{comment.replies.map(renderComment)}</div> : null}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pb-20 pt-28 md:pb-8">
        <div className="mx-auto max-w-4xl space-y-6 px-4">
          {loadingPost ? (
            <Card className="bg-card/50 border-border/50"><CardContent className="py-12 text-center text-muted-foreground">Loading post...</CardContent></Card>
          ) : postError ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground">
                {postError}
                <div className="mt-4">
                  <Button asChild variant="outline"><Link href="/community">Back to community</Link></Button>
                </div>
              </CardContent>
            </Card>
          ) : post ? (
            <CommunityThreadPostCard
              post={post}
              onToggleLike={() => handleToggleReaction("like")}
              onToggleSave={() => handleToggleReaction("save")}
            />
          ) : null}

          <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageCircle className="h-4 w-4" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!user ? (
                <p className="text-sm text-muted-foreground">Sign in to join the discussion.</p>
              ) : (
                <div className="space-y-2">
                  {replyTo ? (
                    <div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
                      Replying to {replyTo.user_display_name || "User"}
                      <Button size="sm" variant="ghost" className="ml-2 h-6 px-2 text-xs" onClick={() => setReplyTo(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : null}
                  <Textarea
                    placeholder="Write a comment..."
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    className="min-h-24 border-border/50 bg-muted/30"
                  />
                  {commentError ? <p className="text-xs text-destructive">{commentError}</p> : null}
                  <Button onClick={handleSubmitComment} disabled={commentSubmitting || !commentText.trim()}>
                    {commentSubmitting ? "Posting..." : "Post Comment"}
                  </Button>
                </div>
              )}

              {loadingComments ? (
                <p className="text-sm text-muted-foreground">Loading comments...</p>
              ) : commentThreads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                <div className="space-y-4">{commentThreads.map(renderComment)}</div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
