"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  MapPin,
  Calendar,
  Link as LinkIcon,
  Clock,
  Star,
  Play,
  CheckCircle,
  Crown,
  ExternalLink,
  User,
  BarChart3,
  Heart,
  PauseCircle,
  XCircle,
  Flame,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import client from "@/lib/client"
import useAuth from "@/hooks/useAuth"
import { toast } from "sonner"
import { fetchFollowingIds, toggleFollow } from "@/lib/social-service"
import { fetchPublicProfileByHandle, normalizeHandle } from "@/lib/public-profile"
import { fetchAniListMediaByIds, formatCompactNumber, getMediaHref, getMediaTitle } from "@/lib/anilist"

const publicTabs = [
  { id: "overview", label: "Overview", icon: User },
  { id: "watching", label: "Watching", icon: Play },
  { id: "completed", label: "Completed", icon: CheckCircle },
  { id: "planned", label: "Plan to Watch", icon: Clock },
  { id: "onhold", label: "On Hold", icon: PauseCircle },
  { id: "dropped", label: "Dropped", icon: XCircle },
]

const LIST_SELECT =
  "id, media_id, status, progress, score, media_type, updated_at, created_at, finished_at, hide_from_profile"

const LIST_SELECT_FALLBACK = "id, media_id, status, progress, score, media_type, updated_at, created_at"

const isHideFromProfileSchemaError = (error) => {
  const code = String(error?.code || "")
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase()
  return code === "42703" || code === "PGRST204" || text.includes("hide_from_profile")
}

const formatJoinedDate = (value) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
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
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

const formatEntryScore = (value) => {
  const numeric = Number(value || 0)
  if (!numeric) return null
  if (numeric > 10) return (numeric / 10).toFixed(1)
  return numeric.toFixed(numeric % 1 === 0 ? 0 : 1)
}

const normalizeEntryScore = (value) => {
  const numeric = Number(value || 0)
  if (!numeric) return null
  return numeric > 10 ? Number((numeric / 10).toFixed(1)) : Number(numeric.toFixed(numeric % 1 === 0 ? 0 : 1))
}

const isMangaEntry = (entry) => entry?.media_type === "MANGA" || entry?.media?.type === "MANGA"

const getTotalUnits = (entry) => {
  const animeTotal = Number(entry?.media?.episodes || 0)
  const mangaTotal = Number(entry?.media?.chapters || 0)
  if (isMangaEntry(entry)) return mangaTotal || animeTotal || 0
  return animeTotal || mangaTotal || 0
}

const getProgressText = (entry) => {
  const progress = Number(entry?.progress || 0)
  const total = getTotalUnits(entry)

  if (total > 0) return `${progress}/${total}`
  return `${progress}`
}

const getProgressUnitLabel = (entry) => (isMangaEntry(entry) ? "chapters" : "episodes")

const getEntryDisplayProgress = (entry) => {
  const progress = Number(entry?.progress || 0)
  const totalUnits = getTotalUnits(entry)
  if (entry?.status === "completed" && totalUnits > 0) return totalUnits
  return progress
}

const buildActivityText = (entry) => {
  const title = getMediaTitle(entry?.media)
  const progress = Number(entry?.progress || 0)
  const manga = isMangaEntry(entry)

  switch (entry?.status) {
    case "completed":
      return `Completed ${title}`
    case "plan_to_watch":
      return manga ? `Planned to read ${title}` : `Planned to watch ${title}`
    case "on_hold":
      return `Put ${title} on hold`
    case "dropped":
      return `Dropped ${title}`
    case "rewatching":
      return manga ? `Rereading ${title}` : `Rewatching ${title}`
    default:
      return manga ? `Read chapter ${progress} of ${title}` : `Watched episode ${progress} of ${title}`
  }
}

