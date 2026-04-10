"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Search,
  Plus,
  Share2,
  TrendingUp,
  Users,
  BarChart3,
  Heart,
  MessageCircle,
  Bookmark,
  Send,
  Flame,
  Clock,
  AlertTriangle,
  Star,
  ChevronRight,
  Hash,
  Shield,
  ExternalLink,
  List,
  Play,
  Check,
  ThumbsUp,
  Eye,
  X,
} from "lucide-react"
import { Navigation } from "@/components/Navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { addNotification } from "@/lib/notifications-store"
import {
  buildUserProfile,
  createSocialPost,
  fetchFollowingIds,
  fetchSocialPosts,
  toggleFollow,
  toggleReaction,
  voteOnPoll,
} from "@/lib/social-service"
import { emitSocialFollowing, emitSocialPosts, subscribeSocialFollowing, subscribeSocialPosts } from "@/lib/social-events"
import { fetchAniListMediaByIds, getMediaHref, getMediaTitle } from "@/lib/anilist"
import { parseVideoUrl } from "@/lib/video-utils"
import { awardXp, XP_ACTIONS } from "@/lib/xp"
import { upsertPublicProfile } from "@/lib/public-profile"
import { cn } from "@/lib/utils"

const DISCORD_COMMUNITY_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "/discord/link"

const COMMUNITY_MEDIA_SEARCH = `
query ($search: String, $perPage: Int) {
  Page(perPage: $perPage) {
    media(search: $search, sort: POPULARITY_DESC) {
      id
      type
      title { romaji english }
      coverImage { large }
    }
  }
}
`

const quickActivityCards = [
  {
    id: "threads",
    title: "Trending Discussions",
    icon: TrendingUp,
    key: "threads",
    label: "active posts",
    color: "from-primary/20 to-accent/10",
  },
  {
    id: "friends",
    title: "People Following",
    icon: Users,
    key: "following",
    label: "in your circle",
    color: "from-accent/20 to-primary/10",
  },
  {
    id: "polls",
    title: "Weekly Polls",
    icon: BarChart3,
    key: "polls",
    label: "votes cast",
    color: "from-sparkle/20 to-accent/10",
  },
]

const feedTabs = [
  { id: "for-you", label: "For You" },
  { id: "following", label: "Following" },
  { id: "global", label: "Global" },
]

const sortOptions = [
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" },
  { value: "most-liked", label: "Most liked" },
]

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

const getPostTags = (post) => {
  const tags = []
  if (post?.fandom) tags.push(post.fandom)
  if (post?.post_type && post.post_type !== "text") tags.push(post.post_type.replace(/-/g, " "))
  if (post?.attached_list_name) tags.push("list")
  if (post?.has_spoilers) tags.push(post?.spoiler_range ? `spoilers ${post.spoiler_range}` : "spoilers")
  return Array.from(new Set(tags)).slice(0, 4)
}

const getSortScore = (post) =>
  Number(post?.like_count || 0) +
  Number(post?.repost_count || 0) * 2 +
  Number(post?.comment_count || 0) * 1.5 +
  Number(post?.poll_total || 0)

