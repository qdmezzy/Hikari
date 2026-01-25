"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share2,
  MoreHorizontal,
  AlertTriangle,
  Film,
  List,
  Users,
  Eye,
  EyeOff,
  Flag,
  VolumeX,
  Check,
  UserX,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface LinkEmbed {
  url: string
  title: string
  description?: string
  thumbnails?: string[]
  siteName?: string
  type: "anime" | "profile" | "list" | "video"
  metadata?: string
  isPublic?: boolean
}

interface Post {
  id: number | string
  user: { name: string; handle: string; avatar: string; badges?: string[] }
  userAvatarUrl?: string
  content: string
  attachedMedia?: string
  attachedMediaId?: number
  attachedList?: string
  attachedListId?: string
  fandom?: string
  hasSpoilers?: boolean
  spoilerRange?: string
  timestamp: string
  likes: number
  comments: number
  reposts: number
  isLiked: boolean
  isReposted: boolean
  isSaved: boolean
  postType?: string
  pollOptions?: string[]
  pollCounts?: number[]
  pollTotal?: number
  pollUserVote?: number | null
  linkEmbed?: LinkEmbed
  postUrl?: string
}

type SocialPostProps = {
  post: Post
  onToggleLike?: () => void
  onToggleRepost?: () => void
  onToggleSave?: () => void
  onShare?: () => void
  onVotePoll?: (optionIndex: number) => void
  onReport?: () => void
  onReportUser?: () => void
  onMuteUser?: () => void
}

