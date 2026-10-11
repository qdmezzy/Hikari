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
import { FoundingBadge } from "@/components/founding/FoundingBadge"
import { FoundingName } from "@/components/founding/FoundingName"
import { Navigation } from "@/components/layout/Navigation"
import { PublicProfileScreen } from "./PublicProfileScreen"
import "./public-profile.css"

const publicTabs = [
  { id: "overview", label: "Overview" },
  { id: "library", label: "Library" },
  { id: "stats", label: "Statistics" },
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

// Relative for recent activity, but a real date once it's old (so it reads
// "Jan 3, 2024" instead of an unhelpful "21mo ago").
const formatSmartTime = (value) => {
  if (!value) return ""
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return ""
  const days = (Date.now() - timestamp) / 86400000
  if (days < 30) return formatRelativeTime(value)
  return new Date(timestamp).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
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
  const total = getTotalUnits(entry)
  // Completed entries always read as fully watched/read, never partial.
  const progress = getEntryDisplayProgress(entry)

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
  // Mirror the lists page: completed→finished_at, watching→updated_at, else→created_at
  const raw =
    listType === "completed"
      ? entry?.finished_at || entry?.updated_at
      : listType === "watching"
        ? entry?.updated_at || entry?.created_at
        : entry?.created_at || entry?.updated_at
  const when = formatSmartTime(raw)
  if (!when) return ""

  switch (listType) {
    case "watching":
      return `Last watched ${when}`
    case "completed":
      return `Completed ${when}`
    case "planned":
      return `Added ${when}`
    case "onhold":
      return `Paused ${when}`
    case "dropped":
      return `Dropped ${when}`
    default:
      return when
  }
}

const getListItems = (entries) => {
  const ts = (value) => (value ? new Date(value).getTime() : 0)

  // Per-status sort timestamp — must match the date shown for each list type
  // (otherwise entries would appear out of order relative to their labels).
  const sortTs = (entry, listType) => {
    if (listType === "completed") return ts(entry?.finished_at || entry?.updated_at)
    if (listType === "watching") return ts(entry?.updated_at || entry?.created_at)
    return ts(entry?.created_at || entry?.updated_at)
  }

  const watching = entries.filter((entry) => ["watching", "rewatching"].includes(entry?.status))
  const completed = entries.filter((entry) => entry?.status === "completed")
  const planned = entries.filter((entry) => entry?.status === "plan_to_watch")
  const onhold = entries.filter((entry) => entry?.status === "on_hold")
  const dropped = entries.filter((entry) => entry?.status === "dropped")

  // Plan to Watch: oldest added first.
  planned.sort((a, b) => ts(a.created_at) - ts(b.created_at))
  // All others: most recent first (based on the date each list type displays).
  completed.sort((a, b) => sortTs(b, "completed") - sortTs(a, "completed"))
  watching.sort((a, b) => sortTs(b, "watching") - sortTs(a, "watching"))
  onhold.sort((a, b) => sortTs(b, "onhold") - sortTs(a, "onhold"))
  dropped.sort((a, b) => sortTs(b, "dropped") - sortTs(a, "dropped"))

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

      const { data: profileData, error: profileError, state: profileState } = await fetchPublicProfileByHandle(handle)
      if (!active) return

      if (profileError || !profileData?.user_id) {
        setProfile(null)
        setEntries([])
        setError(profileState === "private" ? "private" : profileState === "missing" ? "missing" : "unavailable")
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

  const visibleTabs = publicTabs

  React.useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("overview")
    }
  }, [activeTab, visibleTabs])

  const stats = React.useMemo(() => {
    if (profile?.show_watch_activity === false && profile?.shared_stats) return profile.shared_stats
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
      // Mirror lists page: completed→finished_at, watching→updated_at, else→created_at
      const raw =
        entry?.status === "completed"
          ? entry?.finished_at || entry?.updated_at
          : entry?.status === "watching" || entry?.status === "rewatching"
            ? entry?.updated_at || entry?.created_at
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
  }, [entries, profile])

  // Only the user's real saved favorites (max 4 shown).
  const overviewFavorites = React.useMemo(
    () => favoriteEntries.filter((entry) => entry?.media).slice(0, 4),
    [favoriteEntries],
  )

  const recentActivity = React.useMemo(() => {
    // Mirror the lists page detailText logic EXACTLY:
    //   completed  → finished_at
    //   watching   → updated_at
    //   planned/on_hold/dropped → created_at
    const activityTs = (entry) => {
      const value =
        entry?.status === "completed"
          ? entry?.finished_at || entry?.updated_at
          : entry?.status === "watching" || entry?.status === "rewatching"
            ? entry?.updated_at || entry?.created_at
            : entry?.created_at || entry?.updated_at
      return value ? new Date(value).getTime() : 0
    }

    const toDateShort = (value) =>
      value
        ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
        : ""

    return [...entries]
      .sort((left, right) => activityTs(right) - activityTs(left))
      .slice(0, 4)
      .map((entry) => {
        const ts =
          entry?.status === "completed"
            ? entry?.finished_at || entry?.updated_at
            : entry?.status === "watching" || entry?.status === "rewatching"
              ? entry?.updated_at || entry?.created_at
              : entry?.created_at || entry?.updated_at
        return {
          id: entry.id,
          anime: getMediaTitle(entry?.media),
          action: buildActivityText(entry),
          time: toDateShort(ts),
          image: entry?.media?.coverImage?.large || entry?.media?.coverImage?.extraLarge || "",
          href: entry?.media ? getMediaHref(entry.media) : `/media/${entry.media_id}`,
        }
      })
  }, [entries])

  const userData = React.useMemo(() => {
    const displayName = profile?.display_name || handle || "User"
    const username = profile?.handle || handle || "user"

    return {
      userId: profile?.user_id || null,
      name: displayName,
      username,
      avatar: profile?.avatar_url || "",
      banner: profile?.banner_url || profile?.avatar_url || "",
      bio: profile?.bio || "",
      location: profile?.location || "",
      website: profile?.website || "",
      joinedDate: formatJoinedDate(profile?.joined_at || profile?.created_at),
      isPremium: Boolean(profile?.is_premium),
      foundingMemberNumber: Number(profile?.founding_member_number || 0) || null,
      level: Number(profile?.level || 1),
      privacy: {
        showStats: profile?.show_stats !== false,
        showActivity: profile?.show_watch_activity !== false,
        showFavorites: profile?.show_favorites !== false,
      },
      stats,
      favorites: overviewFavorites,
      lists: groupedLists,
      recentActivity,
    }
  }, [entries, groupedLists, handle, overviewFavorites, profile, recentActivity, stats])


  if (loading) {
    return (
      <div className="hikari-profile min-h-screen bg-background">
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
    const privateProfile = error === "private"
    const missingProfile = error === "missing"
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
          <div className="w-full rounded-3xl border border-border/50 bg-card/40 p-10 text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              {privateProfile ? "Private profile" : missingProfile ? "Profile not found" : "Unavailable"}
            </p>
            <h1 className="text-3xl font-black text-foreground">
              {privateProfile
                ? "This profile is private"
                : missingProfile
                  ? `@${handle || "user"} does not have a public profile yet`
                  : "This public profile could not be loaded"}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {privateProfile
                ? "The owner has chosen not to share their profile. Hikari does not expose their lists or personal details."
                : missingProfile
                  ? "Check the handle, or ask them to sign in once so Hikari can finish creating their profile."
                  : "Hikari could not reach the profile service. Please try again in a moment."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild className="rounded-xl bg-primary hover:bg-primary/90">
                <Link href="/search">Browse anime</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/">Go home</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <PublicProfileScreen userData={userData} authUser={authUser} canFollow={canFollow} followBusy={followBusy} isFollowing={isFollowing} onFollow={handleToggleFollow} activeTab={activeTab} setActiveTab={setActiveTab} MediaListView={MediaListView} />
}
