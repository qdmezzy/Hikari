"use client"

import { useEffect, useMemo, useState } from "react"
import { Navigation } from "@/components/Navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import {
  Settings,
  Edit,
  Share2,
  Clock,
  Trophy,
  Star,
  Calendar,
  Film,
  List,
  MessageSquare,
  BarChart3,
  Heart,
  MapPin,
  Link2,
  Play,
  EyeOff,
  Shield,
  Video,
} from "lucide-react"
import Link from "next/link"
import { SocialPost } from "@/components/social/SocialPost"
import useAuth from "@/hooks/useAuth"
import RequireAuth from "@/components/RequireAuth"
import { subscribeSocialFollowing, subscribeSocialPosts } from "@/lib/social-events"
import { fetchFollowingIds, fetchSocialPostsByUser } from "@/lib/social-service"
import client from "@/lib/client"

const MEDIA_BY_IDS = `
query ($ids: [Int], $perPage: Int) {
  Page(perPage: $perPage) {
    media(id_in: $ids, sort: POPULARITY_DESC) {
      id
      type
      title { romaji english }
      coverImage { large }
      episodes
      chapters
      averageScore
      genres
    }
  }
}
`

const ANILIST_BATCH_SIZE = 25

const chunkIds = (ids, size) => {
  const batches = []
  for (let i = 0; i < ids.length; i += size) {
    batches.push(ids.slice(i, i + size))
  }
  return batches
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchAniListBatch = async (ids, attempt = 0) => {
  try {
    const res = await fetch("/api/anilist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: MEDIA_BY_IDS,
        variables: { ids, perPage: ids.length },
      }),
    })
    const json = await res.json().catch(() => ({}))
    const rateLimited =
      res.status === 429 ||
      (json?.errors || []).some((err) => /too many requests/i.test(err?.message || ""))

    if (rateLimited) {
      if (attempt < 2) {
        await sleep(600 * (attempt + 1))
        return fetchAniListBatch(ids, attempt + 1)
      }
      return { data: [], error: "Rate limited", rateLimited: true }
    }

    if (!res.ok || json?.errors) {
      return {
        data: [],
        error: json?.errors?.[0]?.message || "Failed to load AniList data",
        rateLimited: false,
      }
    }

    return { data: json?.data?.Page?.media ?? [], error: null, rateLimited: false }
  } catch (error) {
    return { data: [], error: error?.message || "Failed to load AniList data", rateLimited: false }
  }
}

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

const getTitle = (media) => media?.title?.english || media?.title?.romaji || "Unknown title"