export function SocialPost({
  post,
  onToggleLike,
  onToggleRepost,
  onToggleSave,
  onShare,
  onVotePoll,
  onReport,
  onReportUser,
  onMuteUser,
}: SocialPostProps) {
  const [showSpoiler, setShowSpoiler] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const formatNumber = (num?: number) => {
    const value = Number.isFinite(num) ? num : 0
    return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()
  }
  const spoilerLabel = post.spoilerRange
    ? `Contains spoilers up to ${post.spoilerRange}`
    : "Contains spoilers"
  const spoilerToggle = post.spoilerRange ? `Spoilers - ${post.spoilerRange}` : "Spoilers"
  const shareUrl = post.postUrl
  const pollTotal = Number.isFinite(post.pollTotal) ? post.pollTotal : 0
  const fandomSlug = post.fandom ? encodeURIComponent(post.fandom.trim().replace(/\s+/g, "-")) : ""

  const handleShare = async () => {
    if (onShare) {
      onShare()
      return
    }
    if (!shareUrl || typeof window === "undefined") return
    const resolvedUrl = shareUrl.startsWith("http") ? shareUrl : `${window.location.origin}${shareUrl}`
    try {
      await navigator.clipboard.writeText(resolvedUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 1500)
    } catch (error) {
      window.prompt("Copy this link:", resolvedUrl)
    }
  }

  return (
    <Card className="border border-white/10 bg-gradient-to-br from-zinc-950/80 via-zinc-950/70 to-black/60 hover:bg-black/70 transition-smooth hover-lift group shadow-lg shadow-black/30">
      <CardContent className="p-5">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-transparent group-hover:ring-pink-500/25 transition-all">
            {post.userAvatarUrl ? (
              <AvatarImage src={post.userAvatarUrl} alt={post.user.name} />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-500 text-white text-sm">
              {post.user.avatar}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 text-sm">
                <span className="font-semibold">{post.user.name}</span>
                <span className="text-muted-foreground">{post.user.handle}</span>
                <span className="text-muted-foreground">-</span>
                <span className="text-muted-foreground">{post.timestamp}</span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="gap-2" onClick={onReport} disabled={!onReport}>
                    <Flag className="h-4 w-4" />
                    Report
                  </DropdownMenuItem>
                  {onReportUser && (
                    <DropdownMenuItem className="gap-2" onClick={onReportUser}>
                      <UserX className="h-4 w-4" />
                      Report Profile
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="gap-2" onClick={onMuteUser} disabled={!onMuteUser}>
                    <VolumeX className="h-4 w-4" />
                    Mute User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {post.postType && post.postType !== "text" && (
              <Badge variant="outline" className="mt-1 text-[10px] bg-transparent capitalize px-1.5 py-0">
                {post.postType.replace("-", " ")}
              </Badge>
            )}

            {post.hasSpoilers && !showSpoiler ? (
              <div className="mt-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-red-400 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Spoiler Warning</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{spoilerLabel}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSpoiler(true)}
                  className="gap-1.5 h-7 text-xs bg-transparent hover:scale-105 transition-transform"
                >
                  <Eye className="h-3 w-3" />
                  Show
                </Button>
              </div>
            ) : (
              <div className="mt-2 animate-in fade-in duration-200">
                {post.hasSpoilers && showSpoiler && (
                  <button
                    onClick={() => setShowSpoiler(false)}
                    className="flex items-center gap-1.5 text-red-400 mb-1.5 text-xs hover:text-red-300 transition-colors"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {spoilerToggle}
                    <EyeOff className="h-3 w-3 ml-1" />
                  </button>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
              </div>
            )}

            {post.postType === "poll" && Array.isArray(post.pollOptions) && post.pollOptions.length > 0 && (
              <div className="mt-3 space-y-2">
                {post.pollOptions.map((option, index) => {
                  const count = post.pollCounts?.[index] || 0
                  const percent = pollTotal ? Math.round((count / pollTotal) * 100) : 0
                  const isSelected = post.pollUserVote === index
                  return (
                    <button
                      key={`${post.id}-poll-${index}`}
                      onClick={() => onVotePoll && onVotePoll(index)}
                      className={cn(
                        "w-full rounded-lg border border-border/60 px-3 py-2 text-left text-sm transition-smooth",
                        "hover:border-primary/40 hover:bg-secondary/40",
                        isSelected && "border-primary/60 bg-primary/10",
                      )}
                      disabled={!onVotePoll}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{option}</span>
                        {pollTotal > 0 && <span className="text-xs text-muted-foreground">{percent}%</span>}
                      </div>
                      {pollTotal > 0 && (
                        <div className="mt-2 h-1.5 rounded-full bg-secondary">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isSelected ? "bg-primary" : "bg-muted-foreground/50",
                            )}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                    </button>
                  )
                })}
                {pollTotal > 0 && (
                  <p className="text-[11px] text-muted-foreground">{pollTotal} votes</p>
                )}
              </div>
            )}

            {post.linkEmbed && (
              <>
                {post.linkEmbed.type === "anime" && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-secondary/60 hover:bg-secondary/80 rounded-lg px-3 py-2 cursor-pointer transition-colors">
                    <Film className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{post.linkEmbed.title}</span>
                  </div>
                )}

                {post.linkEmbed.type === "list" && (
                  <div className="mt-3 rounded-xl border border-border/50 bg-card/80 overflow-hidden cursor-pointer hover:bg-card/90">
                    {post.linkEmbed.thumbnails && post.linkEmbed.thumbnails.length > 0 && (
                      <div className="relative">
                        <div className="flex h-20 overflow-hidden">
                          {post.linkEmbed.thumbnails.slice(0, 6).map((_, i) => (
                            <div
                              key={i}
                              className="flex-1 bg-gradient-to-br from-secondary/80 to-secondary/40 border-r border-border/20 last:border-r-0 flex items-center justify-center"
                            >
                              <Film className="h-5 w-5 text-muted-foreground/20" />
                            </div>
                          ))}
                        </div>
                        {post.linkEmbed.isPublic && (
                          <div className="absolute right-2 top-2">
                            <Badge
                              variant="secondary"
                              className="text-[10px] gap-1 bg-black/60 backdrop-blur-sm border-0"
                            >
                              <Users className="h-2.5 w-2.5" />
                              Public
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm">{post.linkEmbed.title}</h4>
                          {post.linkEmbed.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {post.linkEmbed.description}
                            </p>
                          )}
                          {post.linkEmbed.metadata && (
                            <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                              {post.linkEmbed.metadata}
                            </p>
                          )}
                        </div>
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" />
                      </div>
                      <Button className="w-full mt-3 h-9 bg-secondary hover:bg-secondary/80 text-foreground font-medium">
                        View List
                      </Button>
                    </div>
                  </div>
                )}

                {post.linkEmbed.type === "profile" && (
                  <div className="mt-3 inline-flex items-center gap-3 bg-secondary/60 hover:bg-secondary/80 rounded-lg px-3 py-2 cursor-pointer transition-colors">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white text-xs font-medium">
                      {post.linkEmbed.title.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{post.linkEmbed.title}</p>
                      {post.linkEmbed.metadata && (
                        <p className="text-xs text-muted-foreground">{post.linkEmbed.metadata}</p>
                      )}
                    </div>
                  </div>
                )}

                {post.linkEmbed.type === "video" && (
                  <a
                    href={post.linkEmbed.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block overflow-hidden rounded-lg border border-border/50 bg-secondary/50 hover:bg-secondary/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 p-3">
                      {post.linkEmbed.thumbnails?.[0] ? (
                        <img
                          src={post.linkEmbed.thumbnails[0]}
                          alt={post.linkEmbed.title}
                          className="h-12 w-20 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-12 w-20 rounded-md bg-secondary/80 flex items-center justify-center">
                          <Film className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{post.linkEmbed.title}</p>
                        {post.linkEmbed.siteName && (
                          <p className="text-xs text-muted-foreground uppercase">{post.linkEmbed.siteName}</p>
                        )}
                      </div>
                    </div>
                  </a>
                )}
              </>
            )}

            {(post.attachedMedia || post.attachedList || post.fandom) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {post.attachedMedia && (
                  <>
                    {post.attachedMediaId ? (
                      <Link href={`/media/${post.attachedMediaId}`} className="inline-flex">
                        <Badge
                          variant="secondary"
                          className="gap-1 text-[10px] cursor-pointer hover:bg-secondary/80 transition-colors"
                        >
                          <Film className="h-2.5 w-2.5" />
                          {post.attachedMedia}
                        </Badge>
                      </Link>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="gap-1 text-[10px] cursor-pointer hover:bg-secondary/80 transition-colors"
                      >
                        <Film className="h-2.5 w-2.5" />
                        {post.attachedMedia}
                      </Badge>
                    )}
                  </>
                )}
                {post.attachedList && (
                  <>
                    {post.attachedListId ? (
                      <Link href={`/lists/${post.attachedListId}`} className="inline-flex">
                        <Badge
                          variant="secondary"
                          className="gap-1 text-[10px] cursor-pointer hover:bg-secondary/80 transition-colors"
                        >
                          <List className="h-2.5 w-2.5" />
                          {post.attachedList}
                        </Badge>
                      </Link>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="gap-1 text-[10px] cursor-pointer hover:bg-secondary/80 transition-colors"
                      >
                        <List className="h-2.5 w-2.5" />
                        {post.attachedList}
                      </Badge>
                    )}
                  </>
                )}
                {post.fandom && (
                  <>
                    {fandomSlug ? (
                      <Link href={`/hub/${fandomSlug}`} className="inline-flex">
                        <Badge
                          variant="secondary"
                          className="gap-1 text-[10px] cursor-pointer hover:bg-secondary/80 transition-colors"
                        >
                          <Users className="h-2.5 w-2.5" />
                          {post.fandom}
                        </Badge>
                      </Link>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="gap-1 text-[10px] cursor-pointer hover:bg-secondary/80 transition-colors"
                      >
                        <Users className="h-2.5 w-2.5" />
                        {post.fandom}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="mt-4 flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 px-2 py-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleLike}
                className={cn(
                  "gap-1 h-7 px-2 hover:bg-pink-500/10 transition-smooth",
                  post.isLiked && "text-pink-500",
                )}
              >
                <Heart
                  className={cn(
                    "h-3.5 w-3.5 transition-smooth",
                    post.isLiked && "fill-current scale-110",
                  )}
                />
                <span className="text-xs">{formatNumber(post.likes)}</span>
              </Button>

              {shareUrl ? (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="gap-1 h-7 px-2 hover:bg-blue-500/10 transition-smooth"
                >
                  <Link href={shareUrl}>
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="text-xs">{formatNumber(post.comments)}</span>
                  </Link>
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 h-7 px-2 hover:bg-blue-500/10 transition-smooth"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="text-xs">{formatNumber(post.comments)}</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleRepost}
                className={cn(
                  "gap-1 h-7 px-2 hover:bg-green-500/10 transition-smooth",
                  post.isReposted && "text-green-500",
                )}
              >
                <Repeat2
                  className={cn(
                    "h-3.5 w-3.5 transition-smooth",
                    post.isReposted && "scale-110",
                  )}
                />
                <span className="text-xs">{formatNumber(post.reposts)}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleSave}
                className={cn(
                  "gap-1 h-7 px-2 hover:bg-yellow-500/10 transition-smooth",
                  post.isSaved && "text-yellow-500",
                )}
              >
                <Bookmark
                  className={cn(
                    "h-3.5 w-3.5 transition-smooth",
                    post.isSaved && "fill-current scale-110",
                  )}
                />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="gap-1 h-7 px-2 ml-auto hover:bg-secondary transition-smooth"
                onClick={handleShare}
              >
                {shareCopied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