const getListTimestamp = (entry, listType) => {
  // Use the most meaningful date per list type — updated_at gets bumped on
  // every import, so it's not reliable for "when did this happen".
  const raw =
    listType === "completed"
      ? entry?.finished_at || entry?.created_at || entry?.updated_at
      : entry?.created_at || entry?.updated_at
  const relative = formatRelativeTime(raw)
  if (!relative) return ""

  switch (listType) {
    case "watching":
      return `Updated ${relative}`
    case "completed":
      return `Completed ${relative}`
    case "planned":
      return `Added ${relative}`
    case "onhold":
      return `Paused ${relative}`
    case "dropped":
      return `Dropped ${relative}`
    default:
      return relative
  }
}

const getListItems = (entries) => {
  const ts = (value) => (value ? new Date(value).getTime() : 0)

  const watching = entries.filter((entry) => ["watching", "rewatching"].includes(entry?.status))
  const completed = entries.filter((entry) => entry?.status === "completed")
  const planned = entries.filter((entry) => entry?.status === "plan_to_watch")
  const onhold = entries.filter((entry) => entry?.status === "on_hold")
  const dropped = entries.filter((entry) => entry?.status === "dropped")

  // Plan to Watch: oldest added first.
  planned.sort((a, b) => ts(a.created_at) - ts(b.created_at))
  // Completed: most recently finished first (fall back to updated_at).
  completed.sort((a, b) => ts(b.finished_at || b.updated_at) - ts(a.finished_at || a.updated_at))
  // Watching / on-hold / dropped: most recent activity first.
  watching.sort((a, b) => ts(b.updated_at) - ts(a.updated_at))
  onhold.sort((a, b) => ts(b.updated_at) - ts(a.updated_at))
  dropped.sort((a, b) => ts(b.updated_at) - ts(a.updated_at))

  return { watching, completed, planned, onhold, dropped }
}

const getBannerFallback = (entries) =>
  entries.find((entry) => entry?.media?.bannerImage)?.media?.bannerImage ||
  entries.find((entry) => entry?.media?.coverImage?.extraLarge)?.media?.coverImage?.extraLarge ||
  ""

const PUBLIC_PROFILE_BUILD = "2026-04-10-public-profile-refresh"

function ImageFallback({ title, className = "" }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_55%),linear-gradient(180deg,rgba(12,18,30,0.96),rgba(8,13,24,0.98))] text-center text-sm font-semibold text-white/70",
        className,
      )}
    >
      <span className="line-clamp-3 px-3">{title || "Hikari"}</span>
    </div>
  )
}

function MediaThumb({ src, alt, className }) {
  if (!src) {
    return <ImageFallback title={alt} className={className} />
  }

  return <img src={src} alt={alt} className={cn("object-cover", className)} />
}

function EmptyState({ message }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function MediaListView({ listType, items }) {
  if (!items.length) {
    return <EmptyState message="Nothing is public in this section yet." />
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const title = getMediaTitle(item?.media)
        const href = item?.media ? getMediaHref(item.media) : `/media/${item.media_id}`
        const cover = item?.media?.coverImage?.large || item?.media?.coverImage?.extraLarge || ""
        const score = formatEntryScore(item?.score)

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
          >
            <Link
              href={href}
              className="group flex items-center gap-4 rounded-xl border border-border/50 bg-card/50 p-4 transition-all hover:border-primary/40 hover:bg-card/70"
            >
              <div className="relative h-24 w-16 overflow-hidden rounded-lg bg-muted/40">
                <MediaThumb
                  src={cover}
                  alt={title}
                  className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-1 font-semibold text-foreground transition-colors group-hover:text-primary">
                  {title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getProgressText(item)} {getProgressUnitLabel(item)}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-muted-foreground/70">
                  {getListTimestamp(item, listType)}
                </p>
              </div>

              {score ? (
                <div className="flex items-center gap-1 rounded-lg bg-muted/40 px-3 py-1.5 text-sm font-semibold text-foreground">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {score}
                </div>
              ) : null}
            </Link>
          </motion.div>
        )
      })}
    </div>
  )
}

