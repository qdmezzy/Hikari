"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { MessageCircle, Heart, Send, Loader2, Trash2, Star, Plus, Pencil, Pin, Megaphone, Eye, Flag, Check } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Navigation } from "@/components/layout/Navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { fetchActivityFeed, fetchRecentReviews, postStatus } from "@/lib/activity-service"
import {
  buildUserProfile,
  createSocialComment,
  deleteSocialComment,
  fetchFollowingIds,
  fetchSocialComments,
  reportSocialPost,
  toggleReaction,
} from "@/lib/social-service"
import {
  createAnnouncement,
  createForumThread,
  deleteAnnouncement,
  deleteForumThread,
  fetchAnnouncements,
  fetchForumThreads,
  updateAnnouncement,
  updateForumThread,
} from "@/lib/community-content-service"
import { fetchAniListMediaByIds } from "@/lib/anilist"
import { awardXp, XP_ACTIONS } from "@/lib/xp"

const DISCORD_COMMUNITY_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "/discord/link"

function formatRelativeTime(value) {
  if (!value) return ""
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return ""
  const diffSeconds = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSeconds < 60) return diffSeconds <= 1 ? "just now" : `${diffSeconds} seconds ago`
  const minutes = Math.floor(diffSeconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function formatCompact(n) {
  const num = Number(n || 0)
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return `${num}`
}

function ActivityItem({ post, coverImage, user }) {
  const [liked, setLiked] = useState(Boolean(post.is_liked))
  const [likeCount, setLikeCount] = useState(Number(post.like_count || 0))
  const [likePending, setLikePending] = useState(false)

  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentCount, setCommentCount] = useState(Number(post.comment_count || 0))
  const [reportState, setReportState] = useState("idle") // idle | reporting | reported

  const profileHandle = String(post.user_handle || "").replace(/^@/, "")
  const profileHref = profileHandle ? `/u/${encodeURIComponent(profileHandle)}` : null
  const mediaHref = post.attached_media_id ? `/media/${post.attached_media_id}` : null
  const initial = post.user_display_name?.slice(0, 1)?.toUpperCase() || "U"
  // A user-written status has no attached media; render it avatar-first.
  const isStatus = !post.attached_media_id

  const handleLike = async () => {
    if (!user || likePending) return
    const wasLiked = liked
    setLikePending(true)
    setLiked(!wasLiked)
    setLikeCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)))
    try {
      await toggleReaction({ postId: post.id, userId: user.id, type: "like", isActive: wasLiked })
    } catch {
      setLiked(wasLiked)
      setLikeCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)))
    } finally {
      setLikePending(false)
    }
  }

  const handleReport = async () => {
    if (!user) {
      if (typeof window !== "undefined") window.location.assign("/login")
      return
    }
    if (reportState !== "idle") return
    if (user.id === post.user_id) return
    const reason =
      typeof window !== "undefined"
        ? window.prompt("Why are you reporting this post? (optional)", "")
        : ""
    if (reason === null) return // cancelled
    setReportState("reporting")
    try {
      await reportSocialPost({
        postId: post.id,
        reporterId: user.id,
        reason: reason?.trim() || "user_report",
        target: {
          label: post.content?.slice(0, 140),
          url: `/community/${post.id}`,
          userId: post.user_id,
          userHandle: post.user_handle,
          userDisplayName: post.user_display_name,
          userAvatarUrl: post.user_avatar_url,
        },
      })
      setReportState("reported")
    } catch {
      setReportState("idle")
    }
  }

  const loadComments = async () => {
    if (commentsLoaded || commentsLoading) return
    setCommentsLoading(true)
    try {
      const data = await fetchSocialComments(post.id)
      setComments(data)
      setCommentCount(data.length)
      setCommentsLoaded(true)
    } catch {
      setComments([])
    } finally {
      setCommentsLoading(false)
    }
  }

  const toggleComments = () => {
    const next = !showComments
    setShowComments(next)
    if (next) loadComments()
  }

  const handleSubmitComment = async () => {
    if (!user || !commentText.trim() || commentSubmitting) return
    const profile = buildUserProfile(user)
    setCommentSubmitting(true)
    try {
      const created = await createSocialComment({
        post_id: post.id,
        user_id: user.id,
        parent_id: null,
        content: commentText.trim(),
        user_display_name: profile.displayName,
        user_handle: profile.handle,
        user_avatar_url: profile.avatarUrl,
      })
      setComments((prev) => [...prev, created])
      setCommentCount((c) => c + 1)
      setCommentText("")
      awardXp(user, XP_ACTIONS.social_comment, "social_comment").catch(() => {})
    } catch {
      /* swallow */
    } finally {
      setCommentSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!user) return
    try {
      await deleteSocialComment(commentId, user.id)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      setCommentCount((c) => Math.max(0, c - 1))
    } catch {
      /* swallow */
    }
  }

  return (
    <div className="border-b border-border/30 last:border-0">
      <div className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/20">
        {isStatus ? (
          profileHref ? (
            <Link href={profileHref} className="flex-shrink-0">
              <Avatar className="size-10 ring-2 ring-border/30">
                {post.user_avatar_url ? (
                  <AvatarImage src={post.user_avatar_url} alt={post.user_display_name || "User"} />
                ) : null}
                <AvatarFallback className="text-xs">{initial}</AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Avatar className="size-10 flex-shrink-0 ring-2 ring-border/30">
              {post.user_avatar_url ? (
                <AvatarImage src={post.user_avatar_url} alt={post.user_display_name || "User"} />
              ) : null}
              <AvatarFallback className="text-xs">{initial}</AvatarFallback>
            </Avatar>
          )
        ) : mediaHref ? (
          <Link
            href={mediaHref}
            className="relative h-[72px] w-[52px] flex-shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm"
          >
            {coverImage ? (
              <img src={coverImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-muted/60" />
            )}
          </Link>
        ) : (
          <div className="h-[72px] w-[52px] flex-shrink-0 overflow-hidden rounded-lg bg-muted/60" />
        )}

        <div className="min-w-0 flex-1">
          {isStatus ? (
            <>
              <div className="flex items-center justify-between gap-3">
                {profileHref ? (
                  <Link href={profileHref} className="font-bold transition-colors hover:text-primary">
                    {post.user_display_name || "User"}
                  </Link>
                ) : (
                  <span className="font-bold">{post.user_display_name || "User"}</span>
                )}
                <span className="flex-shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(post.created_at)}
                </span>
              </div>
              <p className="selectable mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {post.content}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-foreground">
                {profileHref ? (
                  <Link href={profileHref} className="font-bold transition-colors hover:text-primary">
                    {post.user_display_name || "User"}
                  </Link>
                ) : (
                  <span className="font-bold">{post.user_display_name || "User"}</span>
                )}{" "}
                <span className="text-foreground/80">{post.content}</span>
                {post.attached_media_title ? (
                  <>
                    {" "}
                    of{" "}
                    {mediaHref ? (
                      <Link href={mediaHref} className="font-medium text-primary hover:underline">
                        {post.attached_media_title}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{post.attached_media_title}</span>
                    )}
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(post.created_at)}</p>
            </>
          )}
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={toggleComments}
              className="flex items-center gap-1 transition-colors hover:text-primary"
            >
              <MessageCircle className="size-3.5" />
              <span>{commentCount}</span>
            </button>
            <button
              type="button"
              onClick={handleLike}
              disabled={!user}
              className={`flex items-center gap-1 transition-colors ${
                liked ? "text-rose-500" : "hover:text-rose-500"
              } ${!user ? "cursor-not-allowed opacity-60" : ""}`}
              title={user ? "Like" : "Sign in to like"}
            >
              <Heart className={`size-3.5 ${liked ? "fill-current" : ""}`} />
              <span>{likeCount}</span>
            </button>
            {user && user.id !== post.user_id ? (
              <button
                type="button"
                onClick={handleReport}
                disabled={reportState !== "idle"}
                className={`ml-auto flex items-center gap-1 transition-colors ${
                  reportState === "reported" ? "text-emerald-500" : "hover:text-amber-500"
                }`}
                title={reportState === "reported" ? "Reported" : "Report this post"}
              >
                {reportState === "reporting" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : reportState === "reported" ? (
                  <Check className="size-3.5" />
                ) : (
                  <Flag className="size-3.5" />
                )}
              </button>
            ) : null}
          </div>
        </div>

        {!isStatus ? (
          <Avatar className="size-9 flex-shrink-0 ring-2 ring-border/30">
            {post.user_avatar_url ? (
              <AvatarImage src={post.user_avatar_url} alt={post.user_display_name || "User"} />
            ) : null}
            <AvatarFallback className="text-xs">{initial}</AvatarFallback>
          </Avatar>
        ) : null}
      </div>

      {showComments ? (
        <div className="space-y-3 border-t border-border/20 bg-muted/10 px-5 py-4">
          {commentsLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No comments yet. Be the first to reply.</p>
          ) : (
            comments.map((comment) => {
              const cInitial = comment.user_display_name?.slice(0, 1)?.toUpperCase() || "U"
              return (
                <div key={comment.id} className="flex items-start gap-3">
                  <Avatar className="size-7 flex-shrink-0 ring-1 ring-border/30">
                    {comment.user_avatar_url ? (
                      <AvatarImage src={comment.user_avatar_url} alt={comment.user_display_name || "User"} />
                    ) : null}
                    <AvatarFallback className="text-[10px]">{cInitial}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-foreground">{comment.user_display_name || "User"}</span>
                      <span className="text-muted-foreground">{formatRelativeTime(comment.created_at)}</span>
                      {user?.id === comment.user_id ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="ml-auto text-muted-foreground transition-colors hover:text-destructive"
                          aria-label="Delete comment"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      ) : null}
                    </div>
                    <p className="selectable mt-0.5 text-sm text-foreground/90">{comment.content}</p>
                  </div>
                </div>
              )
            })
          )}

          {user ? (
            <div className="flex items-center gap-2 pt-1">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmitComment()
                  }
                }}
                placeholder="Write a comment..."
                className="h-9 border-border/50 bg-background/60 text-sm"
              />
              <Button
                size="sm"
                onClick={handleSubmitComment}
                disabled={commentSubmitting || !commentText.trim()}
                className="h-9 gap-1.5"
              >
                {commentSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>{" "}
              to join the conversation.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function ActivitySkeleton() {
  return (
    <div className="flex items-start gap-4 border-b border-border/30 px-5 py-4 last:border-0">
      <div className="h-[72px] w-[52px] flex-shrink-0 animate-pulse rounded-lg bg-muted/40" />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted/40" />
        <div className="h-3 w-1/4 animate-pulse rounded bg-muted/30" />
      </div>
      <div className="size-9 flex-shrink-0 animate-pulse rounded-full bg-muted/40" />
    </div>
  )
}

function AnnouncementEditorDialog({ open, onOpenChange, initial, onSave }) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || "")
      setBody(initial?.body || "")
      setError("")
    }
  }, [open, initial])

  const handleSave = async () => {
    if (!title.trim()) {
      setError("A title is required.")
      return
    }
    setSaving(true)
    setError("")
    try {
      await onSave({ title, body })
      onOpenChange(false)
    } catch (e) {
      setError(e?.message || "Could not save announcement.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit announcement" : "New announcement"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <Input
            placeholder="Announcement title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-border/50 bg-muted/30"
          />
          <Textarea
            placeholder="Write the announcement..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-28 border-border/50 bg-muted/30"
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : initial ? "Save" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ThreadEditorDialog({ open, onOpenChange, initial, onSave }) {
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [body, setBody] = useState("")
  const [isPinned, setIsPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || "")
      setCategory(initial?.category || "general")
      setBody(initial?.body || "")
      setIsPinned(Boolean(initial?.is_pinned))
      setError("")
    }
  }, [open, initial])

  const handleSave = async () => {
    if (!title.trim()) {
      setError("A title is required.")
      return
    }
    setSaving(true)
    setError("")
    try {
      await onSave({ title, body, category, isPinned })
      onOpenChange(false)
    } catch (e) {
      setError(e?.message || "Could not save thread.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit thread" : "New forum thread"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <Input
            placeholder="Thread title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-border/50 bg-muted/30"
          />
          <Input
            placeholder="Category (e.g. anime, forum games, release discussion)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border-border/50 bg-muted/30"
          />
          <Textarea
            placeholder="Opening post..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-28 border-border/50 bg-muted/30"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Pin this thread to the top
          </label>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : initial ? "Save" : "Post thread"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AnnouncementCard({ announcement, isMod, onEdit, onDelete }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-accent/5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary/70">
          <Megaphone className="size-3" />
          Announcement
          {announcement.is_published === false ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">Draft</span>
          ) : null}
        </div>
        {isMod ? (
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onEdit(announcement)}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Edit announcement"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(announcement)}
              className="rounded p-1 text-muted-foreground hover:text-destructive"
              aria-label="Delete announcement"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
      <h3 className="mt-1 font-semibold text-foreground">{announcement.title}</h3>
      {announcement.body ? (
        <p className="selectable mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{announcement.body}</p>
      ) : null}
    </div>
  )
}

function ForumThreadItem({ thread, isMod, onEdit, onDelete }) {
  return (
    <div className="group border-b border-border/30 pb-4 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <h4 className="line-clamp-2 flex items-start gap-1.5 text-sm font-medium text-foreground">
          {thread.is_pinned ? <Pin className="mt-0.5 size-3 flex-shrink-0 text-primary" /> : null}
          {thread.title}
        </h4>
        {isMod ? (
          <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onEdit(thread)}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Edit thread"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(thread)}
              className="rounded p-1 text-muted-foreground hover:text-destructive"
              aria-label="Delete thread"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
      {thread.body ? (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{thread.body}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Eye className="size-3" />
          {formatCompact(thread.view_count || 0)}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="size-3" />
          {formatCompact(thread.reply_count || 0)}
        </span>
        {thread.category ? (
          <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {thread.category}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{thread.author_name || "Moderator"}</span> posted{" "}
        {formatRelativeTime(thread.created_at)}
      </p>
    </div>
  )
}

function ReviewCard({ review }) {
  const mediaHref = review.media_id ? `/media/${review.media_id}` : null
  const rating = Number(review.rating || 0)
  const ratingLabel = rating > 10 ? (rating / 10).toFixed(1) : rating.toFixed(rating % 1 === 0 ? 0 : 1)

  return (
    <div className="space-y-2">
      {mediaHref ? (
        <Link href={mediaHref} className="block aspect-video overflow-hidden rounded-lg bg-muted/50">
          {review.cover_image ? (
            <img src={review.cover_image} alt="" className="h-full w-full object-cover" />
          ) : null}
        </Link>
      ) : (
        <div className="aspect-video overflow-hidden rounded-lg bg-muted/50" />
      )}
      <div>
        <h4 className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
          Review of {review.media_title || "this title"} by {review.user_display_name || "User"}
        </h4>
        <p className="selectable mt-1 line-clamp-4 text-[11px] leading-relaxed text-muted-foreground">
          {review.review_text}
        </p>
        {rating > 0 ? (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3 fill-chart-3 text-chart-3" />
            <span>{ratingLabel}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function StatusComposer({ user, onPosted }) {
  const [content, setContent] = useState("")
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState("")

  const profile = user ? buildUserProfile(user) : null
  const initial = profile?.avatarInitial || "U"

  const handlePost = async () => {
    if (!user || !content.trim() || posting) return
    setPosting(true)
    setError("")
    try {
      const created = await postStatus({ user, content })
      if (created) onPosted(created)
      setContent("")
    } catch (e) {
      setError(e?.message || "Could not post your status.")
    } finally {
      setPosting(false)
    }
  }

  if (!user) {
    return (
      <div className="border-b border-border/30 px-5 py-4 text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>{" "}
        to write a status.
      </div>
    )
  }

  return (
    <div className="border-b border-border/30 px-5 py-4">
      <div className="flex items-start gap-3">
        <Avatar className="size-9 flex-shrink-0 ring-2 ring-border/30">
          {profile?.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt="You" /> : null}
          <AvatarFallback className="text-xs">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handlePost()
              }
            }}
            placeholder="Write a status..."
            className="min-h-11 resize-none border-border/50 bg-muted/30 text-sm"
          />
          {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
          <div className="mt-2 flex items-center justify-end">
            <Button size="sm" className="h-8 gap-1.5" onClick={handlePost} disabled={posting || !content.trim()}>
              {posting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              Post
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CommunityExperience({ user, isMod }) {
  const [activities, setActivities] = useState([])
  const [covers, setCovers] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(true)

  const [announcements, setAnnouncements] = useState([])
  const [threads, setThreads] = useState([])
  const [announcementEditor, setAnnouncementEditor] = useState({ open: false, initial: null })
  const [threadEditor, setThreadEditor] = useState({ open: false, initial: null })

  const [activeFeed, setActiveFeed] = useState("global")
  const [followingIds, setFollowingIds] = useState([])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!user?.id) {
        setFollowingIds([])
        return
      }
      try {
        const ids = await fetchFollowingIds(user.id)
        if (active) setFollowingIds(ids)
      } catch {
        if (active) setFollowingIds([])
      }
    }
    load()
    return () => {
      active = false
    }
  }, [user?.id])

  const handlePostStatus = (created) => {
    setActivities((prev) => [created, ...prev])
  }

  const visibleActivities =
    activeFeed === "following"
      ? activities.filter((post) => followingIds.includes(post.user_id) || post.user_id === user?.id)
      : activities

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [ann, thr] = await Promise.all([fetchAnnouncements(5), fetchForumThreads(8)])
        if (!active) return
        setAnnouncements(ann)
        setThreads(thr)
      } catch {
        if (!active) return
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const handleSaveAnnouncement = async (values) => {
    if (announcementEditor.initial) {
      const updated = await updateAnnouncement(announcementEditor.initial.id, values)
      setAnnouncements((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    } else {
      const created = await createAnnouncement({ ...values, user })
      setAnnouncements((prev) => [created, ...prev])
    }
  }

  const handleDeleteAnnouncement = async (announcement) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this announcement?")) return
    const previous = announcements
    setAnnouncements((prev) => prev.filter((a) => a.id !== announcement.id))
    try {
      await deleteAnnouncement(announcement.id)
    } catch {
      setAnnouncements(previous)
    }
  }

  const handleSaveThread = async (values) => {
    if (threadEditor.initial) {
      const updated = await updateForumThread(threadEditor.initial.id, values)
      setThreads((prev) =>
        [...prev.map((t) => (t.id === updated.id ? updated : t))].sort(
          (a, b) =>
            Number(b.is_pinned) - Number(a.is_pinned) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      )
    } else {
      const created = await createForumThread({ ...values, user })
      setThreads((prev) =>
        [created, ...prev].sort(
          (a, b) =>
            Number(b.is_pinned) - Number(a.is_pinned) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      )
    }
  }

  const handleDeleteThread = async (thread) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this thread?")) return
    const previous = threads
    setThreads((prev) => prev.filter((t) => t.id !== thread.id))
    try {
      await deleteForumThread(thread.id)
    } catch {
      setThreads(previous)
    }
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchActivityFeed(user?.id, 30)
        if (!active) return
        setActivities(data)
      } catch {
        if (!active) return
        setActivities([])
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [user?.id])

  useEffect(() => {
    let active = true
    const load = async () => {
      setReviewsLoading(true)
      try {
        const data = await fetchRecentReviews(4)
        if (!active) return
        setReviews(data)
      } catch {
        if (!active) return
        setReviews([])
      } finally {
        if (active) setReviewsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const loadCovers = async () => {
      const mediaIds = Array.from(
        new Set(activities.map((a) => Number(a?.attached_media_id)).filter(Number.isFinite)),
      )
      if (!mediaIds.length) {
        setCovers(new Map())
        return
      }
      try {
        const map = await fetchAniListMediaByIds(mediaIds)
        if (!active) return
        const coverMap = new Map()
        map.forEach((media, id) => {
          coverMap.set(Number(id), media?.coverImage?.large || media?.coverImage?.extraLarge || null)
        })
        setCovers(coverMap)
      } catch {
        if (!active) return
      }
    }
    loadCovers()
    return () => {
      active = false
    }
  }, [activities])

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Activity */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Activity
              </h2>
              <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-card/40 p-0.5">
                {[
                  { id: "following", label: "Following" },
                  { id: "global", label: "Global" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFeed(tab.id)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      activeFeed === tab.id
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm">
              <StatusComposer user={user} onPosted={handlePostStatus} />
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <ActivitySkeleton key={i} />)
              ) : visibleActivities.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  {activeFeed === "following"
                    ? "Nothing from people you follow yet."
                    : "No activity yet. Write a status or update your list to start the feed!"}
                </div>
              ) : (
                visibleActivities.map((post) => (
                  <ActivityItem
                    key={post.id}
                    post={post}
                    coverImage={covers.get(Number(post.attached_media_id)) || null}
                    user={user}
                  />
                ))
              )}
            </div>
          </section>

          {/* Right sidebar */}
          <aside className="space-y-5">
            {/* Announcements */}
            {announcements.length > 0 || isMod ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Announcements
                  </h3>
                  {isMod ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => setAnnouncementEditor({ open: true, initial: null })}
                    >
                      <Plus className="size-3.5" />
                      New
                    </Button>
                  ) : null}
                </div>
                {announcements.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">
                    No announcements yet. Create one to greet the community.
                  </p>
                ) : (
                  announcements.map((announcement) => (
                    <AnnouncementCard
                      key={announcement.id}
                      announcement={announcement}
                      isMod={isMod}
                      onEdit={(a) => setAnnouncementEditor({ open: true, initial: a })}
                      onDelete={handleDeleteAnnouncement}
                    />
                  ))
                )}
              </div>
            ) : null}

            {/* Forum Activity */}
            <div className="rounded-xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Forum Activity</h3>
                {isMod ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => setThreadEditor({ open: true, initial: null })}
                  >
                    <Plus className="size-3.5" />
                    New
                  </Button>
                ) : null}
              </div>
              {threads.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {isMod ? "No threads yet. Start the first discussion." : "No threads yet."}
                </p>
              ) : (
                <div className="space-y-4">
                  {threads.map((thread) => (
                    <ForumThreadItem
                      key={thread.id}
                      thread={thread}
                      isMod={isMod}
                      onEdit={(t) => setThreadEditor({ open: true, initial: t })}
                      onDelete={handleDeleteThread}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Recent Reviews */}
            <div className="rounded-xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm">
              <h3 className="mb-4 font-semibold text-foreground">Recent Reviews</h3>
              {reviewsLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="aspect-video animate-pulse rounded-lg bg-muted/40" />
                      <div className="h-3 w-3/4 animate-pulse rounded bg-muted/40" />
                      <div className="h-2.5 w-full animate-pulse rounded bg-muted/30" />
                    </div>
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No reviews yet. Be the first to review a title.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {isMod ? (
        <>
          <AnnouncementEditorDialog
            open={announcementEditor.open}
            onOpenChange={(open) => setAnnouncementEditor((prev) => ({ ...prev, open }))}
            initial={announcementEditor.initial}
            onSave={handleSaveAnnouncement}
          />
          <ThreadEditorDialog
            open={threadEditor.open}
            onOpenChange={(open) => setThreadEditor((prev) => ({ ...prev, open }))}
            initial={threadEditor.initial}
            onSave={handleSaveThread}
          />
        </>
      ) : null}
    </div>
  )
}

function CommunityComingSoonPage() {
  const [discordStats, setDiscordStats] = useState({
    memberCount: null,
    onlineCount: null,
    guildName: "Hikari Discord",
    inviteUrl: DISCORD_COMMUNITY_URL,
    inviteCode: null,
    description: null,
    iconUrl: null,
    bannerUrl: null,
    loading: true,
  })

  useEffect(() => {
    let active = true

    const loadDiscordStats = async () => {
      try {
        const res = await fetch(`/api/discord/server?t=${Date.now()}`, { cache: "no-store" })
        const json = await res.json()
        if (!active) return
        setDiscordStats({
          memberCount: typeof json?.memberCount === "number" ? json.memberCount : null,
          onlineCount: typeof json?.onlineCount === "number" ? json.onlineCount : null,
          guildName: json?.guildName || "Hikari Discord",
          inviteUrl: json?.inviteUrl || DISCORD_COMMUNITY_URL,
          inviteCode: json?.inviteCode || null,
          description: json?.description || null,
          iconUrl: json?.iconUrl || null,
          bannerUrl: json?.bannerUrl || null,
          loading: false,
        })
      } catch {
        if (!active) return
        setDiscordStats((prev) => ({ ...prev, loading: false }))
      }
    }

    loadDiscordStats()

    return () => {
      active = false
    }
  }, [])

  const inviteLabel = discordStats.inviteCode
    ? `https://discord.gg/${discordStats.inviteCode}`
    : "https://discord.gg/hikari"

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="relative overflow-hidden pt-28 pb-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-12 h-80 w-80 -translate-x-1/2 rounded-full bg-[#5865F2]/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-md px-4">
          <div className="mb-5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/38">Community Coming Soon</p>
            <p className="mt-3 text-sm leading-7 text-white/58">Join the Discord in the meantime.</p>
          </div>

          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#1e1f22] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
            <div className="px-4 pt-3 text-xs font-medium text-[#00A8FC]">{inviteLabel}</div>

            <div
              className="mt-2 h-24 w-full border-b border-white/6 bg-[#2b2d31] bg-cover bg-center"
              style={discordStats.bannerUrl ? { backgroundImage: `url(${discordStats.bannerUrl})` } : undefined}
            />

            <div className="px-4 pb-4">
              <div className="-mt-8 flex items-end">
                <div className="size-16 overflow-hidden rounded-[18px] border-4 border-[#1e1f22] bg-[#232428] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                  {discordStats.iconUrl ? (
                    <img src={discordStats.iconUrl} alt={discordStats.guildName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#313338] text-white">
                      <MessageCircle className="size-7 text-white/80" />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <h2 className="text-[27px] font-semibold leading-tight text-white">{discordStats.guildName}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#B5BAC1]">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#23A559]" />
                    <span>
                      {discordStats.loading
                        ? "Loading..."
                        : `${discordStats.onlineCount != null ? formatCompact(discordStats.onlineCount) : "--"} Online`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#80848E]" />
                    <span>
                      {discordStats.loading
                        ? "Loading..."
                        : `${discordStats.memberCount != null ? formatCompact(discordStats.memberCount) : "--"} Members`}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#B5BAC1]">
                  {discordStats.description ||
                    "Join the Hikari Discord for updates, conversation, and early access when community opens."}
                </p>
              </div>

              <Button
                asChild
                className="mt-5 h-11 w-full rounded-[10px] bg-[#23A559] text-base font-semibold text-white hover:bg-[#1f8b4d]"
              >
                <Link href={discordStats.inviteUrl || DISCORD_COMMUNITY_URL} target="_blank" rel="noreferrer">
                  Join
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function CommunityPage() {
  const { user, loading } = useAuth()
  const isMod = user?.app_metadata?.is_mod === true || user?.app_metadata?.isMod === true

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!isMod) {
    return <CommunityComingSoonPage />
  }

  return <CommunityExperience user={user} isMod={isMod} />
}