export default function ProfilePage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("posts")
  const [showOnlineStatus, setShowOnlineStatus] = useState(true)
  const [showWatchActivity, setShowWatchActivity] = useState(true)
  const [entries, setEntries] = useState([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [userPosts, setUserPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [following, setFollowing] = useState([])
  const [followingLoading, setFollowingLoading] = useState(true)
  const [customLists, setCustomLists] = useState([])
  const [customListCounts, setCustomListCounts] = useState({})
  const [listsLoading, setListsLoading] = useState(true)
  const [clips, setClips] = useState([])
  const [clipsLoading, setClipsLoading] = useState(true)
  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewsError, setReviewsError] = useState("")
  const [favorites, setFavorites] = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const displayName = user?.user_metadata?.display_name || user?.email || "User"
  const rawHandle =
    user?.user_metadata?.handle ||
    user?.user_metadata?.username ||
    (user?.email ? user.email.split("@")[0] : "user")
  const displayHandle = rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`
  const profileInitial = displayName?.slice(0, 1).toUpperCase() || "H"
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || ""
  const bannerUrl = user?.user_metadata?.banner_url || ""
  const userBadges = Array.isArray(user?.user_metadata?.badges) ? user.user_metadata.badges : []
  const bio = user?.user_metadata?.bio || ""
  const location = user?.user_metadata?.location || ""
  const website = user?.user_metadata?.website || ""
  const joinedAt = user?.created_at ? new Date(user.created_at) : null

  useEffect(() => {
    setShowOnlineStatus(user?.user_metadata?.show_online_status ?? true)
    setShowWatchActivity(user?.user_metadata?.show_watch_activity ?? true)
  }, [user])

  useEffect(() => {
    if (!user) {
      setUserPosts([])
      setPostsLoading(false)
      return
    }
    let active = true
    const loadPosts = async () => {
      setPostsLoading(true)
      try {
        const posts = await fetchSocialPostsByUser(user.id)
        if (active) {
          setUserPosts(posts)
        }
      } catch (error) {
        if (active) {
          setUserPosts([])
        }
      } finally {
        if (active) {
          setPostsLoading(false)
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
    if (!user) {
      setFollowing([])
      setFollowingLoading(false)
      return
    }
    let active = true
    const loadFollowing = async () => {
      setFollowingLoading(true)
      try {
        const ids = await fetchFollowingIds(user.id)
        if (active) setFollowing(ids)
      } catch (error) {
        if (active) setFollowing([])
      } finally {
        if (active) setFollowingLoading(false)
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
    let active = true

    const loadEntries = async () => {
      if (!user) {
        setEntries([])
        setLoadingEntries(false)
        return
      }
      setLoadingEntries(true)

      const { data, error } = await client
        .from("list_entries")
        .select("id, media_id, status, progress, media_type, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (!active) return

      if (error) {
        console.error("Failed to load list entries:", error)
        setEntries([])
        setLoadingEntries(false)
        return
      }

      if (!data || data.length === 0) {
        setEntries([])
        setLoadingEntries(false)
        return
      }

      const mediaIds = Array.from(new Set(data.map((entry) => entry.media_id).filter(Boolean)))
      try {
        const mediaById = new Map()
        const batches = chunkIds(mediaIds, ANILIST_BATCH_SIZE)
        let rateLimited = false

        for (const batch of batches) {
          const result = await fetchAniListBatch(batch)
          if (result.rateLimited) {
            rateLimited = true
            break
          }
          if (result.error) {
            throw new Error(result.error)
          }
          const mediaList = result.data ?? []
          mediaList.forEach((media) => {
            mediaById.set(media.id, media)
          })
          if (batches.length > 1) {
            await sleep(120)
          }
        }

        const enriched = data.map((entry) => ({
          ...entry,
          media: mediaById.get(entry.media_id),
        }))
        if (active) {
          if (rateLimited) {
            console.warn("AniList rate limited. Showing partial profile data.")
          }
          setEntries(enriched)
          setLoadingEntries(false)
        }
      } catch (err) {
        console.error("Failed to hydrate media:", err)
        if (active) {
          setEntries(data.map((entry) => ({ ...entry, media: null })))
          setLoadingEntries(false)
        }
      }
    }

    loadEntries()

    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    let active = true

    const loadLists = async () => {
      if (!user) {
        setCustomLists([])
        setCustomListCounts({})
        setListsLoading(false)
        return
      }
      setListsLoading(true)
      const { data, error } = await client
        .from("custom_lists")
        .select("id, name, is_public, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (!active) return
      if (error) {
        console.error("Failed to load custom lists:", error)
        setCustomLists([])
        setCustomListCounts({})
        setListsLoading(false)
        return
      }

      const lists = data || []
      setCustomLists(lists)

      if (lists.length === 0) {
        setCustomListCounts({})
        setListsLoading(false)
        return
      }

      const listIds = lists.map((list) => list.id)
      const { data: items } = await client
        .from("custom_list_items")
        .select("list_id")
        .in("list_id", listIds)

      if (!active) return
      const counts = {}
      ;(items || []).forEach((item) => {
        counts[item.list_id] = (counts[item.list_id] || 0) + 1
      })
      setCustomListCounts(counts)
      setListsLoading(false)
    }

    loadLists()

    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    let active = true

    const loadClips = async () => {
      if (!user) {
        setClips([])
        setClipsLoading(false)
        return
      }
      setClipsLoading(true)
      const { data, error } = await client
        .from("fandom_clips")
        .select("id, media_id, media_title, clip_title, thumbnail_url, created_at, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (!active) return
      if (error) {
        console.error("Failed to load clips:", error)
        setClips([])
        setClipsLoading(false)
        return
      }
      setClips(data || [])
      setClipsLoading(false)
    }

    loadClips()

    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    let active = true

    const loadReviews = async () => {
      if (!user) {
        setReviews([])
        setReviewsLoading(false)
        return
      }
      setReviewsLoading(true)
      setReviewsError("")

      const { data, error } = await client
        .from("reviews")
        .select("id, media_id, rating, review_text, created_at")
        .eq("user_id", user.id)
        .eq("is_removed", false)
        .order("created_at", { ascending: false })

      if (!active) return
      if (error) {
        console.error("Failed to load reviews:", error)
        setReviews([])
        setReviewsError("Could not load reviews.")
        setReviewsLoading(false)
        return
      }

      const reviewList = data || []
      if (reviewList.length === 0) {
        setReviews([])
        setReviewsLoading(false)
        return
      }

      const mediaIds = Array.from(new Set(reviewList.map((review) => review.media_id).filter(Boolean)))
      try {
        const mediaById = new Map()
        const batches = chunkIds(mediaIds, ANILIST_BATCH_SIZE)
        let rateLimited = false
        for (const batch of batches) {
          const result = await fetchAniListBatch(batch)
          if (result.rateLimited) {
            rateLimited = true
            break
          }
          if (result.error) {
            throw new Error(result.error)
          }
          const mediaList = result.data ?? []
          mediaList.forEach((media) => {
            mediaById.set(media.id, media)
          })
          if (batches.length > 1) {
            await sleep(120)
          }
        }

        const enriched = reviewList.map((review) => ({
          ...review,
          media: mediaById.get(review.media_id),
        }))
        if (active) {
          if (rateLimited) {
            console.warn("AniList rate limited. Showing partial review data.")
          }
          setReviews(enriched)
          setReviewsLoading(false)
        }
      } catch (err) {
        console.error("Failed to hydrate reviews:", err)
        if (active) {
          setReviews(reviewList.map((review) => ({ ...review, media: null })))
          setReviewsLoading(false)
        }
      }
    }

    loadReviews()

    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    let active = true
    const loadFavorites = async () => {
      const favoriteIds = Array.isArray(user?.user_metadata?.favorite_media_ids)
        ? user.user_metadata.favorite_media_ids
        : []
      const normalizedFavorites = Array.from(
        new Set(favoriteIds.map((value) => Number(value)).filter(Number.isFinite)),
      )

      if (!normalizedFavorites.length) {
        setFavorites([])
        setFavoritesLoading(false)
        return
      }

      setFavoritesLoading(true)
      try {
        const mediaById = new Map()
        const batches = chunkIds(normalizedFavorites, ANILIST_BATCH_SIZE)
        let rateLimited = false
        for (const batch of batches) {
          const result = await fetchAniListBatch(batch)
          if (result.rateLimited) {
            rateLimited = true
            break
          }
          if (result.error) {
            throw new Error(result.error)
          }
          const mediaList = result.data ?? []
          mediaList.forEach((media) => {
            mediaById.set(media.id, media)
          })
          if (batches.length > 1) {
            await sleep(120)
          }
        }
        if (!active) return
        if (rateLimited) {
          console.warn("AniList rate limited. Showing partial favorites data.")
        }
        setFavorites(normalizedFavorites.map((id) => mediaById.get(id)).filter(Boolean))
      } catch (error) {
        console.error("Failed to load favorites:", error)
        if (active) setFavorites([])
      } finally {
        if (active) setFavoritesLoading(false)
      }
    }

    loadFavorites()

    return () => {
      active = false
    }
  }, [user])

  const updatePrivacySetting = async (key, value) => {
    if (!user) return
    const updates = { [key]: value }
    const { error } = await client.auth.updateUser({ data: updates })
    if (error) {
      console.error("Failed to update privacy setting:", error)
    }
  }

  const handleShareProfile = async () => {
    if (typeof window === "undefined") return
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 1500)
    } catch (error) {
      window.prompt("Copy this profile link:", window.location.href)
    }
  }

  const stats = useMemo(() => {
    const totalAnimeProgress = entries.reduce(
      (sum, entry) => sum + (entry.media_type === "ANIME" ? entry.progress || 0 : 0),
      0,
    )
    const totalProgress = entries.reduce((sum, entry) => sum + (entry.progress || 0), 0)
    const completedCount = entries.filter((entry) => entry.status === "completed").length

    const streakDates = new Set()
    entries.forEach((entry) => {
      if (!entry?.updated_at) return
      const date = new Date(entry.updated_at)
      if (Number.isNaN(date.getTime())) return
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")}`
      streakDates.add(key)
    })

    let streak = 0
    let cursor = new Date()
    while (true) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(
        cursor.getDate(),
      ).padStart(2, "0")}`
      if (!streakDates.has(key)) break
      streak += 1
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1)
    }

    const timeWatchedHours = Math.round((totalAnimeProgress * 24) / 60)

    return [
      { label: "Time Watched", value: `${timeWatchedHours}h`, icon: Clock, color: "bg-cyan-500" },
      { label: "Completed", value: completedCount, icon: Trophy, color: "bg-yellow-500" },
      { label: "Day Streak", value: streak, icon: Calendar, color: "bg-orange-500" },
      { label: "Progress Logged", value: totalProgress, icon: Film, color: "bg-green-500" },
    ]
  }, [entries])

  const topGenres = useMemo(() => {
    const counts = new Map()
    entries.forEach((entry) => {
      const genres = entry?.media?.genres || []
      genres.forEach((genre) => {
        counts.set(genre, (counts.get(genre) || 0) + 1)
      })
    })
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [entries])

  const watchActivity = useMemo(() => {
    const today = new Date()
    const days = []
    const counts = {}
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const key = date.toISOString().slice(0, 10)
      const label = date.toLocaleDateString("en-US", { weekday: "short" })
      days.push({ key, label })
      counts[key] = 0
    }
    entries.forEach((entry) => {
      if (!entry?.updated_at) return
      const key = new Date(entry.updated_at).toISOString().slice(0, 10)
      if (Object.prototype.hasOwnProperty.call(counts, key)) {
        counts[key] += 1
      }
    })
    return days.map((day) => ({ day: day.label, episodes: counts[day.key] }))
  }, [entries])

  const activityTotal = watchActivity.reduce((sum, day) => sum + day.episodes, 0)

  const avgScore = useMemo(() => {
    const scores = entries.map((entry) => entry?.media?.averageScore).filter((score) => score)
    if (scores.length === 0) return null
    const total = scores.reduce((sum, score) => sum + score, 0)
    return (total / scores.length / 10).toFixed(1)
  }, [entries])

  const topGenreLabel = topGenres[0]?.name || null
  const xp = Number(user?.user_metadata?.xp || 0)
  const level = Number(user?.user_metadata?.level || 0)
  const xpToNext = Number(user?.user_metadata?.xp_to_next || 0)
  const showXp = Number.isFinite(level) && level > 0 && Number.isFinite(xpToNext) && xpToNext > 0

  const formattedPosts = useMemo(() => {
    return userPosts.map((post) => ({
      id: post.id,
      user: {
        name: post.user_display_name || displayName,
        handle: post.user_handle || displayHandle,
        avatar: post.user_display_name?.slice(0, 1).toUpperCase() || profileInitial,
      },
      userAvatarUrl: post.user_avatar_url || avatarUrl || undefined,
      content: post.content || "",
      attachedMedia: post.attached_media_title,
      attachedList: post.attached_list_name,
      fandom: post.fandom,
      hasSpoilers: post.has_spoilers,
      spoilerRange: post.spoiler_range,
      timestamp: formatRelativeTime(post.created_at),
      likes: post.like_count || 0,
      comments: post.comment_count || 0,
      reposts: post.repost_count || 0,
      isLiked: post.is_liked || false,
      isReposted: post.is_reposted || false,
      isSaved: post.is_saved || false,
      postType: post.post_type,
      postUrl: `/social/${post.id}`,
    }))
  }, [userPosts, displayName, displayHandle, profileInitial, avatarUrl])

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="pt-12 pb-20 md:pb-8">
        <div className="relative -mt-14 h-36 md:h-48 overflow-hidden animate-fade-in">
          {bannerUrl ? (
            <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/30 vi-purple-500/20 to-cyan-500/30" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background vi-background/50 to-transparent" />
        </div>

        <div className="mx-auto max-w-5xl px-4">
          {/* Profile Header */}
          <div className="relative -mt-16 mb-8 animate-slide-up">
            <div className="flex flex-col md:flex-row md:items-end gap-6">
              {/* Avatar */}
              <div className="mx-auto md:mx-0 relative group">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-pink-500 to-cyan-500 opacity-75 group-hover:opacity-100 transition-smooth blur-sm" />
                <div className="relative h-28 w-28 rounded-full border-4 border-background bg-card flex items-center justify-center overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-4xl font-bold">{profileInitial}</span>
                  )}
                </div>
                {showOnlineStatus && (
                  <div className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                  <h1 className="text-3xl font-bold">{displayName}</h1>
                  {userBadges.map((badge) => (
                    <Badge key={badge} variant="secondary" className="text-xs bg-secondary/60 text-foreground">
                      {badge}
                    </Badge>
                  ))}
                </div>
                <p className="text-muted-foreground">{displayHandle}</p>
                <p className="mt-2 text-muted-foreground max-w-lg">
                  {bio || "Add a bio in settings to tell people about your taste."}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-muted-foreground">
                  {location ? (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {location}
                    </span>
                  ) : null}
                  {website ? (
                    <span className="flex items-center gap-1.5">
                      <Link2 className="h-4 w-4" />
                      {website}
                    </span>
                  ) : null}
                  {joinedAt ? (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      Joined {joinedAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-center md:justify-start gap-4 text-sm">
                  <span>
                    {followingLoading ? (
                      <span className="inline-flex h-4 w-6 rounded bg-white/10 align-middle animate-pulse" />
                    ) : (
                      <strong className="text-foreground">{following.length}</strong>
                    )}{" "}
                    <span className="text-muted-foreground">Following</span>
                  </span>
                  <span>
                    {postsLoading ? (
                      <span className="inline-flex h-4 w-6 rounded bg-white/10 align-middle animate-pulse" />
                    ) : (
                      <strong className="text-foreground">{userPosts.length}</strong>
                    )}{" "}
                    <span className="text-muted-foreground">Posts</span>
                  </span>
                  <span>
                    {clipsLoading ? (
                      <span className="inline-flex h-4 w-6 rounded bg-white/10 align-middle animate-pulse" />
                    ) : (
                      <strong className="text-foreground">{clips.length}</strong>
                    )}{" "}
                    <span className="text-muted-foreground">Clips</span>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-transparent hover-lift"
                  onClick={handleShareProfile}
                >
                  <Share2 className="h-4 w-4" />
                  {shareCopied ? "Copied" : "Share"}
                </Button>
                <Link href="/settings">
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent hover-lift">
                    <Edit className="h-4 w-4" />
                    Edit Profile
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button variant="outline" size="icon" className="bg-transparent hover-lift">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {stats.map((stat, i) => {
              const Icon = stat.icon
              return (
                <Card
                  key={stat.label}
                  className={`border-border/50 bg-card/50 hover-lift animate-slide-up stagger-${i + 1}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-lg ${stat.color}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      {loadingEntries ? (
                        <div className="h-5 w-16 rounded-full bg-white/10 animate-pulse" />
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Updated
                        </Badge>
                      )}
                    </div>
                    {loadingEntries ? (
                      <div className="h-7 w-20 rounded bg-white/10 animate-pulse" />
                    ) : (
                      <p className="text-2xl font-bold">{stat.value}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-slide-up stagger-5">
            <TabsList className="bg-card/50 rounded-xl p-1 w-full justify-start overflow-x-auto border border-border/50 mb-6">
              {[
                { id: "posts", icon: MessageSquare, label: "Posts" },
                { id: "clips", icon: Video, label: "Clips" },
                { id: "lists", icon: List, label: "Lists" },
                { id: "reviews", icon: Star, label: "Reviews" },
                { id: "stats", icon: BarChart3, label: "Stats" },
                { id: "favorites", icon: Heart, label: "Favorites" },
              ].map((tab) => (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id} 
                  className="rounded-lg gap-2 dat-[state=active]:bg-secondary transition-smooth"
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="md:col-span-2">
                <TabsContent value="posts" className="mt-0 space-y-4">
                  {postsLoading ? (
                    <Card className="border-border/50 bg-card/50 animate-fade-in">
                      <CardContent className="p-6">
                        <div className="space-y-3 animate-pulse">
                          <div className="h-4 w-1/3 rounded bg-white/10" />
                          <div className="h-3 w-full rounded bg-white/10" />
                          <div className="h-3 w-2/3 rounded bg-white/10" />
                          <div className="h-8 w-24 rounded-full bg-white/10" />
                        </div>
                      </CardContent>
                    </Card>
                  ) : formattedPosts.length === 0 ? (
                    <Card className="border-border/50 bg-card/50 animate-fade-in">
                      <CardContent className="p-8 text-center">
                        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                        <h3 className="font-medium mb-1">No posts yet</h3>
                        <p className="text-sm text-muted-foreground">
                          Share your first post in Social to show it here.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    formattedPosts.map((post, i) => (
                      <div key={post.id} className={`animate-slide-up stagger-${i + 1}`}>
                        <SocialPost post={post} />
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="clips" className="mt-0 space-y-4">
                  {clipsLoading ? (
                    <Card className="border-border/50 bg-card/50 animate-fade-in">
                      <CardContent className="p-6">
                        <div className="space-y-3 animate-pulse">
                          <div className="h-4 w-1/4 rounded bg-white/10" />
                          <div className="h-3 w-full rounded bg-white/10" />
                          <div className="h-3 w-2/3 rounded bg-white/10" />
                        </div>
                      </CardContent>
                    </Card>
                  ) : clips.length === 0 ? (
                    <Card className="border-border/50 bg-card/50 animate-fade-in">
                      <CardContent className="p-8 text-center">
                        <Video className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                        <h3 className="font-medium mb-1">No clips yet</h3>
                        <p className="text-sm text-muted-foreground">
                          Submit a clip to Discover and it will appear here.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    clips.map((clip, i) => (
                      <Link
                        key={clip.id}
                        href={`/hub/${encodeURIComponent(
                          (clip.media_title || clip.media_id.toString()).trim().replace(/\s+/g, "-"),
                        )}`}
                        className={`block animate-slide-up stagger-${i + 1}`}
                      >
                        <Card className="border-border/50 bg-card/50 hover-lift cursor-pointer">
                          <CardContent className="p-4 flex items-center gap-4">
                          <div className="h-20 w-32 rounded-lg bg-secondary/40 overflow-hidden flex-shrink-0">
                            {clip.thumbnail_url ? (
                              <img
                                src={clip.thumbnail_url}
                                alt={clip.clip_title || clip.media_title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <Play className="h-8 w-8 text-muted-foreground/60" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">
                              {clip.clip_title || clip.media_title || "Untitled clip"}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {clip.media_title || "Unknown anime"}
                            </p>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {clip.status === "pending" ? "Pending review" : "Approved"}
                            </div>
                          </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="lists" className="mt-0 space-y-4">
                  {listsLoading ? (
                    <Card className="border-border/50 bg-card/50 animate-fade-in">
                      <CardContent className="p-6">
                        <div className="space-y-3 animate-pulse">
                          <div className="h-4 w-1/4 rounded bg-white/10" />
                          <div className="h-3 w-full rounded bg-white/10" />
                          <div className="h-3 w-2/3 rounded bg-white/10" />
                        </div>
                      </CardContent>
                    </Card>
                  ) : customLists.length === 0 ? (
                    <Card className="border-border/50 bg-card/50 animate-fade-in">
                      <CardContent className="p-8 text-center">
                        <List className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                        <h3 className="font-medium mb-1">No lists yet</h3>
                        <p className="text-sm text-muted-foreground">
                          Create a list to share it on your profile.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    customLists.map((list, i) => (
                      <Link
                        key={list.id}
                        href={`/lists/${list.id}`}
                        className={`block animate-slide-up stagger-${i + 1}`}
                      >
                        <Card className="border-border/50 bg-card/50 hover-lift cursor-pointer">
                          <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{list.name}</h3>
                              {!list.is_public && (
                                <Badge variant="outline" className="text-[10px] bg-transparent">
                                  <EyeOff className="h-3 w-3 mr-1" />
                                  Private
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {(customListCounts[list.id] || 0)} items
                            </p>
                          </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="reviews" className="mt-0 space-y-4">
                  {reviewsLoading ? (
                    <Card className="border-border/50 bg-card/50 animate-fade-in">
                      <CardContent className="p-6">
                        <div className="space-y-3 animate-pulse">
                          <div className="h-4 w-1/3 rounded bg-white/10" />
                          <div className="h-3 w-full rounded bg-white/10" />
                          <div className="h-3 w-2/3 rounded bg-white/10" />
                        </div>
                      </CardContent>
                    </Card>
                  ) : reviewsError ? (
                    <Card className="border-border/50 bg-card/50 animate-fade-in">
                      <CardContent className="p-8 text-center text-muted-foreground">
                        {reviewsError}
                      </CardContent>
                    </Card>
                  ) : reviews.length === 0 ? (
                    <Card className="border-border/50 bg-card/50 animate-fade-in">
                      <CardContent className="p-8 text-center">
                        <Star className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                        <h3 className="font-medium mb-1">No reviews yet</h3>
                        <p className="text-sm text-muted-foreground">
                          Share your thoughts on anime you have watched.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    reviews.map((review, i) => (
                      <Link
                        key={review.id}
                        href={`/media/${review.media_id}`}
                        className={`block animate-slide-up stagger-${i + 1}`}
                      >
                        <Card className="border-border/50 bg-card/50 hover-lift cursor-pointer">
                          <CardContent className="p-4 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-9 rounded-lg bg-secondary/50 overflow-hidden">
                              {review.media?.coverImage?.large ? (
                                <img
                                  src={review.media.coverImage.large}
                                  alt={getTitle(review.media)}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full bg-secondary/50" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{getTitle(review.media)}</p>
                              <p className="text-xs text-muted-foreground">
                                {review.created_at ? formatRelativeTime(review.created_at) : "Recently"}
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {review.rating}/10
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{review.review_text}</p>
                          </CardContent>
                        </Card>
                      </Link>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="stats" className="mt-0 space-y-4">
                  <Card className="border-border/50 bg-card/50 animate-slide-up">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Top Genres</CardTitle>
                    </CardHeader>
                  <CardContent className="space-y-4">
                      {loadingEntries ? (
                        <div className="space-y-3">
                          {[...Array(3)].map((_, i) => (
                            <div key={`genre-skeleton-${i}`} className="space-y-2">
                              <div className="h-3 w-32 rounded bg-secondary/60 animate-pulse" />
                              <div className="h-2 w-full rounded bg-secondary/40 animate-pulse" />
                            </div>
                          ))}
                        </div>
                      ) : topGenres.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Track more anime to see your top genres.
                        </p>
                      ) : (
                        topGenres.map((genre, i) => (
                          <div key={genre.name} className={`animate-slide-in stagger-${i + 1}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium">{genre.name}</span>
                              <span className="text-xs text-muted-foreground">{genre.count} entries</span>
                            </div>
                            <Progress
                              value={Math.min((genre.count / topGenres[0].count) * 100, 100)}
                              className="h-2"
                            />
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 bg-card/50 animate-slide-up stagger-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Weekly Activity</CardTitle>
                    </CardHeader>
                  <CardContent>
                      {loadingEntries ? (
                        <div className="h-24 w-full rounded-xl bg-secondary/40 animate-pulse" />
                      ) : !showWatchActivity ? (
                        <p className="text-sm text-muted-foreground">Watch activity is hidden.</p>
                      ) : activityTotal === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No recent updates in the last 7 days.
                        </p>
                      ) : (
                        <>
                          <div className="flex items-end justify-between gap-2 h-32">
                            {watchActivity.map((day, i) => (
                              <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                  className="w-full bg-gradient-to-t from-pink-500 to-pink-400 rounded-t-sm transition-smooth"
                                  style={{
                                    height: `${(day.episodes / Math.max(activityTotal, 1)) * 100}%`,
                                    animationDelay: `${i * 100}ms`,
                                  }}
                                />
                                <span className="text-[10px] text-muted-foreground">{day.day}</span>
                              </div>
                            ))}
                          </div>
                          <p className="mt-4 text-sm text-muted-foreground">
                            <strong className="text-foreground">{activityTotal}</strong> updates this week
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="favorites" className="mt-0">
                  {favoritesLoading ? (
                    <Card className="border-border/50 bg-card/50 animate-fade-in">
                      <CardContent className="p-6">
                        <div className="space-y-3 animate-pulse">
                          <div className="h-4 w-1/4 rounded bg-white/10" />
                          <div className="h-3 w-full rounded bg-white/10" />
                          <div className="h-3 w-2/3 rounded bg-white/10" />
                        </div>
                      </CardContent>
                    </Card>
                  ) : favorites.length === 0 ? (
                    <Card className="border-border/50 bg-card/50 animate-fade-in">
                      <CardContent className="p-8 text-center">
                        <Heart className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                        <h3 className="font-medium mb-1">No favorites yet</h3>
                        <p className="text-sm text-muted-foreground">
                          Tap the heart on any anime page to show it here.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {favorites.map((anime, i) => (
                        <Link
                          key={anime.id}
                          href={`/media/${anime.id}`}
                          className={`block animate-slide-up stagger-${i + 1}`}
                        >
                          <Card className="border-border/50 bg-card/50 hover-lift cursor-pointer">
                            <CardContent className="p-4 flex items-center gap-4">
                            <div className="h-16 w-12 rounded-lg bg-secondary/40 overflow-hidden flex-shrink-0">
                              {anime.coverImage?.large ? (
                                <img
                                  src={anime.coverImage.large}
                                  alt={getTitle(anime)}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full bg-secondary/50" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{getTitle(anime)}</p>
                              <p className="text-xs text-muted-foreground">{anime.type}</p>
                              {anime.averageScore ? (
                                <div className="flex items-center gap-1 mt-1">
                                  <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                                  <span className="text-sm font-medium">
                                    {(anime.averageScore / 10).toFixed(1)}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <Card className="border-border/50 bg-card/50 animate-slide-up stagger-3">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Privacy
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Online Status</p>
                        <p className="text-xs text-muted-foreground">Show when you are active</p>
                      </div>
                      <Switch
                        checked={showOnlineStatus}
                        onCheckedChange={(value) => {
                          setShowOnlineStatus(value)
                          updatePrivacySetting("show_online_status", value)
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Watch Activity</p>
                        <p className="text-xs text-muted-foreground">Show your recent updates</p>
                      </div>
                      <Switch
                        checked={showWatchActivity}
                        onCheckedChange={(value) => {
                          setShowWatchActivity(value)
                          updatePrivacySetting("show_watch_activity", value)
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/50 animate-slide-up stagger-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Top Genres</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingEntries ? (
                      <div className="flex flex-wrap gap-2">
                        {[...Array(4)].map((_, i) => (
                          <div key={`genre-pill-${i}`} className="h-6 w-16 rounded-full bg-secondary/50 animate-pulse" />
                        ))}
                      </div>
                    ) : topGenres.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Genres will show once you track more titles.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {topGenres.slice(0, 6).map((genre) => (
                          <Badge
                            key={genre.name}
                            variant="secondary"
                            className="transition-smooth hover:bg-secondary/80 cursor-pointer"
                          >
                            {genre.name} {genre.count}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/50 animate-slide-up stagger-5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Insights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg. Score</span>
                      <span className="font-medium">{loadingEntries ? "--" : avgScore ? avgScore : "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Top Genre</span>
                      <span className="font-medium">{loadingEntries ? "--" : topGenreLabel || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entries</span>
                      <span className="font-medium">{loadingEntries ? "--" : entries.length}</span>
                    </div>
                    {showXp && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Level</span>
                        <span className="font-medium">
                          {loadingEntries ? "--" : `${level} - ${xp}/${xpToNext} XP`}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </Tabs>
        </div>
      </main>
    </div>
    </RequireAuth>
  )
}