export default function PublicProfilePage() {
  const params = useParams()
  const { user: authUser } = useAuth()
  const handle = React.useMemo(() => normalizeHandle(params?.handle), [params])
  const [isLoaded, setIsLoaded] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("overview")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [profile, setProfile] = React.useState(null)
  const [entries, setEntries] = React.useState([])
  const [favoriteEntries, setFavoriteEntries] = React.useState([])
  const [isFollowing, setIsFollowing] = React.useState(false)
  const [followBusy, setFollowBusy] = React.useState(false)

  const ownUserId = authUser?.id || null
  const profileUserId = profile?.user_id || null
  const canFollow = Boolean(ownUserId && profileUserId && ownUserId !== profileUserId)

  React.useEffect(() => {
    let active = true
    if (!canFollow) {
      setIsFollowing(false)
      return
    }
    fetchFollowingIds(ownUserId)
      .then((ids) => active && setIsFollowing(ids.includes(profileUserId)))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [canFollow, ownUserId, profileUserId])

  const handleToggleFollow = async () => {
    if (!canFollow || followBusy) return
    const wasFollowing = isFollowing
    setFollowBusy(true)
    setIsFollowing(!wasFollowing)
    try {
      await toggleFollow({ followerId: ownUserId, followingId: profileUserId, isFollowing: wasFollowing })
    } catch {
      setIsFollowing(wasFollowing)
      toast.error("Couldn't update follow. Please try again.")
    } finally {
      setFollowBusy(false)
    }
  }

  React.useEffect(() => {
    setIsLoaded(true)
  }, [])

  React.useEffect(() => {
    let active = true

    const loadProfile = async () => {
      if (!handle) {
        setError("This public profile could not be found.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      const { data: profileData, error: profileError } = await fetchPublicProfileByHandle(handle)
      if (!active) return

      if (profileError || !profileData?.user_id) {
        setProfile(null)
        setEntries([])
        setError("This public profile could not be loaded.")
        setLoading(false)
        return
      }

      setProfile(profileData)

      let listResponse = await client
        .from("list_entries")
        .select(LIST_SELECT)
        .eq("user_id", profileData.user_id)
        .order("updated_at", { ascending: false })

      if (listResponse.error && isHideFromProfileSchemaError(listResponse.error)) {
        listResponse = await client
          .from("list_entries")
          .select(LIST_SELECT_FALLBACK)
          .eq("user_id", profileData.user_id)
          .order("updated_at", { ascending: false })
      }

      if (!active) return

      if (listResponse.error) {
        console.error("Failed to load public list entries:", listResponse.error)
        setEntries([])
        setLoading(false)
        return
      }

      const rawEntries = (listResponse.data || []).map((entry) => ({
        ...entry,
        hide_from_profile: Boolean(entry?.hide_from_profile),
      }))
      const visibleEntries = rawEntries.filter((entry) => !entry.hide_from_profile)

      // Real favorites this user saved (AniList media ids), exposed via the share profile.
      // Fall back to the owner's own auth metadata when viewing their own profile
      // (covers the case where favorites haven't synced to public_profiles yet).
      const isOwnProfile = authUser?.id && String(authUser.id) === String(profileData.user_id)
      const ownFavoriteIds =
        isOwnProfile && Array.isArray(authUser?.user_metadata?.favorite_media_ids)
          ? authUser.user_metadata.favorite_media_ids
          : []
      const sourceFavoriteIds = Array.isArray(profileData.favorite_media_ids) && profileData.favorite_media_ids.length
        ? profileData.favorite_media_ids
        : ownFavoriteIds
      const favoriteIds = sourceFavoriteIds.map((id) => Number(id)).filter(Number.isFinite)

      const mediaIdsToFetch = Array.from(
        new Set(
          [...visibleEntries.map((entry) => Number(entry.media_id)), ...favoriteIds].filter(Number.isFinite),
        ),
      )

      if (!mediaIdsToFetch.length) {
        setEntries([])
        setFavoriteEntries([])
        setLoading(false)
        return
      }

      try {
        const mediaById = await fetchAniListMediaByIds(mediaIdsToFetch)
        if (!active) return

        setEntries(
          visibleEntries.map((entry) => ({
            ...entry,
            media: mediaById.get(entry.media_id) || null,
          })),
        )

        const scoreByMediaId = new Map(visibleEntries.map((entry) => [Number(entry.media_id), entry.score]))
        setFavoriteEntries(
          favoriteIds
            .map((id) => ({
              id: `fav-${id}`,
              media_id: id,
              media: mediaById.get(id) || null,
              score: scoreByMediaId.get(id) ?? null,
            }))
            .filter((fav) => fav.media),
        )
      } catch (mediaError) {
        console.error("Failed to hydrate public media:", mediaError)
        if (!active) return
        setEntries(visibleEntries.map((entry) => ({ ...entry, media: null })))
        setFavoriteEntries([])
      } finally {
        if (active) setLoading(false)
      }
    }

    loadProfile()

    return () => {
      active = false
    }
  }, [handle, authUser?.id])

  const groupedLists = React.useMemo(() => getListItems(entries), [entries])

  const visibleTabs = React.useMemo(() => {
    const counts = {
      overview: true,
      watching: groupedLists.watching.length,
      completed: groupedLists.completed.length,
      planned: groupedLists.planned.length,
      onhold: groupedLists.onhold.length,
      dropped: groupedLists.dropped.length,
    }

    return publicTabs.filter((tab) => tab.id === "overview" || counts[tab.id] > 0)
  }, [groupedLists])

  React.useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("overview")
    }
  }, [activeTab, visibleTabs])

  const stats = React.useMemo(() => {
    const watchingCount = entries.filter((entry) => entry.status === "watching" || entry.status === "rewatching").length
    const completedCount = entries.filter((entry) => entry.status === "completed").length
    const onHoldCount = entries.filter((entry) => entry.status === "on_hold").length
    const droppedCount = entries.filter((entry) => entry.status === "dropped").length
    const plannedCount = entries.filter((entry) => entry.status === "plan_to_watch").length
    const rewatches = entries.filter((entry) => entry.status === "rewatching").length
    const totalEpisodes = entries.reduce(
      (sum, entry) => sum + (entry.media_type === "ANIME" ? getEntryDisplayProgress(entry) : 0),
      0,
    )
    const scoreValues = entries.map((entry) => normalizeEntryScore(entry?.score)).filter((score) => score !== null)
    const meanScore = scoreValues.length
      ? Number((scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length).toFixed(1))
      : 0

    const daysSet = new Set()
    entries.forEach((entry) => {
      const raw = entry?.status === "completed"
        ? entry?.finished_at || entry?.created_at || entry?.updated_at
        : entry?.created_at || entry?.updated_at
      if (!raw) return
      const date = new Date(raw)
      if (Number.isNaN(date.getTime())) return
      daysSet.add(date.toISOString().slice(0, 10))
    })

    const sortedDays = Array.from(daysSet).sort()
    let currentStreak = 0
    let longestStreak = 0
    let cursor = new Date()
    while (true) {
      const key = cursor.toISOString().slice(0, 10)
      if (!daysSet.has(key)) break
      currentStreak += 1
      cursor.setDate(cursor.getDate() - 1)
    }

    let streak = 0
    let previousTime = 0
    sortedDays.forEach((day, index) => {
      const time = new Date(day).getTime()
      if (index === 0 || time - previousTime === 86400000) streak += 1
      else streak = 1
      previousTime = time
      if (streak > longestStreak) longestStreak = streak
    })

    const totalProgress = entries.reduce((sum, entry) => sum + getEntryDisplayProgress(entry), 0)

    return {
      watching: watchingCount,
      completed: completedCount,
      onHold: onHoldCount,
      dropped: droppedCount,
      planToWatch: plannedCount,
      totalTitles: entries.length,
      totalEpisodes,
      totalProgress,
      daysWatched: Number((Math.round((totalEpisodes * 24) / 60) / 24).toFixed(1)),
      meanScore,
      currentStreak,
      longestStreak,
      rewatches,
    }
  }, [entries])

  // Only the user's real saved favorites (max 4 shown).
  const overviewFavorites = React.useMemo(
    () => favoriteEntries.filter((entry) => entry?.media).slice(0, 4),
    [favoriteEntries],
  )

  const recentActivity = React.useMemo(() => {
    // Use the most meaningful timestamp per status — updated_at is unreliable
    // because the DB trigger bumps it on every import write, even for rows that
    // didn't change.
    const activityTs = (entry) => {
      const value = entry?.status === "completed"
        ? entry?.finished_at || entry?.created_at || entry?.updated_at
        : entry?.created_at || entry?.updated_at
      return value ? new Date(value).getTime() : 0
    }

    return [...entries]
      .sort((left, right) => activityTs(right) - activityTs(left))
      .slice(0, 4)
      .map((entry) => {
        const ts = entry?.status === "completed"
          ? entry?.finished_at || entry?.created_at || entry?.updated_at
          : entry?.created_at || entry?.updated_at
        return {
          id: entry.id,
          anime: getMediaTitle(entry?.media),
          action: buildActivityText(entry),
          time: formatRelativeTime(ts),
          image: entry?.media?.coverImage?.large || entry?.media?.coverImage?.extraLarge || "",
          href: entry?.media ? getMediaHref(entry.media) : `/media/${entry.media_id}`,
        }
      })
  }, [entries])

  const userData = React.useMemo(() => {
    const displayName = profile?.display_name || handle || "User"
    const username = profile?.handle || handle || "user"

    return {
      name: displayName,
      username,
      avatar: profile?.avatar_url || "",
      banner: profile?.banner_url || getBannerFallback(entries),
      bio: profile?.bio || "",
      location: profile?.location || "",
      website: profile?.website || "",
      joinedDate: formatJoinedDate(profile?.joined_at || profile?.created_at),
      isPremium: Boolean(profile?.is_premium),
      level: Number(profile?.level || 1),
      privacy: {
        showStats: profile?.show_stats !== false,
        showActivity: profile?.show_watch_activity !== false,
        showFavorites: profile?.show_favorites !== false && overviewFavorites.length > 0,
      },
      stats,
      favorites: overviewFavorites,
      lists: groupedLists,
      recentActivity,
    }
  }, [entries, groupedLists, handle, overviewFavorites, profile, recentActivity, stats])

  const getListCount = React.useCallback(
    (listId) => {
      switch (listId) {
        case "watching":
          return userData.lists.watching.length
        case "completed":
          return userData.lists.completed.length
        case "planned":
          return userData.lists.planned.length
        case "onhold":
          return userData.lists.onhold.length
        case "dropped":
          return userData.lists.dropped.length
        default:
          return 0
      }
    },
    [userData],
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-28">
          <div className="h-72 animate-pulse rounded-3xl border border-border/50 bg-card/40" />
          <div className="-mt-20 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="h-56 animate-pulse rounded-3xl border border-border/50 bg-card/40" />
            <div className="h-56 animate-pulse rounded-3xl border border-border/50 bg-card/40" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
          <div className="w-full rounded-3xl border border-border/50 bg-card/40 p-10 text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-primary">Unavailable</p>
            <h1 className="text-3xl font-black text-foreground">This public profile could not be loaded</h1>
            <p className="mt-3 text-muted-foreground">
              The share page opened, but Hikari could not find a public profile for this user.
            </p>
            <Button asChild className="mt-6 rounded-xl bg-primary hover:bg-primary/90">
              <Link href="/">Go Home</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background" data-profile-build={PUBLIC_PROFILE_BUILD}>
      <header className="fixed left-0 right-0 top-0 z-50 h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="bg-gradient-to-r from-primary to-accent bg-clip-text text-xl font-black text-transparent">
            Hikari
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" className="rounded-xl bg-primary hover:bg-primary/90" asChild>
              <Link href="/register">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="relative h-56 overflow-hidden pt-16 sm:h-72 md:h-80">
        {userData.banner ? (
          <img src={userData.banner} alt={`${userData.name} banner`} className="h-full w-full object-cover" />
        ) : (
          <ImageFallback title={userData.name} className="h-full w-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60" />
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <div className="relative -mt-24 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-6"
          >
            <div className="flex flex-1 flex-col gap-6 sm:flex-row sm:items-start">
              <div className="relative">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary via-accent to-primary opacity-60 blur" />
                <div className="relative h-36 w-36 overflow-hidden rounded-2xl border-4 border-background bg-muted shadow-2xl sm:h-44 sm:w-44">
                  {userData.avatar ? (
                    <img src={userData.avatar} alt={userData.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-5xl font-black text-muted-foreground">
                      {userData.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {userData.isPremium ? (
                  <div className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                ) : null}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-1.5 shadow-lg">
                  <span className="text-sm font-bold text-white">Lvl {userData.level}</span>
                </div>
              </div>

              <div className="flex-1 pt-4 sm:pt-8">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-black text-foreground sm:text-4xl">{userData.name}</h1>
                  {userData.isPremium ? (
                    <Badge className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 text-white">
                      <Sparkles className="mr-1 h-3 w-3" />
                      Premium
                    </Badge>
                  ) : null}
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <p className="text-lg text-muted-foreground">@{userData.username}</p>
                  {canFollow ? (
                    <Button
                      size="sm"
                      variant={isFollowing ? "outline" : "default"}
                      disabled={followBusy}
                      onClick={handleToggleFollow}
                      className="rounded-full"
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {userData.location ? (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" />
                      {userData.location}
                    </span>
                  ) : null}

                  {userData.joinedDate ? (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-primary" />
                      Joined {userData.joinedDate}
                    </span>
                  ) : null}

                  {userData.website ? (
                    <a
                      href={userData.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-accent hover:underline"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Website
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>

                {userData.privacy.showStats ? (
                  <div className="mt-5 flex flex-wrap gap-2.5 xl:flex-nowrap">
                  {[
                    { label: "Completed", value: userData.stats.completed, icon: CheckCircle, color: "text-emerald-400" },
                    { label: "Watched", value: userData.stats.daysWatched, icon: Clock, color: "text-cyan-400" },
                    { label: "Streak", value: userData.stats.currentStreak, icon: Flame, color: "text-orange-400" },
                    { label: "Score", value: userData.stats.meanScore || "0.0", icon: Star, color: "text-amber-400" },
                  ].map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.92 }}
                      transition={{ duration: 0.35, delay: 0.08 + index * 0.05 }}
                      className="min-w-[118px] rounded-2xl bg-card/55 px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-sm transition-all hover:bg-card/70"
                    >
                      <div className="flex items-center gap-2.5">
                        <stat.icon className={cn("h-[18px] w-[18px] shrink-0", stat.color)} />
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">{stat.label}</p>
                          <p className="mt-0.5 text-xl font-bold leading-none text-foreground">{stat.value}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>

          {userData.bio ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: isLoaded ? 1 : 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
              className="selectable mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground"
            >
              {userData.bio}
            </motion.p>
          ) : null}
        </div>

        <div className="sticky top-16 z-30 -mx-4 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
          <nav className="scrollbar-hide flex gap-1 overflow-x-auto py-1">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              const count = tab.id !== "overview" ? getListCount(tab.id) : null

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex items-center gap-2 whitespace-nowrap rounded-t-xl px-5 py-4 text-sm font-medium transition-all",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {count !== null ? (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{count}</span>
                  ) : null}
                  {isActive ? (
                    <motion.div
                      layoutId="public-profile-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-accent"
                      transition={{ type: "spring", duration: 0.5 }}
                    />
                  ) : null}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="py-8">
          <AnimatePresence mode="wait">
            {activeTab === "overview" ? (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 gap-8 lg:grid-cols-3"
              >
                <div className="space-y-6 lg:col-span-2">
                  {userData.privacy.showActivity ? (
                    <div className="rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
                      <h2 className="mb-6 flex items-center gap-3 text-xl font-bold">
                        <Clock className="h-5 w-5 text-primary" />
                        Recent Activity
                      </h2>

                      {userData.recentActivity.length ? (
                        <div className="space-y-4">
                          {userData.recentActivity.map((activity, index) => (
                            <motion.div
                              key={activity.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.25, delay: index * 0.08 }}
                            >
                              <Link
                                href={activity.href}
                                className="flex items-center gap-4 rounded-xl bg-muted/30 p-4 transition-colors hover:bg-muted/45"
                              >
                                <div className="relative h-20 w-14 overflow-hidden rounded-xl bg-muted/40">
                                  <MediaThumb src={activity.image} alt={activity.anime} className="h-full w-full" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="line-clamp-1 font-semibold text-foreground">{activity.anime}</h3>
                                  <p className="mt-1 text-sm text-muted-foreground">{activity.action}</p>
                                  <p className="mt-1 text-xs text-muted-foreground/60">{activity.time}</p>
                                </div>
                              </Link>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState message="Recent activity is hidden or empty right now." />
                      )}
                    </div>
                  ) : null}

                  {userData.privacy.showStats ? (
                    <div className="rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
                      <h2 className="mb-6 flex items-center gap-3 text-xl font-bold">
                        <BarChart3 className="h-5 w-5 text-purple-500" />
                        Anime Stats
                      </h2>

                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                        {[
                          { label: "Watching", value: userData.stats.watching, color: "bg-blue-500" },
                          { label: "Completed", value: userData.stats.completed, color: "bg-green-500" },
                          { label: "Planned", value: userData.stats.planToWatch, color: "bg-purple-500" },
                          { label: "On Hold", value: userData.stats.onHold, color: "bg-amber-500" },
                          { label: "Dropped", value: userData.stats.dropped, color: "bg-red-500" },
                        ].map((stat) => (
                          <div key={stat.label} className="rounded-xl bg-muted/30 p-4 text-center">
                            <div className={cn("mx-auto mb-2 h-3 w-3 rounded-full", stat.color)} />
                            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-6">
                  {userData.privacy.showFavorites ? (
                    <div className="rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
                      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                        <Heart className="h-5 w-5 text-red-500" />
                        Favorites
                      </h2>

                      {userData.favorites.length ? (
                        <div className="grid grid-cols-2 gap-3">
                          {userData.favorites.map((entry) => {
                            const title = getMediaTitle(entry?.media)
                            const href = entry?.media ? getMediaHref(entry.media) : `/media/${entry.media_id}`
                            const cover = entry?.media?.coverImage?.large || entry?.media?.coverImage?.extraLarge || ""
                            const score = formatEntryScore(entry?.score)

                            return (
                              <Link key={entry.id} href={href} className="group">
                                <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted">
                                  <MediaThumb
                                    src={cover}
                                    alt={title}
                                    className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                                  <div className="absolute bottom-0 left-0 right-0 p-2">
                                    <p className="line-clamp-2 text-xs font-medium text-white">{title}</p>
                                    {score ? (
                                      <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-black/35 px-2 py-1 text-[11px] font-semibold text-white">
                                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                        {score}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </Link>
                            )
                          })}
                        </div>
                      ) : (
                        <EmptyState message="No public favorites yet." />
                      )}
                    </div>
                  ) : null}

                  {userData.privacy.showStats ? (
                    <div className="rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
                      <h2 className="mb-4 text-lg font-bold">Public Summary</h2>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Titles</span>
                          <span className="font-bold">{formatCompactNumber(userData.stats.totalTitles)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-bold">{formatCompactNumber(userData.stats.totalProgress)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Est. Hours</span>
                          <span className="font-bold">{formatCompactNumber(Math.round(userData.stats.daysWatched * 24))}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Avg Score</span>
                          <span className="flex items-center gap-1 font-bold">
                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                            {userData.stats.meanScore || "0.0"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <MediaListView
                  listType={activeTab}
                  items={
                    activeTab === "watching"
                      ? userData.lists.watching
                      : activeTab === "completed"
                        ? userData.lists.completed
                        : activeTab === "planned"
                          ? userData.lists.planned
                          : activeTab === "onhold"
                            ? userData.lists.onhold
                            : userData.lists.dropped
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
          transition={{ duration: 0.45, delay: 0.3 }}
          className="border-t border-border/50 py-12 text-center"
        >
          <p className="mb-4 text-muted-foreground">Track your anime journey with Hikari</p>
          <Button size="lg" className="rounded-xl bg-primary px-8 hover:bg-primary/90" asChild>
            <Link href="/register">Create Your Profile</Link>
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
