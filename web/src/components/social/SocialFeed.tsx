"use client"

import { useEffect, useMemo, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { PostComposer } from "./PostComposer"
import { SocialPost } from "./SocialPost"
import { Sparkles, Users, Clock, TrendingUp, Film } from "lucide-react"
import { cn } from "@/lib/utils"
import useAuth from "@/hooks/useAuth"
import { addNotification } from "@/lib/notifications-store"
import client from "@/lib/client"
import {
  buildUserProfile,
  createSocialPost,
  fetchFollowingIds,
  fetchSocialPosts,
  reportSocialPost,
  toggleReaction,
  voteOnPoll,
} from "@/lib/social-service"
import { emitSocialPosts, subscribeSocialFollowing, subscribeSocialPosts } from "@/lib/social-events"
import { parseVideoUrl } from "@/lib/video-utils"
import { awardXp, XP_ACTIONS } from "@/lib/xp"
import { reportContent } from "@/lib/reporting"
import { upsertPublicProfile } from "@/lib/public-profile"

const feedTabs = [
  { id: "for-you", label: "For You", icon: Sparkles },
  { id: "following", label: "Following", icon: Users },
  { id: "fandoms", label: "Fandoms", icon: Film },
  { id: "new", label: "New", icon: Clock },
  { id: "top", label: "Top", icon: TrendingUp },
]

const quickFilters = [
  "All",
  "Text",
  "Clips",
  "Art",
  "Hot Takes",
  "Questions",
  "Reviews",
  "Memes",
  "Lists",
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
  return `${days}d ago`
}

export function SocialFeed() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("for-you")
  const [activeFilter, setActiveFilter] = useState("All")
  const [posts, setPosts] = useState([])
  const [following, setFollowing] = useState([])
  const [customLists, setCustomLists] = useState([])
  const [mutedIds, setMutedIds] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [loadError, setLoadError] = useState("")
  const displayName = user?.user_metadata?.display_name || user?.email || "User"
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || ""
  const avatarInitial = displayName?.slice(0, 1).toUpperCase() || "U"

  useEffect(() => {
    let active = true

    const loadPosts = async () => {
      setLoadingPosts(true)
      setLoadError("")
      try {
        const data = await fetchSocialPosts(user?.id)
        if (active) {
          setPosts(data)
        }
      } catch (error) {
        if (active) {
          setPosts([])
          setLoadError(error.message || "Could not load social posts.")
        }
      } finally {
        if (active) {
          setLoadingPosts(false)
        }
      }
    }

    loadPosts()
    const unsubscribe = subscribeSocialPosts(loadPosts)
    return () => {
      active = false
      unsubscribe()
    }
  }, [user?.id])

  useEffect(() => {
    let active = true

    const loadFollowing = async () => {
      if (!user) {
        setFollowing([])
        return
      }
      try {
        const ids = await fetchFollowingIds(user.id)
        if (active) {
          setFollowing(ids)
        }
      } catch (error) {
        if (active) {
          setFollowing([])
        }
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

  const handleCreatePost = async (payload) => {
    if (!user) return
    const profile = buildUserProfile(user)
    const postType =
      payload.postType ||
      (payload.pollOptions?.length ? "poll" : payload.clipUrl ? "clip" : payload.attachedList ? "list" : "text")

    try {
      await upsertPublicProfile(user, {
        handle: (profile.handle || "").replace(/^@/, ""),
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

      const nextPost = {
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
      }

      setPosts((prev) => [nextPost, ...prev])
      emitSocialPosts()

      addNotification(user.id, {
        title: "Post published",
        message: "Your post is live in the social feed.",
        type: "post",
      })

      awardXp(user, XP_ACTIONS.social_post, "social_post")

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
            ? Number.parseInt(payload.spoilerRange.replace(/[^0-9]/g, ""), 10)
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
            awardXp(user, XP_ACTIONS.fandom_clip, "fandom_clip")
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
      prev.map((post) => {
        if (post.id !== postId) return post
        return {
          ...post,
          is_liked: nextActive,
          like_count: Math.max(0, (post.like_count || 0) + (nextActive ? 1 : -1)),
        }
      }),
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
        prev.map((post) => {
          if (post.id !== postId) return post
          return {
            ...post,
            is_liked: current.is_liked,
            like_count: current.like_count || 0,
          }
        }),
      )
    }
  }

  const handleToggleRepost = async (postId) => {
    if (!user) return
    const current = posts.find((post) => post.id === postId)
    if (!current) return
    const nextActive = !current.is_reposted

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post
        return {
          ...post,
          is_reposted: nextActive,
          repost_count: Math.max(0, (post.repost_count || 0) + (nextActive ? 1 : -1)),
        }
      }),
    )

    try {
      await toggleReaction({
        postId,
        userId: user.id,
        type: "repost",
        isActive: current.is_reposted,
      })
    } catch (error) {
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post
          return {
            ...post,
            is_reposted: current.is_reposted,
            repost_count: current.repost_count || 0,
          }
        }),
      )
    }
  }

  const handleToggleSave = async (postId) => {
    if (!user) return
    const current = posts.find((post) => post.id === postId)
    if (!current) return
    const nextActive = !current.is_saved

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post
        return {
          ...post,
          is_saved: nextActive,
          save_count: Math.max(0, (post.save_count || 0) + (nextActive ? 1 : -1)),
        }
      }),
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
        prev.map((post) => {
          if (post.id !== postId) return post
          return {
            ...post,
            is_saved: current.is_saved,
            save_count: current.save_count || 0,
          }
        }),
      )
    }
  }

  const handleMuteUser = async (authorId, handle) => {
    if (!user || !authorId) return
    const nextIds = Array.from(new Set([...mutedIds, String(authorId)]))
    setMutedIds(nextIds)
    setPosts((prev) => prev.filter((post) => String(post.user_id) !== String(authorId)))

    const { error } = await client.auth.updateUser({
      data: { muted_user_ids: nextIds },
    })

    if (error) {
      console.error("Failed to mute user:", error)
    } else {
      addNotification(user.id, {
        title: "User muted",
        message: `${handle || "This user"} will no longer appear in your feed.`,
        type: "mute",
      })
    }
  }

  const handleReportPost = async (postId) => {
    if (!user) return
    const current = posts.find((post) => post.id === postId)
    try {
      await reportSocialPost({
        postId,
        reporterId: user.id,
        target: current
          ? {
              label: current.content?.slice(0, 140),
              url: `/social/${current.id}`,
              userId: current.user_id,
              userHandle: current.user_handle,
              userDisplayName: current.user_display_name,
              userAvatarUrl: current.user_avatar_url,
            }
          : undefined,
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

  const handleReportUser = async (post) => {
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

  const handleVotePoll = async (postId, optionIndex) => {
    if (!user) return
    const current = posts.find((post) => post.id === postId)
    if (!current || !Array.isArray(current.poll_counts)) return

    const previousCounts = current.poll_counts
    const previousVote = current.poll_user_vote
    const nextCounts = [...previousCounts]

    if (Number.isInteger(previousVote)) {
      nextCounts[previousVote] = Math.max(0, (nextCounts[previousVote] || 0) - 1)
    }
    nextCounts[optionIndex] = (nextCounts[optionIndex] || 0) + 1
    const nextTotal = nextCounts.reduce((sum, value) => sum + value, 0)

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post
        return {
          ...post,
          poll_counts: nextCounts,
          poll_total: nextTotal,
          poll_user_vote: optionIndex,
        }
      }),
    )

    try {
      await voteOnPoll({ postId, userId: user.id, optionIndex })
    } catch (error) {
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post
          return {
            ...post,
            poll_counts: previousCounts,
            poll_total: previousCounts.reduce((sum, value) => sum + value, 0),
            poll_user_vote: previousVote,
          }
        }),
      )
    }
  }

  const fandomCounts = useMemo(() => {
    return posts.reduce((acc, post) => {
      if (mutedIds.includes(String(post.user_id))) return acc
      if (!post.fandom) return acc
      const key = post.fandom
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  }, [posts, mutedIds])

  const suggestedUsers = useMemo(() => {
    const map = new Map()
    posts.forEach((post) => {
      if (mutedIds.includes(String(post.user_id))) return
      if (!post.user_id || post.user_id === user?.id) return
      if (map.has(post.user_id)) return
      const avatarInitial =
        post.user_display_name?.slice(0, 1).toUpperCase() || post.user_handle?.slice(1, 2) || "U"
      map.set(post.user_id, {
        id: post.user_id,
        name: post.user_display_name || "User",
        handle: post.user_handle,
        avatar: avatarInitial,
      })
    })
    return Array.from(map.values())
  }, [posts, user?.id, mutedIds])

  const filteredPosts = useMemo(() => {
    const filter = activeFilter.toLowerCase()
    return posts.filter((post) => {
      if (mutedIds.includes(String(post.user_id))) return false
      if (activeFilter === "All") return true
      if (filter === "text") {
        return (
          !post.clip_url &&
          !post.attached_list_name &&
          !["poll", "clip", "list"].includes(post.post_type)
        )
      }
      if (filter === "clips") return Boolean(post.clip_url)
      if (filter === "lists") return Boolean(post.attached_list_name)
      return post.post_type === filter.replace(/\s+/g, "-")
    })
  }, [posts, activeFilter, mutedIds])

  const postsByTab = useMemo(() => {
    const list = [...filteredPosts]
    const score = (post) => (post.like_count || 0) + (post.repost_count || 0) * 2
    if (activeTab === "new") {
      return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    if (activeTab === "top") {
      return list.sort((a, b) => score(b) - score(a))
    }
    if (activeTab === "following") {
      return list.filter((post) => following.includes(post.user_id))
    }
    if (activeTab === "fandoms") {
      return list.filter((post) => Boolean(post.fandom))
    }
    return list.sort((a, b) => score(b) - score(a))
  }, [filteredPosts, activeTab, following])

  const availableFandoms = useMemo(() => Object.keys(fandomCounts), [fandomCounts])

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-transparent to-fuchsia-500/10 p-4 sm:p-5 shadow-xl shadow-black/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/50">Social</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Anime conversations, without spoilers.</h1>
            <p className="text-sm text-white/60">Share clips, takes, reviews, and fandom posts.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">
              Live feed
            </div>
            <div className="text-[11px] text-white/50">{postsByTab.length} posts</div>
          </div>
        </div>
      </div>

      <div className="animate-slide-up">
        <PostComposer
          onCreate={handleCreatePost}
          availableFandoms={availableFandoms}
          availableLists={customLists}
          isAuthenticated={Boolean(user)}
          avatarUrl={avatarUrl}
          avatarInitial={avatarInitial}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="animate-slide-up stagger-1">
          <TabsList className="w-full justify-start bg-black/40 border border-white/10 rounded-2xl p-1.5 gap-1.5 overflow-x-auto shadow-lg shadow-black/30">
            {feedTabs.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="gap-2 rounded-xl px-4 py-2 text-xs font-semibold tracking-wide text-white/60 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-white/10 transition-smooth"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 animate-slide-up stagger-2">
          {quickFilters.map((filter) => (
            <Badge
              key={filter}
              variant="outline"
              className={cn(
                "cursor-pointer whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/70 transition-all",
                activeFilter === filter
                  ? "border-rose-500/40 bg-gradient-to-r from-rose-500/20 to-pink-500/20 text-white shadow-sm shadow-rose-500/10"
                  : "hover:bg-white/10 hover:text-white",
              )}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </Badge>
          ))}
        </div>

        {feedTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4 space-y-3">
            {loadingPosts ? (
              <div className="rounded-2xl border border-border/50 bg-card/50 p-10 text-center text-muted-foreground">
                Loading posts...
              </div>
            ) : loadError ? (
              <div className="rounded-2xl border border-border/50 bg-card/50 p-10 text-center text-muted-foreground">
                {loadError}
              </div>
            ) : postsByTab.length === 0 ? (
              <div className="rounded-2xl border border-border/50 bg-card/50 p-10 text-center text-muted-foreground">
                {user ? "No posts yet. Be the first to share." : "Sign in to start posting."}
              </div>
            ) : (
              postsByTab.map((post, index) => {
                const handleValue = post.user_handle || "@user"
                const normalizedHandle = handleValue.startsWith("@") ? handleValue : `@${handleValue}`
                const clipUrl = post.clip_url || ""
                const clipMeta = clipUrl ? parseVideoUrl(clipUrl) : null
                const linkEmbed = clipUrl
                  ? {
                      url: clipUrl,
                      title: post.content?.slice(0, 80) || "Watch clip",
                      thumbnails: clipMeta?.thumbnail ? [clipMeta.thumbnail] : [],
                      siteName: clipMeta?.site,
                      type: "video",
                    }
                  : undefined
                return (
                  <div key={post.id} className={`animate-slide-up stagger-${Math.min(index + 1, 5)}`}>
                    <SocialPost
                      post={{
                        id: post.id,
                        user: {
                          name: post.user_display_name || "User",
                          handle: normalizedHandle,
                          avatar: post.user_display_name?.slice(0, 1).toUpperCase() || "U",
                        },
                        userAvatarUrl: post.user_avatar_url || undefined,
                        content: post.content,
                        timestamp: formatRelativeTime(post.created_at),
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
                      onToggleLike={() => handleToggleLike(post.id)}
                      onToggleRepost={() => handleToggleRepost(post.id)}
                      onToggleSave={() => handleToggleSave(post.id)}
                      onVotePoll={user ? (optionIndex) => handleVotePoll(post.id, optionIndex) : undefined}
                      onReport={user ? () => handleReportPost(post.id) : undefined}
                      onReportUser={user ? () => handleReportUser(post) : undefined}
                      onMuteUser={user ? () => handleMuteUser(post.user_id, normalizedHandle) : undefined}
                    />
                  </div>
                )
              })
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
