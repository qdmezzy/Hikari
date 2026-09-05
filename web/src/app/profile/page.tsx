"use client"

import * as React from "react"
import { Trophy, Zap, Star, Flame, Globe, Crown } from "lucide-react"
import { ProfileScreen } from "@/components/profile/ProfileScreen"
import useAuth from "@/hooks/useAuth"
import RequireAuth from "@/components/common/RequireAuth"
import client from "@/lib/client"
import { checkHandleAvailability, isHandleTakenError, normalizeHandle, syncPublicFavorites, upsertPublicProfile } from "@/lib/public-profile"
import { fetchAniListMediaByIds } from "@/lib/anilist"
import { useFoundingMe } from "@/hooks/useFoundingMe"

const normalizeEntryScore = (value: any) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return numeric > 10 ? Number((numeric / 10).toFixed(1)) : Number(numeric.toFixed(numeric % 1 === 0 ? 0 : 1))
}

const getJoinedAtValue = (user: any) =>
  user?.user_metadata?.joined_at ||
  user?.user_metadata?.joined_date ||
  user?.user_metadata?.member_since ||
  user?.created_at ||
  null

const getMediaTitle = (media: any) =>
  media?.title?.english || media?.title?.romaji || media?.title?.native || "Untitled"

const isMangaEntry = (entry: any) => entry?.media_type === "MANGA" || entry?.media?.type === "MANGA"

const getEntryTotalUnits = (entry: any) => {
  const episodeTotal = Number(entry?.media?.episodes || 0)
  const chapterTotal = Number(entry?.media?.chapters || 0)
  if (isMangaEntry(entry)) return chapterTotal || episodeTotal || 0
  return episodeTotal || chapterTotal || 0
}

const getEntryDisplayProgress = (entry: any) => {
  const progress = Number(entry?.progress || 0)
  const totalUnits = getEntryTotalUnits(entry)
  if (entry?.status === "completed" && totalUnits > 0) return totalUnits
  return progress
}