function CommunityComposer({
  onCreate,
  availableFandoms = [],
  isAuthenticated = false,
  avatarUrl,
  avatarInitial = "U",
}) {
  const [content, setContent] = useState("")
  const [fandomInput, setFandomInput] = useState("")
  const [showTagInput, setShowTagInput] = useState(false)
  const [attachedMedia, setAttachedMedia] = useState(null)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [mediaQuery, setMediaQuery] = useState("")
  const [mediaResults, setMediaResults] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaError, setMediaError] = useState("")

  useEffect(() => {
    if (!mediaOpen) return
    const query = mediaQuery.trim()
    if (query.length < 2) {
      setMediaResults([])
      setMediaError("")
      setMediaLoading(false)
      return
    }

    let active = true
    setMediaLoading(true)
    setMediaError("")

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/anilist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: COMMUNITY_MEDIA_SEARCH,
            variables: { search: query, perPage: 6 },
          }),
        })
        const json = await res.json()
        if (!res.ok || json?.errors) {
          throw new Error(json?.errors?.[0]?.message || "Search failed")
        }
        const media = json?.data?.Page?.media || []
        if (!active) return
        setMediaResults(
          media.map((item) => ({
            id: item.id,
            title: item.title?.english || item.title?.romaji || "Untitled",
            type: item.type,
            coverImage: item.coverImage?.large || "",
          })),
        )
      } catch (error) {
        if (!active) return
        setMediaError("Could not load matches.")
        setMediaResults([])
      } finally {
        if (active) setMediaLoading(false)
      }
    }, 300)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [mediaOpen, mediaQuery])

  const resetComposer = () => {
    setContent("")
    setFandomInput("")
    setShowTagInput(false)
    setAttachedMedia(null)
    setMediaOpen(false)
    setMediaQuery("")
    setMediaResults([])
    setMediaError("")
    setMediaLoading(false)
  }

  const handleSelectMedia = (media) => {
    setAttachedMedia(media)
    setMediaOpen(false)
    setMediaQuery("")
    setMediaResults([])
    if (!fandomInput.trim()) {
      setFandomInput(media.title)
    }
  }

  const handlePost = () => {
    if (!isAuthenticated || !content.trim() || !onCreate) return
    onCreate({
      content: content.trim(),
      fandom: fandomInput.trim() || null,
      attachedMedia,
      postType: "text",
    })
    resetComposer()
  }

  return (
    <Card className="mb-6 border-border/50 bg-card/60 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="size-10 ring-2 ring-border/50">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="Profile avatar" /> : null}
            <AvatarFallback>{avatarInitial}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <Input
              placeholder={isAuthenticated ? "What are you watching right now?" : "Sign in to start posting..."}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={!isAuthenticated}
              className="h-12 border-border/50 bg-muted/30"
            />

            {(attachedMedia || fandomInput) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {attachedMedia ? (
                  <Badge variant="secondary" className="gap-1 border-0 bg-primary/10 text-primary">
                    {attachedMedia.title}
                    <X className="size-3 cursor-pointer" onClick={() => setAttachedMedia(null)} />
                  </Badge>
                ) : null}
                {fandomInput ? (
                  <Badge variant="secondary" className="gap-1 border-0 bg-muted/60 text-foreground">
                    #{fandomInput.replace(/^#/, "")}
                    <X className="size-3 cursor-pointer" onClick={() => setFandomInput("")} />
                  </Badge>
                ) : null}
              </div>
            )}

            {showTagInput ? (
              <div className="mt-3">
                <Input
                  list="community-fandom-options"
                  placeholder="Add a tag or fandom..."
                  value={fandomInput}
                  onChange={(event) => setFandomInput(event.target.value)}
                  className="h-10 border-border/50 bg-muted/30"
                />
                <datalist id="community-fandom-options">
                  {availableFandoms.map((fandom) => (
                    <option key={fandom} value={fandom} />
                  ))}
                </datalist>
              </div>
            ) : null}

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dialog open={mediaOpen} onOpenChange={setMediaOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                      <img
                        src="https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg"
                        alt=""
                        className="h-4 w-4 rounded object-cover"
                      />
                      Add Anime
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Attach Anime</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                      <Input
                        placeholder="Search anime or manga..."
                        value={mediaQuery}
                        onChange={(event) => setMediaQuery(event.target.value)}
                        className="border-border/50 bg-muted/30"
                      />
                      {mediaLoading ? <p className="text-xs text-muted-foreground">Searching...</p> : null}
                      {mediaError ? <p className="text-xs text-red-400">{mediaError}</p> : null}
                      <div className="grid gap-1">
                        {mediaResults.length === 0 && !mediaLoading ? (
                          <p className="py-2 text-xs text-muted-foreground">
                            {mediaQuery.trim().length < 2 ? "Type at least 2 characters to search." : "No matches found."}
                          </p>
                        ) : (
                          mediaResults.map((item) => (
                            <Button
                              key={item.id}
                              type="button"
                              variant="ghost"
                              className="h-10 justify-start gap-2 text-sm"
                              onClick={() => handleSelectMedia(item)}
                            >
                              {item.coverImage ? (
                                <img src={item.coverImage} alt={item.title} className="h-6 w-6 rounded object-cover" />
                              ) : (
                                <div className="h-6 w-6 rounded bg-secondary" />
                              )}
                              <span className="flex-1 truncate text-left">{item.title}</span>
                              <span className="text-[10px] text-muted-foreground">{item.type}</span>
                            </Button>
                          ))
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => setShowTagInput((value) => !value)}
                >
                  <Hash className="size-4" />
                  Tag
                </Button>
              </div>

              <Button size="sm" className="gap-1.5" onClick={handlePost} disabled={!isAuthenticated || !content.trim()}>
                <Send className="size-3.5" />
                Post
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CommunityPostCard({
  post,
  media,
  canInteract,
  onToggleLike,
  onToggleSave,
  onVotePoll,
}) {
  const [isExpandedSpoiler, setIsExpandedSpoiler] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const postTags = getPostTags(post)
  const avatarInitial = post?.user_display_name?.slice(0, 1).toUpperCase() || "U"
  const userHandle = post?.user_handle || "@user"
  const profileHandle = String(userHandle).replace(/^@/, "")
  const profileHref = profileHandle ? `/u/${encodeURIComponent(profileHandle)}` : null
  const postHref = `/community/${post.id}`
  const pollTotal = Number(post?.poll_total || 0)
  const clipMeta = post?.clip_url ? parseVideoUrl(post.clip_url) : null

  const handleShare = async () => {
    if (typeof window === "undefined") return
    const url = `${window.location.origin}${postHref}`
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
            <Avatar className="size-10 ring-2 ring-border/50">
              {post?.user_avatar_url ? (
                <AvatarImage src={post.user_avatar_url} alt={post.user_display_name || "User"} />
              ) : null}
              <AvatarFallback>{avatarInitial}</AvatarFallback>
            </Avatar>

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
                  <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-500">
                    <AlertTriangle className="size-3" />
                    Spoiler
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{userHandle}</span>
                <span>•</span>
                <span>{formatRelativeTime(post?.created_at)}</span>
                {(media?.title || post?.attached_list_name || post?.fandom) ? <span>•</span> : null}
                {media?.title ? (
                  <span>{media.title}</span>
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
              <Badge key={`${post.id}-${tag}`} variant="secondary" className="border-0 bg-primary/10 text-primary">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        {post?.post_type === "poll" && Array.isArray(post?.poll_options) && post.poll_options.length ? (
          <div className="mb-4 space-y-2">
            {post.poll_options.map((option, index) => {
              const votes = Number(post?.poll_counts?.[index] || 0)
              const percent = pollTotal ? Math.round((votes / pollTotal) * 100) : 0
              const isSelected = Number(post?.poll_user_vote) === index
              return (
                <button
                  key={`${post.id}-poll-${index}`}
                  type="button"
                  onClick={() => canInteract && onVotePoll?.(index)}
                  disabled={!canInteract}
                  className={cn(
                    "w-full rounded-xl border border-border/40 bg-muted/20 p-3 text-left transition-colors",
                    canInteract ? "hover:border-primary/30 hover:bg-muted/35" : "cursor-default",
                    isSelected && "border-primary/40 bg-primary/10",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground">{option}</span>
                    <span className="text-xs text-muted-foreground">{percent}%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-border/30">
                    <div
                      className={cn("h-full rounded-full transition-all", isSelected ? "bg-primary" : "bg-white/35")}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </button>
              )
            })}
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">{pollTotal} votes</p>
          </div>
        ) : null}

        {media ? (
          <Link href={getMediaHref(media)} className="mb-4 block">
            <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-muted/30 p-3 transition-colors hover:border-primary/30">
              <div className="relative size-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted/50">
                {media.coverImage ? (
                  <img src={media.coverImage} alt={media.title} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-medium text-foreground">{media.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {media.type === "MANGA" ? "Manga" : "Anime"}
                  {media.subtitle ? ` • ${media.subtitle}` : ""}
                </p>
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
              <div className="relative size-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted/50">
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
              className={cn("gap-1.5", post?.is_liked ? "text-red-500" : "text-muted-foreground")}
              onClick={onToggleLike}
              disabled={!canInteract}
            >
              <Heart className={cn("size-4", post?.is_liked && "fill-current")} />
              <span>{formatCompact(post?.like_count)}</span>
            </Button>

            <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <Link href={postHref}>
                <MessageCircle className="size-4" />
                <span>{formatCompact(post?.comment_count)}</span>
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={cn("gap-1.5", post?.is_saved ? "text-primary" : "text-muted-foreground")}
              onClick={onToggleSave}
              disabled={!canInteract}
            >
              <Bookmark className={cn("size-4", post?.is_saved && "fill-current")} />
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

function CommunityListCard({ list }) {
  return (
    <Card className="group overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:bg-card/80">
      <div className="relative h-32 overflow-hidden">
        <div className="absolute inset-0 flex">
          {(list.covers || []).map((cover, index) => (
            <div key={`${list.id}-${index}`} className="relative flex-1 overflow-hidden bg-muted/40">
              {cover ? <img src={cover} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : null}
            </div>
          ))}
          {!(list.covers || []).length ? (
            <div className="flex w-full items-center justify-center bg-muted/40 text-sm text-muted-foreground">
              No cover preview yet
            </div>
          ) : null}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
      </div>

      <CardContent className="relative -mt-8 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Avatar className="size-8 ring-2 ring-card">
            {list.creator?.avatar ? <AvatarImage src={list.creator.avatar} alt={list.creator.name} /> : null}
            <AvatarFallback>{list.creator?.name?.slice(0, 1)?.toUpperCase() || "H"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{list.creator?.name || "Hikari User"}</p>
            <p className="text-xs text-muted-foreground">{formatCompact(list.itemCount)} titles</p>
          </div>
        </div>

        <h3 className="mb-1 font-semibold text-foreground">{list.title}</h3>
        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{list.description || "A curated anime list from the community."}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Bookmark className="size-3.5" />
              {formatCompact(list.itemCount)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {formatRelativeTime(list.updatedAt)}
            </span>
          </div>

          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/lists/${list.id}`}>
              Open
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CommunityExperience({ user }) {
  const composerRef = useRef(null)
  const [posts, setPosts] = useState([])
  const [following, setFollowing] = useState([])
  const [customLists, setCustomLists] = useState([])
  const [publicLists, setPublicLists] = useState([])
  const [activeFeed, setActiveFeed] = useState("for-you")
  const [sortBy, setSortBy] = useState("trending")
  const [searchQuery, setSearchQuery] = useState("")
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [loadLimit, setLoadLimit] = useState(20)
  const [mutedIds, setMutedIds] = useState([])
  const [attachedMediaById, setAttachedMediaById] = useState(new Map())

  useEffect(() => {
    let active = true

    const loadPosts = async () => {
      setLoadingPosts(true)
      setLoadError("")
      try {
        const data = await fetchSocialPosts(user?.id, loadLimit)
        if (!active) return
        setPosts(data)
      } catch (error) {
        if (!active) return
        setPosts([])
        setLoadError(error.message || "Could not load community posts.")
      } finally {
        if (active) setLoadingPosts(false)
      }
    }

    loadPosts()
    const unsubscribe = subscribeSocialPosts(loadPosts)

    return () => {
      active = false
      unsubscribe()
    }
  }, [user?.id, loadLimit])

  useEffect(() => {
    let active = true

    const loadFollowing = async () => {
      if (!user) {
        setFollowing([])
        return
      }
      try {
        const ids = await fetchFollowingIds(user.id)
        if (!active) return
        setFollowing(ids)
      } catch (error) {
        if (!active) return
        setFollowing([])
      }
    }

    loadFollowing()
    const unsubscribe = subscribeSocialFollowing(loadFollowing)

    return () => {
      active = false
      unsubscribe()
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) {
      setCustomLists([])
      return
    }

    let active = true

    const loadLists = async () => {
      const { data, error } = await client
        .from("custom_lists")
        .select("id, name, is_public")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (!active) return
      if (error) {
        setCustomLists([])
        return
      }

      setCustomLists(data || [])
    }

    loadLists()

    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setMutedIds([])
      return
    }

    const ids = Array.isArray(user?.user_metadata?.muted_user_ids)
      ? user.user_metadata.muted_user_ids
      : []
    setMutedIds(ids.map((value) => String(value)))
  }, [user])

  useEffect(() => {
    let active = true

    const loadAttachedMedia = async () => {
      const mediaIds = Array.from(
        new Set(posts.map((post) => Number(post?.attached_media_id)).filter(Number.isFinite)),
      )

      if (!mediaIds.length) {
        setAttachedMediaById(new Map())
        return
      }

      try {
        const mediaById = await fetchAniListMediaByIds(mediaIds)
        if (!active) return
        setAttachedMediaById(mediaById)
      } catch (error) {
        if (!active) return
        setAttachedMediaById(new Map())
      }
    }

    loadAttachedMedia()

    return () => {
      active = false
    }
  }, [posts])

  useEffect(() => {
    let active = true

    const loadPublicLists = async () => {
      const { data: listData, error: listError } = await client
        .from("custom_lists")
        .select("id, user_id, name, description, is_public, updated_at")
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(3)

      if (!active) return
      if (listError || !listData?.length) {
        setPublicLists([])
        return
      }

      const listIds = listData.map((list) => list.id)
      const creatorIds = Array.from(new Set(listData.map((list) => list.user_id).filter(Boolean)))

      const [{ data: listItems }, { data: creators }] = await Promise.all([
        client.from("custom_list_items").select("list_id, media_id").in("list_id", listIds),
        creatorIds.length
          ? client
              .from("public_profiles")
              .select("user_id, display_name, handle, avatar_url")
              .in("user_id", creatorIds)
          : Promise.resolve({ data: [] }),
      ])

      const itemsByList = new Map()
      ;(listItems || []).forEach((item) => {
        if (!itemsByList.has(item.list_id)) itemsByList.set(item.list_id, [])
        itemsByList.get(item.list_id).push(item.media_id)
      })

      const coverIds = Array.from(
        new Set((listItems || []).map((item) => Number(item.media_id)).filter(Number.isFinite)),
      )

      let mediaMap = new Map()
      if (coverIds.length) {
        try {
          mediaMap = await fetchAniListMediaByIds(coverIds)
        } catch (error) {
          mediaMap = new Map()
        }
      }

      const creatorsById = new Map()
      ;(creators || []).forEach((creator) => {
        creatorsById.set(String(creator.user_id), creator)
      })

      if (!active) return

      setPublicLists(
        listData.map((list) => {
          const mediaIds = itemsByList.get(list.id) || []
          const covers = mediaIds
            .map((mediaId) => mediaMap.get(Number(mediaId))?.coverImage?.large)
            .filter(Boolean)
            .slice(0, 3)

          const creator = creatorsById.get(String(list.user_id))

          return {
            id: list.id,
            title: list.name,
            description: list.description,
            itemCount: mediaIds.length,
            covers,
            updatedAt: list.updated_at,
            creator: {
              name: creator?.display_name || creator?.handle || "Hikari User",
              avatar: creator?.avatar_url || "",
            },
          }
        }),
      )
    }

    loadPublicLists()

    return () => {
      active = false
    }
  }, [])

  const availableFandoms = useMemo(() => {
    const counts = posts.reduce((acc, post) => {
      if (!post?.fandom || mutedIds.includes(String(post.user_id))) return acc
      acc[post.fandom] = (acc[post.fandom] || 0) + 1
      return acc
    }, {})

    return Object.keys(counts).sort((left, right) => counts[right] - counts[left])
  }, [posts, mutedIds])

  const handleCreatePost = async (payload) => {
    if (!user) return
    const profile = buildUserProfile(user)
    const postType =
      payload.postType ||
      (payload.pollOptions?.length ? "poll" : payload.clipUrl ? "clip" : payload.attachedList ? "list" : "text")

    try {
      await upsertPublicProfile(user, {
        handle: String(profile.handle || "").replace(/^@/, ""),
      })

      const created = await createSocialPost({
        user_id: user.id,
        content: payload.content,
        fandom: payload.fandom,
        attached_media_id: payload.attachedMedia?.id || null,
        attached_media_title: payload.attachedMedia?.title || null,
        attached_media_type: payload.attachedMedia?.type || null,
        attached_list_id: payload.attachedList?.id || null,
        attached_list_name: payload.attachedList?.name || null,
        clip_url: payload.clipUrl || null,
        post_to_discover: Boolean(payload.postToDiscover),
        has_spoilers: Boolean(payload.hasSpoilers),
        spoiler_range: payload.spoilerRange || null,
        poll_options: payload.pollOptions || [],
        post_type: postType,
        user_display_name: profile.displayName,
        user_handle: profile.handle,
        user_avatar_url: profile.avatarUrl,
      })

      setPosts((prev) => [
        {
          ...created,
          like_count: 0,
          repost_count: 0,
          save_count: 0,
          comment_count: 0,
          is_liked: false,
          is_reposted: false,
          is_saved: false,
          poll_options: payload.pollOptions || [],
          poll_counts: Array.isArray(payload.pollOptions) ? payload.pollOptions.map(() => 0) : [],
          poll_total: 0,
          poll_user_vote: null,
        },
        ...prev,
      ])

      emitSocialPosts()

      addNotification(user.id, {
        title: "Post published",
        message: "Your post is live in the community feed.",
        type: "post",
        metadata: { postId: created.id, href: `/community/${created.id}` },
      })

      await awardXp(user, XP_ACTIONS.social_post, "social_post")

      if (payload.postToDiscover && payload.clipUrl) {
        const parsed = parseVideoUrl(payload.clipUrl)
        if (!parsed) {
          addNotification(user.id, {
            title: "Clip link not recognized",
            message: "Use a YouTube clip URL to submit to Discover.",
            type: "discover",
          })
        } else if (!payload.attachedMedia?.id) {
          addNotification(user.id, {
            title: "Pick an anime first",
            message: "Attach an anime so the clip can post to Discover.",
            type: "discover",
          })
        } else {
          const spoilerEpisode = payload.spoilerRange
            ? Number.parseInt(String(payload.spoilerRange).replace(/[^0-9]/g, ""), 10)
            : null

          const { error } = await client.from("fandom_clips").insert({
            user_id: user.id,
            media_id: payload.attachedMedia.id,
            media_title: payload.attachedMedia.title,
            clip_title: payload.content?.slice(0, 120) || null,
            video_url: payload.clipUrl,
            video_site: parsed.site,
            video_id: parsed.id,
            user_display_name: profile.displayName,
            user_handle: profile.handle,
            user_avatar_url: profile.avatarUrl,
            thumbnail_url: parsed.thumbnail,
            tags: [],
            spoiler_level: payload.hasSpoilers ? "Mild" : "None",
            spoiler_episode: Number.isFinite(spoilerEpisode) ? spoilerEpisode : null,
            status: "pending",
          })

          if (error) {
            addNotification(user.id, {
              title: "Discover submission failed",
              message: error.message || "Could not submit the clip.",
              type: "discover",
            })
          } else {
            addNotification(user.id, {
              title: "Discover submission created",
              message: "Your clip link is ready to be reviewed for Discover.",
              type: "discover",
            })
            await awardXp(user, XP_ACTIONS.fandom_clip, "fandom_clip")
          }
        }
      }
    } catch (error) {
      addNotification(user.id, {
        title: "Post failed",
        message: error.message || "Could not publish the post.",
        type: "post",
      })
    }
  }

  const handleToggleLike = async (postId) => {
    if (!user) return
    const current = posts.find((post) => post.id === postId)
    if (!current) return
    const nextActive = !current.is_liked

    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              is_liked: nextActive,
              like_count: Math.max(0, Number(post.like_count || 0) + (nextActive ? 1 : -1)),
            }
          : post,
      ),
    )

    try {
      await toggleReaction({
        postId,
        userId: user.id,
        type: "like",
        isActive: current.is_liked,
      })
    } catch (error) {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, is_liked: current.is_liked, like_count: current.like_count || 0 }
            : post,
        ),
      )
    }
  }

  const handleToggleSave = async (postId) => {
    if (!user) return
    const current = posts.find((post) => post.id === postId)
    if (!current) return
    const nextActive = !current.is_saved

    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              is_saved: nextActive,
              save_count: Math.max(0, Number(post.save_count || 0) + (nextActive ? 1 : -1)),
            }
          : post,
      ),
    )

    try {
      await toggleReaction({
        postId,
        userId: user.id,
        type: "save",
        isActive: current.is_saved,
      })
    } catch (error) {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, is_saved: current.is_saved, save_count: current.save_count || 0 }
            : post,
        ),
      )
    }
  }

  const handleVotePoll = async (postId, optionIndex) => {
    if (!user) return
    const current = posts.find((post) => post.id === postId)
    if (!current || !Array.isArray(current.poll_counts)) return

    const previousCounts = current.poll_counts
    const previousVote = current.poll_user_vote
    const nextCounts = [...previousCounts]

    if (Number.isInteger(previousVote)) {
      nextCounts[previousVote] = Math.max(0, Number(nextCounts[previousVote] || 0) - 1)
    }
    nextCounts[optionIndex] = Number(nextCounts[optionIndex] || 0) + 1
    const nextTotal = nextCounts.reduce((sum, value) => sum + Number(value || 0), 0)

    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, poll_counts: nextCounts, poll_total: nextTotal, poll_user_vote: optionIndex }
          : post,
      ),
    )

    try {
      await voteOnPoll({ postId, userId: user.id, optionIndex })
    } catch (error) {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                poll_counts: previousCounts,
                poll_total: previousCounts.reduce((sum, value) => sum + Number(value || 0), 0),
                poll_user_vote: previousVote,
              }
            : post,
        ),
      )
    }
  }

  const suggestedUsers = useMemo(() => {
    const map = new Map()
    posts.forEach((post) => {
      if (mutedIds.includes(String(post.user_id))) return
      if (!post.user_id || post.user_id === user?.id || map.has(post.user_id)) return
      map.set(post.user_id, {
        id: post.user_id,
        name: post.user_display_name || "User",
        handle: post.user_handle || "@user",
        avatar: post.user_avatar_url || "",
        letter: post.user_display_name?.slice(0, 1).toUpperCase() || "U",
      })
    })
    return Array.from(map.values())
  }, [posts, user?.id, mutedIds])

  const activeCreators = useMemo(() => {
    const seen = new Set()
    const preferred = posts.filter((post) => following.includes(post.user_id))
    return [...preferred, ...posts]
      .filter((post) => !mutedIds.includes(String(post.user_id)))
      .filter((post) => {
        if (!post.user_id || seen.has(post.user_id)) return false
        seen.add(post.user_id)
        return true
      })
      .slice(0, 4)
      .map((post) => ({
        id: post.user_id,
        name: post.user_display_name || "User",
        avatar: post.user_avatar_url || "",
        letter: post.user_display_name?.slice(0, 1).toUpperCase() || "U",
        status: post.attached_media_title || post.fandom || "Posting in the community",
      }))
  }, [following, mutedIds, posts])

  const trendingTags = useMemo(() => {
    const counts = posts.reduce((acc, post) => {
      if (!post?.fandom || mutedIds.includes(String(post.user_id))) return acc
      acc[post.fandom] = (acc[post.fandom] || 0) + 1
      return acc
    }, {})

    return Object.entries(counts)
      .map(([tag, count]) => ({ tag, posts: count }))
      .sort((left, right) => right.posts - left.posts)
      .slice(0, 5)
  }, [posts, mutedIds])

  const visiblePosts = useMemo(() => {
    let nextPosts = posts.filter((post) => !mutedIds.includes(String(post.user_id)))
    if (activeFeed === "following") {
      nextPosts = nextPosts.filter((post) => following.includes(post.user_id))
    }
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      nextPosts = nextPosts.filter((post) =>
        [
          post.content,
          post.user_display_name,
          post.user_handle,
          post.fandom,
          post.attached_media_title,
          post.attached_list_name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
      )
    }
    if (sortBy === "newest") {
      return [...nextPosts].sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      )
    }
    if (sortBy === "most-liked") {
      return [...nextPosts].sort((left, right) => Number(right.like_count || 0) - Number(left.like_count || 0))
    }
    return [...nextPosts].sort((left, right) => getSortScore(right) - getSortScore(left))
  }, [activeFeed, following, mutedIds, posts, searchQuery, sortBy])

  const quickStats = useMemo(
    () => ({
      threads: posts.length,
      following: following.length,
      pollVotes: posts.reduce((sum, post) => sum + Number(post.poll_total || 0), 0),
      pollPosts: posts.filter((post) => Array.isArray(post?.poll_options) && post.poll_options.length > 0).length,
    }),
    [following.length, posts],
  )

  const handleToggleFollow = async (targetUserId, handle) => {
    if (!user) return
    const isFollowing = following.includes(targetUserId)
    const next = isFollowing ? following.filter((id) => id !== targetUserId) : [...following, targetUserId]
    setFollowing(next)
    emitSocialFollowing()

    try {
      await toggleFollow({ followerId: user.id, followingId: targetUserId, isFollowing })
      addNotification(user.id, {
        title: isFollowing ? "Unfollowed" : "Following",
        message: `${isFollowing ? "You unfollowed" : "You followed"} ${handle}.`,
        type: "follow",
      })
    } catch (error) {
      setFollowing(isFollowing ? [...following, targetUserId] : following.filter((id) => id !== targetUserId))
    }
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -left-[20%] -top-[40%] h-[80%] w-[80%] animate-pulse rounded-full bg-gradient-to-br from-primary/15 via-accent/8 to-transparent blur-3xl"
          style={{ animationDuration: "10s" }}
        />
        <div
          className="absolute -bottom-[30%] -right-[20%] h-[70%] w-[70%] animate-pulse rounded-full bg-gradient-to-tl from-accent/12 via-primary/5 to-transparent blur-3xl"
          style={{ animationDuration: "12s", animationDelay: "3s" }}
        />
      </div>

      <Navigation />

      <main className="relative z-10 pt-24">
        <section className="border-b border-border/30">
          <div className="container mx-auto px-4 py-12">
            <div className="max-w-4xl">
              <h1 className="mb-4 text-4xl font-bold md:text-5xl">
                <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                  Community
                </span>
              </h1>
              <p className="mb-8 max-w-2xl text-lg text-muted-foreground">
                See what others are watching, share lists, and join the conversation with fellow anime enthusiasts.
              </p>

              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="gap-2 bg-primary shadow-lg shadow-primary/25 hover:bg-primary/90"
                  onClick={() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  <Plus className="size-4" />
                  Create Post
                </Button>
                <Button size="lg" variant="outline" className="gap-2" asChild>
                  <Link href="/lists">
                    <Share2 className="size-4" />
                    Share a List
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border/30 bg-muted/20">
          <div className="container mx-auto px-4 py-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {quickActivityCards.map((card) => {
                const Icon = card.icon
                const isPollCard = card.key === "polls"
                const cardValue = isPollCard
                  ? quickStats.pollVotes > 0
                    ? quickStats.pollVotes
                    : quickStats.pollPosts
                  : quickStats[card.key]
                const cardLabel = isPollCard
                  ? quickStats.pollVotes > 0
                    ? "votes cast"
                    : quickStats.pollPosts === 1
                      ? "active poll"
                      : "active polls"
                  : card.label
                return (
                  <Card
                    key={card.id}
                    className={`cursor-pointer border-border/50 bg-gradient-to-br ${card.color} backdrop-blur-sm transition-transform hover:scale-[1.02]`}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="rounded-xl bg-card/80 p-3 backdrop-blur-sm">
                        <Icon className="size-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{card.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-bold text-primary">{formatCompact(cardValue)}</span>{" "}
                          {cardLabel}
                        </p>
                      </div>
                      <ChevronRight className="ml-auto size-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-8">
          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="min-w-0 flex-1 space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Tabs value={activeFeed} onValueChange={setActiveFeed} className="w-full sm:w-auto">
                  <TabsList className="bg-muted/50">
                    {feedTabs.map((tab) => (
                      <TabsTrigger key={tab.id} value={tab.id}>
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1 sm:w-72">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search posts or users..."
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="border-border/50 bg-muted/30 pl-9"
                    />
                  </div>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[140px] border-border/50 bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trending">
                        <span className="flex items-center gap-2">
                          <Flame className="size-4" />
                          Trending
                        </span>
                      </SelectItem>
                      <SelectItem value="newest">
                        <span className="flex items-center gap-2">
                          <Clock className="size-4" />
                          Newest
                        </span>
                      </SelectItem>
                      <SelectItem value="most-liked">
                        <span className="flex items-center gap-2">
                          <ThumbsUp className="size-4" />
                          Most Liked
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div ref={composerRef}>
                <CommunityComposer
                  onCreate={handleCreatePost}
                  availableFandoms={availableFandoms}
                  isAuthenticated={Boolean(user)}
                  avatarUrl={user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || ""}
                  avatarInitial={
                    user?.user_metadata?.display_name?.slice(0, 1).toUpperCase() ||
                    user?.email?.slice(0, 1).toUpperCase() ||
                    "U"
                  }
                />
              </div>

              <div className="space-y-4">
                {loadingPosts ? (
                  <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-10 text-center text-muted-foreground">Loading community posts...</CardContent>
                  </Card>
                ) : loadError ? (
                  <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-10 text-center text-muted-foreground">{loadError}</CardContent>
                  </Card>
                ) : visiblePosts.length === 0 ? (
                  <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-10 text-center text-muted-foreground">
                      {user ? "No posts match this feed yet." : "Sign in to start posting in the community."}
                    </CardContent>
                  </Card>
                ) : (
                  visiblePosts.map((post) => {
                    const media = post?.attached_media_id ? attachedMediaById.get(Number(post.attached_media_id)) : null
                    return (
                      <CommunityPostCard
                        key={post.id}
                        post={post}
                        media={
                          media
                            ? {
                                ...media,
                                title: getMediaTitle(media),
                                coverImage: media?.coverImage?.large || media?.coverImage?.extraLarge || "",
                                subtitle: media?.status ? media.status.replace(/_/g, " ").toLowerCase() : "",
                              }
                            : null
                        }
                        canInteract={Boolean(user)}
                        onToggleLike={() => handleToggleLike(post.id)}
                        onToggleSave={() => handleToggleSave(post.id)}
                        onVotePoll={(optionIndex) => handleVotePoll(post.id, optionIndex)}
                      />
                    )
                  })
                )}
              </div>

              {!loadingPosts && visiblePosts.length >= loadLimit ? (
                <div className="flex justify-center">
                  <Button variant="outline" size="lg" className="gap-2" onClick={() => setLoadLimit((value) => value + 20)}>
                    <Eye className="size-4" />
                    Load More Posts
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="w-full space-y-6 lg:w-80">
              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-4 text-primary" />
                    Friends Online
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeCreators.length ? (
                    activeCreators.map((creator) => (
                      <div key={creator.id} className="group flex cursor-pointer items-center gap-3">
                        <div className="relative">
                          <Avatar className="size-9">
                            {creator.avatar ? <AvatarImage src={creator.avatar} alt={creator.name} /> : null}
                            <AvatarFallback>{creator.letter}</AvatarFallback>
                          </Avatar>
                          <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 ring-2 ring-card" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                            {creator.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">Watching {creator.status}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No recent activity yet.</p>
                  )}
                  <Button variant="ghost" size="sm" className="mt-2 w-full text-muted-foreground">
                    View All Friends
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Star className="size-4 text-primary" />
                    Suggested Users
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {suggestedUsers.slice(0, 4).length ? (
                    suggestedUsers.slice(0, 4).map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3">
                        <Avatar className="size-9">
                          {entry.avatar ? <AvatarImage src={entry.avatar} alt={entry.name} /> : null}
                          <AvatarFallback>{entry.letter}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{entry.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {following.includes(entry.id) ? "Already in your circle" : "Community member"}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={!user}
                          onClick={() => handleToggleFollow(entry.id, entry.handle)}
                        >
                          {following.includes(entry.id) ? "Following" : "Follow"}
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Suggestions will show up once people start posting.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="size-4 text-primary" />
                    Trending Tags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {trendingTags.length ? (
                      trendingTags.map((item) => (
                        <Badge
                          key={item.tag}
                          variant="secondary"
                          className="cursor-pointer bg-muted/50 transition-colors hover:bg-primary/20"
                        >
                          #{item.tag.replace(/\s+/g, "")}
                          <span className="ml-1 text-muted-foreground">({formatCompact(item.posts)})</span>
                        </Badge>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No fandom tags are trending yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Shield className="size-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-1 text-sm font-semibold text-foreground">Community Guidelines</h3>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Be respectful, mark spoilers, and keep discussions on topic.
                      </p>
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs text-primary" asChild>
                        <Link href="/settings">Read full guidelines</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-t border-border/30 bg-muted/10">
          <div className="container mx-auto px-4 py-12">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="mb-2 text-2xl font-bold text-foreground">Popular Community Lists</h2>
                <p className="text-muted-foreground">Curated collections by the community</p>
              </div>
              <Button variant="outline" className="gap-2" asChild>
                <Link href="/lists">
                  View All Lists
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {publicLists.length ? (
                publicLists.map((list) => <CommunityListCard key={list.id} list={list} />)
              ) : (
                <Card className="col-span-full border-border/50 bg-card/60 backdrop-blur-sm">
                  <CardContent className="p-10 text-center text-muted-foreground">
                    No public lists are ready to feature yet.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </section>

        <section className="border-t border-border/30">
          <div className="container mx-auto px-4 py-12">
            <Card className="overflow-hidden border-border/50 bg-gradient-to-r from-[#5865F2]/10 to-primary/5 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center gap-6 p-8 md:flex-row">
                <div className="rounded-2xl bg-[#5865F2]/20 p-4">
                  <svg className="size-12 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="mb-2 text-xl font-bold text-foreground">Join our Discord Community</h3>
                  <p className="mb-4 text-muted-foreground">
                    Connect with thousands of anime fans, participate in watch parties, and get exclusive updates.
                  </p>
                  <Button className="gap-2 bg-[#5865F2] hover:bg-[#4752C4]" asChild>
                    <Link href={DISCORD_COMMUNITY_URL} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      Join Discord Server
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
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
            <p className="mt-3 text-sm leading-7 text-white/58">
              Join the Discord in the meantime.
            </p>
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
                  {discordStats.description || "Join the Hikari Discord for updates, conversation, and early access when community opens."}
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
  const isMod = user?.user_metadata?.is_mod === true || user?.user_metadata?.isMod === true

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!isMod) {
    return <CommunityComingSoonPage />
  }

  return <CommunityExperience user={user} />
}