export default function ProfilePage() {
  const { user } = useAuth()
  const founding = useFoundingMe(user)
  const foundingNumber = founding.data?.member?.active ? founding.data.member.memberNumber : null
  const isMod = (user as any)?.app_metadata?.is_mod === true || (user as any)?.app_metadata?.isMod === true
  const [activeTab, setActiveTab] = React.useState("overview")
  const [entries, setEntries] = React.useState<any[]>([])
  const [entriesLoading, setEntriesLoading] = React.useState(true)
  const [favorites, setFavorites] = React.useState<any[]>([])
  const [favoritesLoading, setFavoritesLoading] = React.useState(true)
  const [customLists, setCustomLists] = React.useState<any[]>([])
  const [profileSharingReady, setProfileSharingReady] = React.useState(true)
  const [syncingPublicProfile, setSyncingPublicProfile] = React.useState(false)
  const [shareCopied, setShareCopied] = React.useState(false)
  
  // Profile editing lives in Settings; this page reads the saved preferences.
  const settings = {
    publicProfile: user?.user_metadata?.public_profile ?? profileSharingReady,
    showActivity: user?.user_metadata?.show_watch_activity ?? true,
  }

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || "User"
  const rawHandle =
    user?.user_metadata?.handle ||
    user?.user_metadata?.username ||
    (user?.email ? user.email.split("@")[0] : "user")
  const normalizedHandle = normalizeHandle(rawHandle) || "user"
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || ""
  const bannerUrl = user?.user_metadata?.banner_url || ""
  const bio = user?.user_metadata?.bio || ""
  const location = user?.user_metadata?.location || ""
  const website = user?.user_metadata?.website || ""
  const joinedDateValue = getJoinedAtValue(user)
  const joinedDate =
    joinedDateValue && !Number.isNaN(new Date(joinedDateValue).getTime())
      ? new Date(joinedDateValue).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : ""
  const level = Number(user?.user_metadata?.level || 1)
  const xp = Number(user?.user_metadata?.xp || 0)
  const xpToNext = Number(user?.user_metadata?.xp_to_next || 1000)
  const isPremium =
    Boolean(user?.user_metadata?.is_premium) ||
    (Array.isArray(user?.user_metadata?.badges) &&
      user.user_metadata.badges.some((badge: string) => String(badge || "").toLowerCase().includes("premium")))

  React.useEffect(() => {
    let active = true

    const loadEntries = async () => {
      if (!user) {
        setEntries([])
        setEntriesLoading(false)
        return
      }

      setEntriesLoading(true)
      const SELECT_FULL =
        "id, media_id, status, progress, score, media_type, updated_at, created_at, started_at, finished_at"
      const SELECT_FALLBACK = "id, media_id, status, progress, score, media_type, updated_at, created_at"

      let data: any[] | null = null
      let error: any = null
      ;({ data, error } = await client
        .from("list_entries")
        .select(SELECT_FULL)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }))

      // The started_at/finished_at columns may not be migrated yet — fall back
      // to the core columns instead of breaking the whole list.
      if (error && /started_at|finished_at|column/i.test(error.message || "")) {
        ;({ data, error } = await client
          .from("list_entries")
          .select(SELECT_FALLBACK)
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }))
      }

      if (!active) return

      if (error) {
        console.error("Failed to load profile entries:", error)
        setEntries([])
        setEntriesLoading(false)
        return
      }

      if (!data?.length) {
        setEntries([])
        setEntriesLoading(false)
        return
      }

      try {
        const mediaById = await fetchAniListMediaByIds(data.map((entry) => entry.media_id))
        if (!active) return
        setEntries(
          data.map((entry) => ({
            ...entry,
            media: mediaById.get(entry.media_id) || null,
          })),
        )
      } catch (loadError) {
        console.error("Failed to hydrate profile media:", loadError)
        if (!active) return
        setEntries(data.map((entry) => ({ ...entry, media: null })))
      } finally {
        if (active) setEntriesLoading(false)
      }
    }

    loadEntries()
    return () => {
      active = false
    }
  }, [user])

  React.useEffect(() => {
    let active = true

    const loadFavorites = async () => {
      const favoriteIds = Array.isArray(user?.user_metadata?.favorite_media_ids)
        ? user.user_metadata.favorite_media_ids
        : []
      const ids = Array.from(new Set(favoriteIds.map((value: unknown) => Number(value)).filter(Number.isFinite)))

      if (!ids.length) {
        setFavorites([])
        setFavoritesLoading(false)
        return
      }

      setFavoritesLoading(true)
      // Keep the public profile's favorites in sync for the shared /u/[handle] view.
      syncPublicFavorites(user)
      try {
        const mediaById = await fetchAniListMediaByIds(ids)
        if (!active) return
        setFavorites(ids.map((id) => mediaById.get(id)).filter(Boolean))
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

  React.useEffect(() => {
    let active = true

    const loadLists = async () => {
      if (!user) {
        setCustomLists([])
        return
      }

      const { data, error } = await client
        .from("custom_lists")
        .select("id, name, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (!active) return

      if (error) {
        console.error("Failed to load custom lists:", error)
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

  React.useEffect(() => {
    if (!user?.id || !normalizedHandle) return
    let active = true

    const syncPublicProfile = async () => {
      setSyncingPublicProfile(true)
      const { available, error: availabilityError } = await checkHandleAvailability(normalizedHandle, user.id)
      if (active && availabilityError) {
        console.error("Failed to validate handle:", availabilityError)
      }
      if (active && available === false) {
        setProfileSharingReady(false)
        setSyncingPublicProfile(false)
        return
      }

      const { error, skipped } = await upsertPublicProfile(user, {
        handle: normalizedHandle,
        show_online_status: true,
        show_watch_activity: settings.showActivity,
      })

      if (!active) return

      setProfileSharingReady(!skipped)
      if (error) {
        if (isHandleTakenError(error)) setProfileSharingReady(false)
        console.error("Failed to sync public profile:", error)
      }
      setSyncingPublicProfile(false)
    }

    syncPublicProfile()
    return () => {
      active = false
    }
  }, [user, normalizedHandle, settings.showActivity])

  const handleShareProfile = async () => {
    if (typeof window === "undefined") return
    if (!settings.publicProfile) {
      window.location.assign("/settings?section=profile")
      return
    }
    const ready = profileSharingReady || await ensurePublicProfileReady()
    if (!ready) return
    const shareUrl = `${window.location.origin}${publicProfileHref}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 1500)
    } catch (error) {
      window.prompt("Copy this profile link:", shareUrl)
    }
  }

  const stats = React.useMemo(() => {
    const watching = entries.filter((entry) => entry.status === "watching" || entry.status === "rewatching").length
    const completed = entries.filter((entry) => entry.status === "completed").length
    const onHold = entries.filter((entry) => entry.status === "on_hold").length
    const dropped = entries.filter((entry) => entry.status === "dropped").length
    const planToWatch = entries.filter((entry) => entry.status === "plan_to_watch").length
    const rewatches = entries.filter((entry) => entry.status === "rewatching").length
    const totalEpisodes = entries.reduce((sum, entry) => sum + (entry.media_type === "ANIME" ? getEntryDisplayProgress(entry) : 0), 0)
    const scoreValues = entries
      .map((entry) => normalizeEntryScore(entry?.score))
      .filter((score): score is number => score !== null)
    const meanScore = scoreValues.length ? Number((scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length).toFixed(1)) : 0

    const daysSet = new Set<string>()
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

    return {
      watching,
      completed,
      onHold,
      dropped,
      planToWatch,
      totalEpisodes,
      daysWatched: Number(((Math.round((totalEpisodes * 24) / 60)) / 24).toFixed(1)),
      meanScore,
      currentStreak,
      longestStreak,
      rewatches,
    }
  }, [entries])

  const favoriteScoreByMediaId = React.useMemo(() => {
    const scores = new Map<number, number>()
    entries.forEach((entry) => {
      const mediaId = Number(entry?.media_id)
      const score = normalizeEntryScore(entry?.score)
      if (Number.isFinite(mediaId) && score !== null) {
        scores.set(mediaId, score)
      }
    })
    return scores
  }, [entries])

  const topGenres = React.useMemo(() => {
    const counts = new Map<string, number>()
    entries.forEach((entry) => {
      ;(entry?.media?.genres || []).forEach((genre: string) => {
        counts.set(genre, (counts.get(genre) || 0) + 1)
      })
    })
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6)
  }, [entries])

  const recentActivity = React.useMemo(() => {
    // Mirror the lists page detailText logic EXACTLY:
    //   completed  → finished_at
    //   watching   → updated_at
    //   planned/on_hold/dropped → created_at (lists page shows "Added" for these)
    const activityTs = (entry: any) => {
      const value =
        entry?.status === "completed"
          ? entry?.finished_at || entry?.updated_at
          : entry?.status === "watching" || entry?.status === "rewatching"
            ? entry?.updated_at || entry?.created_at
            : entry?.created_at || entry?.updated_at
      return value ? new Date(value).getTime() : 0
    }

    const toDateShort = (value: string | null | undefined) =>
      value
        ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
        : ""

    return entries
      .filter((entry) => entry?.media)
      .sort((left, right) => activityTs(right) - activityTs(left))
      .slice(0, 5)
      .map((entry) => {
        const ts =
          entry?.status === "completed"
            ? entry?.finished_at || entry?.updated_at
            : entry?.status === "watching" || entry?.status === "rewatching"
              ? entry?.updated_at || entry?.created_at
              : entry?.created_at || entry?.updated_at
        return {
          id: entry.media_id,
          manga: isMangaEntry(entry),
          anime: getMediaTitle(entry.media),
          episode: getEntryDisplayProgress(entry),
          status: entry.status,
          image: entry?.media?.coverImage?.large || "",
          score: normalizeEntryScore(entry?.score),
          time: toDateShort(ts),
        }
      })
  }, [entries])

  const achievementList = React.useMemo(() => {
    return [
      { name: "Century Club", desc: "Completed 100 anime", icon: Trophy, color: "text-amber-500", unlocked: stats.completed >= 100 },
      { name: "Binge Master", desc: "Logged 500 episodes", icon: Zap, color: "text-purple-500", unlocked: stats.totalEpisodes >= 500 },
      { name: "Critic", desc: "Maintain an 8.0+ score", icon: Star, color: "text-yellow-500", unlocked: stats.meanScore >= 8 },
      { name: "Dedicated", desc: "7 day streak", icon: Flame, color: "text-orange-500", unlocked: stats.currentStreak >= 7 },
      { name: "Explorer", desc: "Watch anime from 5 genres", icon: Globe, color: "text-blue-500", unlocked: topGenres.length >= 5 },
      { name: "Elite", desc: "Reach level 50", icon: Crown, color: "text-gray-400", unlocked: level >= 50 },
    ]
  }, [stats, topGenres.length, level])

  const profileData = React.useMemo(() => ({
    name: displayName,
    username: normalizedHandle,
    avatar: avatarUrl,
    banner: bannerUrl,
    bio,
    location,
    website,
    joinedDate,
    isPremium,
    level,
    xp,
    xpToNext,
    stats,
    recentActivity,
    favorites: favorites.slice(0, 4).map((fav) => ({
      id: fav?.id,
      title: getMediaTitle(fav),
      image: fav?.coverImage?.large || "",
      score: favoriteScoreByMediaId.get(Number(fav?.id)) || null,
    })),
    achievements: achievementList,
  }), [
    displayName,
    normalizedHandle,
    avatarUrl,
    bannerUrl,
    bio,
    location,
    website,
    joinedDate,
    isPremium,
    level,
    xp,
    xpToNext,
    stats,
    recentActivity,
    favorites,
    favoriteScoreByMediaId,
    achievementList,
  ])

  const xpPercentage = profileData.xpToNext > 0 ? (profileData.xp / profileData.xpToNext) * 100 : 0
  const publicProfileHref = `/u/${encodeURIComponent(normalizedHandle || "user")}`

  const ensurePublicProfileReady = React.useCallback(async () => {
    if (!user || !normalizedHandle) return false

    setSyncingPublicProfile(true)
    const { error, skipped } = await upsertPublicProfile(user, {
      handle: normalizedHandle,
      show_online_status: true,
      show_watch_activity: settings.showActivity,
    })

    const ready = !error && !skipped
    setProfileSharingReady(ready)
    if (error) console.error("Failed to prepare public profile:", error)
    setSyncingPublicProfile(false)
    return ready
  }, [normalizedHandle, settings.showActivity, user])

  const handleOpenPublicView = React.useCallback(async () => {
    if (typeof window === "undefined") return
    const ready = await ensurePublicProfileReady()
    if (!ready) return
    window.location.assign(publicProfileHref)
  }, [ensurePublicProfileReady, publicProfileHref])

  return <RequireAuth><ProfileScreen model={{
    profile: profileData, foundingNumber, activeTab, setActiveTab, entriesLoading, favoritesLoading,
    topGenres, customLists, xpPercentage, syncing: syncingPublicProfile, copied: shareCopied,
    sharingReady: profileSharingReady, onShare: handleShareProfile, onPublicView: handleOpenPublicView,
    showWrapped: isMod && process.env.NEXT_PUBLIC_ENABLE_WRAPPED === "true",
  }}/></RequireAuth>
}
