"use client"

import * as React from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { 
  User, 
  Settings, 
  BarChart3, 
  Heart, 
  List,
  Calendar,
  MapPin,
  Link as LinkIcon,
  Edit3,
  Camera,
  Clock,
  Trophy,
  Flame,
  Star,
  Play,
  CheckCircle,
  PauseCircle,
  XCircle,
  Eye,
  Bell,
  Shield,
  Palette,
  Globe,
  Sparkles,
  Crown,
  Zap,
  Award,
  TrendingUp,
  Share2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Header } from "@/components/layout/header"
import useAuth from "@/hooks/useAuth"
import RequireAuth from "@/components/common/RequireAuth"
import client from "@/lib/client"
import { checkHandleAvailability, isHandleTakenError, normalizeHandle, syncPublicFavorites, upsertPublicProfile } from "@/lib/public-profile"
import { fetchAniListMediaByIds } from "@/lib/anilist"

const tabs = [
  { id: "overview", label: "Overview", icon: User },
  { id: "lists", label: "My Lists", icon: List },
  { id: "stats", label: "Statistics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "preferences", label: "Preferences", icon: Palette },
]

const defaultPublicListVisibility = {
  watching: true,
  rewatching: true,
  completed: true,
  plan_to_watch: true,
  on_hold: true,
  dropped: true,
}

const publicListVisibilityOptions = [
  { id: "watching", label: "Watching / Reading", desc: "Show titles you are currently progressing through." },
  { id: "completed", label: "Completed / Read", desc: "Show finished titles in your public library." },
  { id: "plan_to_watch", label: "Planned", desc: "Show titles you plan to watch or read later." },
  { id: "on_hold", label: "On Hold", desc: "Show titles you paused for now." },
  { id: "dropped", label: "Dropped", desc: "Show titles you stopped." },
  { id: "rewatching", label: "Rewatching / Rereading", desc: "Show titles you are revisiting." },
]

const normalizePublicListVisibility = (value: unknown) => {
  const next = { ...defaultPublicListVisibility }
  if (!value || typeof value !== "object") return next
  Object.keys(next).forEach((key) => {
    const typedKey = key as keyof typeof defaultPublicListVisibility
    if (typeof (value as Record<string, unknown>)[typedKey] === "boolean") {
      next[typedKey] = Boolean((value as Record<string, unknown>)[typedKey])
    }
  })
  return next
}

const isHideFromProfileSchemaError = (error: any) => {
  const code = String(error?.code || "")
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase()
  return code === "42703" || code === "PGRST204" || text.includes("hide_from_profile")
}

const formatRelativeTime = (value: string | Date | null | undefined) => {
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

const formatCompactNumber = (value: number | string | null | undefined) => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return "0"
  if (numeric >= 1000000) return `${(numeric / 1000000).toFixed(numeric >= 10000000 ? 0 : 1)}M`
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(numeric >= 10000 ? 0 : 1)}K`
  return numeric.toString()
}

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
  const [activeTab, setActiveTab] = React.useState("overview")
  const [isLoaded, setIsLoaded] = React.useState(false)
  const [entries, setEntries] = React.useState<any[]>([])
  const [entriesLoading, setEntriesLoading] = React.useState(true)
  const [favorites, setFavorites] = React.useState<any[]>([])
  const [favoritesLoading, setFavoritesLoading] = React.useState(true)
  const [customLists, setCustomLists] = React.useState<any[]>([])
  const [profileSharingReady, setProfileSharingReady] = React.useState(true)
  const [syncingPublicProfile, setSyncingPublicProfile] = React.useState(false)
  const [shareCopied, setShareCopied] = React.useState(false)
  const [savingPrivacy, setSavingPrivacy] = React.useState(false)
  
  // Settings state
  const [settings, setSettings] = React.useState({
    displayName: "",
    username: "",
    bio: "",
    location: "",
    website: "",
    emailNotifications: true,
    pushNotifications: false,
    publicProfile: true,
    showActivity: true,
    showStats: true,
    adultContent: false,
    theme: "system",
    language: "en",
    scoreFormat: "10point",
    publicListVisibility: { ...defaultPublicListVisibility },
  })

  React.useEffect(() => {
    setIsLoaded(true)
  }, [])
  
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
    setSettings((current) => ({
      ...current,
      displayName,
      username: normalizedHandle,
      bio,
      location,
      website,
      publicProfile: profileSharingReady,
      showActivity: user?.user_metadata?.show_watch_activity ?? true,
      showStats: true,
      adultContent: user?.user_metadata?.adult_content ?? false,
      theme: user?.user_metadata?.theme || current.theme,
      language: user?.user_metadata?.language || current.language,
      scoreFormat: user?.user_metadata?.score_format || current.scoreFormat,
      publicListVisibility: normalizePublicListVisibility(user?.user_metadata?.public_list_visibility),
      emailNotifications: user?.user_metadata?.email_notifications ?? current.emailNotifications,
      pushNotifications: user?.user_metadata?.push_notifications ?? current.pushNotifications,
    }))
  }, [
    displayName,
    normalizedHandle,
    bio,
    location,
    website,
    profileSharingReady,
    user?.user_metadata?.show_watch_activity,
    user?.user_metadata?.adult_content,
    user?.user_metadata?.theme,
    user?.user_metadata?.language,
    user?.user_metadata?.score_format,
    user?.user_metadata?.public_list_visibility,
    user?.user_metadata?.email_notifications,
    user?.user_metadata?.push_notifications,
  ])

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

  const updateMetadata = React.useCallback(async (patch: Record<string, unknown>) => {
    if (!user) return { error: new Error("Missing user") }
    const { error } = await client.auth.updateUser({
      data: {
        ...user.user_metadata,
        ...patch,
      },
    })
    if (error) console.error("Failed to update profile metadata:", error)
    return { error }
  }, [user])

  const applyPublicListVisibility = React.useCallback(async (visibility: typeof defaultPublicListVisibility) => {
    if (!user?.id) return { error: new Error("Missing user") }

    let missingSchema = false
    let firstError: any = null

    for (const [status, isVisible] of Object.entries(visibility)) {
      const { error } = await client
        .from("list_entries")
        .update({ hide_from_profile: !isVisible })
        .eq("user_id", user.id)
        .eq("status", status)

      if (error) {
        if (isHideFromProfileSchemaError(error)) {
          missingSchema = true
          break
        }
        if (!firstError) firstError = error
      }
    }

    if (missingSchema) {
      console.warn("hide_from_profile column is unavailable; skipping status visibility sync.")
      return { error: null, skipped: true }
    }

    if (firstError) {
      console.error("Failed to sync public list visibility:", firstError)
      return { error: firstError }
    }

    setEntries((current) =>
      current.map((entry) =>
        Object.prototype.hasOwnProperty.call(visibility, entry.status)
          ? { ...entry, hide_from_profile: !visibility[entry.status as keyof typeof defaultPublicListVisibility] }
          : entry,
      ),
    )

    return { error: null }
  }, [user])

  const handleSaveProfile = async () => {
    const nextHandle = normalizeHandle(settings.username || normalizedHandle) || normalizedHandle
    const { error } = await updateMetadata({
      display_name: settings.displayName.trim() || displayName,
      username: nextHandle,
      handle: nextHandle,
      bio: settings.bio.trim(),
      location: settings.location.trim(),
      website: settings.website.trim(),
    })
    if (!error && user) {
      const { error: profileError, skipped } = await upsertPublicProfile(user, {
        handle: nextHandle,
        show_online_status: true,
        show_watch_activity: settings.showActivity,
      })
      setProfileSharingReady(!skipped)
      if (profileError) console.error("Failed to sync profile after save:", profileError)
    }
  }

  const handleSavePreferences = async () => {
    await updateMetadata({
      email_notifications: settings.emailNotifications,
      push_notifications: settings.pushNotifications,
      adult_content: settings.adultContent,
      theme: settings.theme,
      language: settings.language,
      score_format: settings.scoreFormat,
      show_watch_activity: settings.showActivity,
    })
  }

  const handleSavePrivacy = async () => {
    const visibility = normalizePublicListVisibility(settings.publicListVisibility)
    setSavingPrivacy(true)

    const { error } = await updateMetadata({
      show_watch_activity: settings.showActivity,
      show_stats: settings.showStats,
      public_profile: settings.publicProfile,
      public_list_visibility: visibility,
    })

    if (!error) {
      await applyPublicListVisibility(visibility)
      if (user) {
        const { error: profileError, skipped } = await upsertPublicProfile(user, {
          handle: normalizedHandle,
          show_online_status: true,
          show_watch_activity: settings.showActivity,
        })
        setProfileSharingReady(!skipped)
        if (profileError) console.error("Failed to sync privacy settings:", profileError)
      }
    }

    setSavingPrivacy(false)
  }

  const handleShareProfile = async () => {
    if (typeof window === "undefined") return
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
      // Match the lists page: completed→finished_at, planned→created_at, else→updated_at
      const raw =
        entry?.status === "completed"
          ? entry?.finished_at || entry?.updated_at
          : entry?.status === "plan_to_watch"
            ? entry?.created_at || entry?.updated_at
            : entry?.updated_at || entry?.created_at
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

  const monthlyStats = React.useMemo(() => {
    const now = new Date()
    const monthEntries = entries.filter((entry) => {
      const raw =
        entry?.status === "completed"
          ? entry?.finished_at || entry?.updated_at
          : entry?.status === "plan_to_watch"
            ? entry?.created_at || entry?.updated_at
            : entry?.updated_at || entry?.created_at
      const refDate = new Date(raw)
      return !Number.isNaN(refDate.getTime()) &&
        refDate.getMonth() === now.getMonth() &&
        refDate.getFullYear() === now.getFullYear()
    })

    const completed = monthEntries.filter((entry) => entry.status === "completed").length
    const episodes = monthEntries.reduce(
      (sum, entry) => sum + (entry.media_type === "ANIME" ? getEntryDisplayProgress(entry) : 0),
      0,
    )
    const scoreValues = monthEntries
      .map((entry) => normalizeEntryScore(entry?.score))
      .filter((score): score is number => score !== null)
    const meanScore = scoreValues.length
      ? Number((scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length).toFixed(1))
      : 0

    return {
      completed,
      episodes,
      daysWatched: Number((Math.round((episodes * 24) / 60) / 24).toFixed(1)),
      meanScore,
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
    // Match the lists page exactly:
    //   completed → finished_at,  watching → updated_at,  planned → created_at
    const activityTs = (entry: any) => {
      const value =
        entry?.status === "completed"
          ? entry?.finished_at || entry?.updated_at
          : entry?.status === "plan_to_watch"
            ? entry?.created_at || entry?.updated_at
            : entry?.updated_at || entry?.created_at
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
            : entry?.status === "plan_to_watch"
              ? entry?.created_at || entry?.updated_at
              : entry?.updated_at || entry?.created_at
        return {
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

  const mockUser = React.useMemo(() => ({
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

  const xpPercentage = mockUser.xpToNext > 0 ? (mockUser.xp / mockUser.xpToNext) * 100 : 0
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

  return (
    <RequireAuth>
    <div className="min-h-screen bg-background">
      <Header user={{ name: mockUser.name, avatar: mockUser.avatar, username: mockUser.username, isPremium: mockUser.isPremium }} />
      
      {/* Banner Section */}
      <div className="relative h-56 sm:h-72 md:h-96 overflow-hidden">
        {mockUser.banner ? (
          <img
            src={mockUser.banner}
            alt="Profile banner"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/50 via-transparent to-background/50" />
        
        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white/30 rounded-full"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 20}%`,
              }}
              animate={{
                y: [-10, 10, -10],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
        
        {/* Banner actions - positioned safely at top right with proper spacing */}
        <div className="absolute top-20 lg:top-24 right-4 flex items-center gap-2">
          <Button variant="secondary" size="sm" className="bg-background/80 backdrop-blur-xl border-border/50 hover:bg-background/90 text-foreground">
            <Camera className="h-4 w-4 mr-2" />
            Change Banner
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="bg-background/80 backdrop-blur-xl border-border/50 hover:bg-background/90 text-foreground w-9 h-9"
            onClick={handleShareProfile}
            disabled={syncingPublicProfile}
            title={shareCopied ? "Copied" : "Copy public profile link"}
          >
            {shareCopied ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="container mx-auto px-4">
        <div className="relative -mt-24 sm:-mt-28 mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-6"
          >
            {/* Left - Avatar & Quick Actions */}
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Avatar */}
              <div className="relative group">
                <div className="relative">
                  {/* Avatar */}
                  <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden bg-muted shadow-xl ring-1 ring-border/40">
                    {mockUser.avatar ? (
                      <img
                        src={mockUser.avatar}
                        alt={mockUser.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20 text-5xl font-bold text-primary">
                        {mockUser.name?.slice(0, 1)?.toUpperCase() || "U"}
                      </div>
                    )}
                  </div>
                  
                  {/* Edit overlay */}
                  <button className="absolute inset-1 flex items-center justify-center bg-foreground/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                    <Camera className="h-8 w-8 text-background" />
                  </button>
                  
                  {/* Premium badge */}
                  {mockUser.isPremium && (
                    <div className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                      <Crown className="h-5 w-5 text-white" />
                    </div>
                  )}
                  
                  {/* Level badge */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-primary to-accent rounded-full shadow-lg">
                    <span className="text-sm font-bold text-white">Lvl {mockUser.level}</span>
                  </div>
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 pt-4 sm:pt-8">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl sm:text-4xl font-black text-foreground">{mockUser.name}</h1>
                  {mockUser.isPremium && (
                    <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Premium
                    </Badge>
                  )}
                </div>
                
                <p className="text-lg text-muted-foreground mb-4">@{mockUser.username}</p>

                <div className="mb-5 flex flex-wrap gap-2">
                  <Button 
                    className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/25"
                    onClick={() => setActiveTab("settings")}
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                  <Button
                    variant="outline"
                    className="border-border/50 bg-background/45 backdrop-blur-sm"
                    onClick={handleOpenPublicView}
                    disabled={syncingPublicProfile || !profileSharingReady}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {syncingPublicProfile ? "Preparing..." : "View"}
                  </Button>
                </div>
                
                {/* XP Bar */}
                <div className="max-w-xs mb-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Level {mockUser.level}</span>
                    <span>{mockUser.xp.toLocaleString()} / {mockUser.xpToNext.toLocaleString()} XP</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${xpPercentage}%` }}
                      transition={{ duration: 1, delay: 0.3 }}
                    />
                  </div>
                </div>
                
                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {mockUser.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" />
                      {mockUser.location}
                    </span>
                  )}
                  {mockUser.joinedDate ? (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-primary" />
                      Joined {mockUser.joinedDate}
                    </span>
                  ) : null}
                  {mockUser.website && (
                    <a href={mockUser.website} className="flex items-center gap-1.5 text-accent hover:underline">
                      <LinkIcon className="h-4 w-4" />
                      Website
                    </a>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-2.5 xl:flex-nowrap">
                  {[
                    { label: "Completed", value: mockUser.stats.completed, icon: CheckCircle, color: "text-emerald-400" },
                    { label: "Days watched", value: `${mockUser.stats.daysWatched}d`, icon: Clock, color: "text-cyan-400" },
                    { label: "Day streak", value: mockUser.stats.currentStreak, icon: Flame, color: "text-orange-400" },
                    { label: "Mean score", value: mockUser.stats.meanScore, icon: Star, color: "text-amber-400" },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.9 }}
                      transition={{ duration: 0.4, delay: 0.1 + i * 0.05 }}
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
              </div>
            </div>
          </motion.div>

          {/* Bio */}
          {mockUser.bio && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: isLoaded ? 1 : 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="selectable mt-6 text-muted-foreground max-w-3xl leading-relaxed text-lg"
            >
              {mockUser.bio}
            </motion.p>
          )}
        </div>

        {/* Tabs */}
        <div className="sticky top-16 lg:top-20 z-30 -mx-4 px-4 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <nav className="flex gap-1 overflow-x-auto py-1 scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex items-center gap-2 px-5 py-4 text-sm font-medium transition-all whitespace-nowrap rounded-t-xl",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="profile-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-accent"
                      transition={{ type: "spring", duration: 0.5 }}
                    />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="py-8">
          <AnimatePresence mode="wait">
            {activeTab === "overview" ? (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                {/* Recent Activity */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold flex items-center gap-3">
                        <Clock className="h-5 w-5 text-primary" />
                        Recent Activity
                      </h2>
                      <Button variant="ghost" size="sm" className="text-accent">View All</Button>
                    </div>
                    
                    {entriesLoading ? (
                      <p className="text-sm text-muted-foreground">Loading your recent activity...</p>
                    ) : mockUser.recentActivity.length ? (
                      <div className="space-y-4">
                        {mockUser.recentActivity.map((activity, i) => {
                          const activityLabel =
                            activity.status === "completed"
                              ? "Completed"
                              : activity.status === "on_hold"
                                ? "On Hold"
                                : activity.status === "dropped"
                                  ? "Dropped"
                                  : activity.status === "plan_to_watch"
                                    ? "Planned"
                                    : activity.status === "rewatching"
                                      ? "Rewatching"
                                      : "Watching"
                          const activityDetail =
                            activity.status === "completed"
                              ? "Completed"
                              : activity.status === "on_hold"
                                ? "Moved to on hold"
                                : activity.status === "dropped"
                                  ? "Dropped from list"
                                  : activity.status === "plan_to_watch"
                                    ? "Added to planned"
                                    : `Episode ${activity.episode}`

                          return (
                            <motion.div
                              key={`${activity.anime}-${i}`}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: i * 0.1 }}
                              className="flex items-center gap-4 rounded-xl bg-muted/30 p-4 transition-colors group cursor-pointer hover:bg-muted/50"
                            >
                              <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-xl shadow-lg">
                                <img
                                  src={activity.image}
                                  alt={activity.anime}
                                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="line-clamp-1 font-semibold text-foreground transition-colors group-hover:text-primary">
                                  {activity.anime}
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">{activityDetail}</p>
                                <p className="mt-1 text-xs text-muted-foreground/60">{activity.time}</p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge
                                  className={cn(
                                    "text-xs",
                                    activity.status === "completed"
                                      ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                                      : activity.status === "dropped"
                                        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                        : activity.status === "on_hold"
                                          ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                                          : "bg-accent/10 text-accent hover:bg-accent/20",
                                  )}
                                >
                                  {activityLabel}
                                </Badge>
                                {activity.score ? (
                                  <div className="flex items-center gap-1 text-amber-500">
                                    <Star className="w-4 h-4 fill-current" />
                                    <span className="font-bold">{activity.score}</span>
                                  </div>
                                ) : null}
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                        Your recent activity will show up here after you start updating your list.
                      </div>
                    )}
                  </div>

                  {/* Anime Distribution */}
                  <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <BarChart3 className="h-5 w-5 text-purple-500" />
                      <h2 className="text-xl font-bold">Anime Distribution</h2>
                    </div>
                    
                    <div className="space-y-5">
                      {[
                        { label: "Watching", value: mockUser.stats.watching, color: "from-blue-500 to-cyan-500", icon: Play },
                        { label: "Completed", value: mockUser.stats.completed, color: "from-green-500 to-emerald-500", icon: CheckCircle },
                        { label: "On Hold", value: mockUser.stats.onHold, color: "from-amber-500 to-yellow-500", icon: PauseCircle },
                        { label: "Dropped", value: mockUser.stats.dropped, color: "from-red-500 to-rose-500", icon: XCircle },
                        { label: "Plan to Watch", value: mockUser.stats.planToWatch, color: "from-gray-500 to-slate-500", icon: Eye },
                      ].map((item, i) => {
                        const total = mockUser.stats.watching + mockUser.stats.completed + mockUser.stats.onHold + mockUser.stats.dropped + mockUser.stats.planToWatch
                        const percentage = (item.value / total) * 100
                        return (
                          <motion.div 
                            key={item.label} 
                            className="space-y-2"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.05 }}
                          >
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <item.icon className="h-4 w-4" />
                                {item.label}
                              </span>
                              <span className="font-semibold text-foreground">{item.value}</span>
                            </div>
                            <div className="h-3 rounded-full bg-muted overflow-hidden">
                              <motion.div 
                                className={cn("h-full rounded-full bg-gradient-to-r", item.color)}
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                              />
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Favorites */}
                  <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        <Heart className="h-5 w-5 text-red-500" />
                        Favorites
                      </h2>
                      <Button variant="ghost" size="sm" className="text-accent text-xs">Edit</Button>
                    </div>
                    {favoritesLoading ? (
                      <p className="text-sm text-muted-foreground">Loading your favorites...</p>
                    ) : mockUser.favorites.length ? (
                      <div className="grid grid-cols-2 gap-3">
                        {mockUser.favorites.map((fav, i) => (
                          <motion.div 
                            key={fav.id || i} 
                            className="relative group cursor-pointer"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, delay: i * 0.1 }}
                          >
                            <div className="relative aspect-[3/4] overflow-hidden rounded-xl shadow-lg transition-all group-hover:shadow-xl">
                              <img
                                src={fav.image}
                                alt={fav.title}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                              
                              {fav.score ? (
                                <div className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-sm">
                                  <Star className="w-3 h-3 fill-current text-amber-400" />
                                  <span className="text-xs font-bold text-white">{fav.score}</span>
                                </div>
                              ) : null}
                              
                              <div className="absolute bottom-0 left-0 right-0 p-3">
                                <p className="line-clamp-2 text-xs font-semibold text-white">{fav.title}</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                        Favorite a few titles and they will appear here.
                      </div>
                    )}
                  </div>

                  {/* Achievements */}
                  <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        <Award className="h-5 w-5 text-amber-500" />
                        Achievements
                      </h2>
                      <Badge variant="outline" className="text-xs">
                        {mockUser.achievements.filter(a => a.unlocked).length}/{mockUser.achievements.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {mockUser.achievements.map((achievement, i) => (
                        <motion.div
                          key={achievement.name}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: i * 0.05 }}
                          className={cn(
                            "relative p-3 rounded-xl text-center group cursor-pointer transition-all",
                            achievement.unlocked 
                              ? "bg-muted/50 hover:bg-muted" 
                              : "bg-muted/20 opacity-40"
                          )}
                          title={achievement.desc}
                        >
<div className="w-10 h-10 flex items-center justify-center mx-auto mb-2">
                                            <achievement.icon className={cn("w-6 h-6", achievement.color)} />
                                          </div>
                          <p className="text-[10px] font-medium text-muted-foreground line-clamp-1">{achievement.name}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Stats Summary */}
                  <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 border border-primary/20 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-bold">This Month</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-black text-foreground">{monthlyStats.completed}</p>
                        <p className="text-xs text-muted-foreground">Anime Completed</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-foreground">{monthlyStats.episodes}</p>
                        <p className="text-xs text-muted-foreground">Episodes</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-foreground">{monthlyStats.daysWatched}</p>
                        <p className="text-xs text-muted-foreground">Days Watched</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-foreground">{monthlyStats.meanScore ? monthlyStats.meanScore.toFixed(1) : "—"}</p>
                        <p className="text-xs text-muted-foreground">Avg Score</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === "lists" ? (
              <motion.div
                key="lists"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { name: "Currently Watching", count: mockUser.stats.watching, icon: Play, color: "text-blue-500", desc: "Your active watchlist", status: "watching" },
                    { name: "Completed", count: mockUser.stats.completed, icon: CheckCircle, color: "text-green-500", desc: "Finished anime", status: "completed" },
                    { name: "On Hold", count: mockUser.stats.onHold, icon: PauseCircle, color: "text-amber-500", desc: "Paused for now", status: "on-hold" },
                    { name: "Dropped", count: mockUser.stats.dropped, icon: XCircle, color: "text-red-500", desc: "Not for you", status: "dropped" },
                    { name: "Plan to Watch", count: mockUser.stats.planToWatch, icon: Eye, color: "text-purple-500", desc: "Future watchlist", status: "plan-to-watch" },
                  ].map((list, i) => (
                    <motion.div
                      key={list.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                    >
                      <Link
                        href={`/lists?status=${list.status}`}
                        className="block bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 hover:border-primary/50 hover:shadow-xl transition-all group"
                      >
                        <div className="flex items-start gap-4">
                          <list.icon className={cn("h-8 w-8 mt-1 group-hover:scale-110 transition-transform", list.color)} />
                          <div className="flex-1">
                            <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{list.name}</h3>
                            <p className="text-sm text-muted-foreground">{list.desc}</p>
                            <p className="text-3xl font-black mt-2">{list.count}</p>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : activeTab === "stats" ? (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Link
                  href="/wrapped"
                  className="mb-6 flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(168,85,247,0.12))] p-5 transition-all hover:border-primary/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-jp text-[11px] tracking-[0.3em] text-primary/70">まとめ</p>
                      <p className="font-bold text-foreground">Your {new Date().getFullYear()} Wrapped is ready</p>
                      <p className="text-sm text-muted-foreground">See your year in anime &amp; manga →</p>
                    </div>
                  </div>
                </Link>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { label: "Total Anime", value: (mockUser.stats.completed + mockUser.stats.watching).toString(), icon: List, color: "text-blue-500" },
                    { label: "Episodes Watched", value: mockUser.stats.totalEpisodes.toLocaleString(), icon: Play, color: "text-purple-500" },
                    { label: "Days Watched", value: mockUser.stats.daysWatched.toString(), icon: Clock, color: "text-green-500" },
                    { label: "Mean Score", value: mockUser.stats.meanScore.toString(), icon: Star, color: "text-amber-500" },
                    { label: "Current Streak", value: `${mockUser.stats.currentStreak} days`, icon: Flame, color: "text-orange-500" },
                    { label: "Longest Streak", value: `${mockUser.stats.longestStreak} days`, icon: Trophy, color: "text-amber-400" },
                    { label: "Rewatches", value: mockUser.stats.rewatches.toString(), icon: TrendingUp, color: "text-teal-500" },
                    { label: "Plan to Watch", value: mockUser.stats.planToWatch.toString(), icon: Eye, color: "text-gray-500" },
                  ].map((stat, i) => (
                    <motion.div 
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 text-center group hover:border-primary/50 transition-all"
                    >
                      <stat.icon className={cn("h-8 w-8 mx-auto mb-4 group-hover:scale-110 transition-transform", stat.color)} />
                      <p className="text-3xl font-black text-foreground">{stat.value}</p>
                      <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : activeTab === "settings" ? (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-3xl space-y-8"
              >
                {/* Profile Settings */}
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <h2 className="text-lg font-bold">Profile Information</h2>
                      <p className="text-sm text-muted-foreground">Update your profile details</p>
                    </div>
                  </div>
                  
                  <div className="grid gap-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input
                          id="displayName"
                          value={settings.displayName}
                          onChange={(e) => setSettings({ ...settings, displayName: e.target.value })}
                          className="bg-muted/30 border-border/50 h-12 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={settings.username}
                          onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                          className="bg-muted/30 border-border/50 h-12 rounded-xl"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={settings.bio}
                        onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
                        rows={4}
                        className="bg-muted/30 border-border/50 rounded-xl resize-none"
                      />
                    </div>
                    
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input
                          id="location"
                          value={settings.location}
                          onChange={(e) => setSettings({ ...settings, location: e.target.value })}
                          className="bg-muted/30 border-border/50 h-12 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          value={settings.website}
                          onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                          className="bg-muted/30 border-border/50 h-12 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold" onClick={handleSaveProfile}>
                    Save Changes
                  </Button>
                </div>

                {/* Privacy Settings */}
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-green-500" />
                    <div>
                      <h2 className="text-lg font-bold">Privacy Settings</h2>
                      <p className="text-sm text-muted-foreground">Control what other people can see on your public profile.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {[
                      { id: "publicProfile", label: "Public Profile", desc: "Allow others to view your profile", value: settings.publicProfile },
                      { id: "showActivity", label: "Show Activity", desc: "Display your recent activity on profile", value: settings.showActivity },
                      { id: "showStats", label: "Show Statistics", desc: "Display your anime statistics publicly", value: settings.showStats },
                    ].map((setting) => (
                      <div key={setting.id} className="flex items-center justify-between">
                        <div>
                          <Label htmlFor={setting.id} className="font-medium">{setting.label}</Label>
                          <p className="text-sm text-muted-foreground">{setting.desc}</p>
                        </div>
                        <Switch
                          id={setting.id}
                          checked={setting.value}
                          onCheckedChange={(checked) => 
                            setSettings({ ...settings, [setting.id]: checked })
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4 border-t border-border/50 pt-6">
                    <div>
                      <Label className="font-medium">Public List Sections</Label>
                      <p className="text-sm text-muted-foreground">
                        Choose which statuses show up in your public full list view.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {publicListVisibilityOptions.map((option) => (
                        <div key={option.id} className="flex items-start justify-between gap-4 rounded-2xl border border-border/50 bg-muted/20 px-4 py-3">
                          <div>
                            <Label htmlFor={`visibility-${option.id}`} className="font-medium">
                              {option.label}
                            </Label>
                            <p className="text-sm text-muted-foreground">{option.desc}</p>
                          </div>
                          <Switch
                            id={`visibility-${option.id}`}
                            checked={settings.publicListVisibility[option.id as keyof typeof defaultPublicListVisibility]}
                            onCheckedChange={(checked) =>
                              setSettings((current) => ({
                                ...current,
                                publicListVisibility: {
                                  ...current.publicListVisibility,
                                  [option.id]: checked,
                                },
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold"
                    onClick={handleSavePrivacy}
                    disabled={savingPrivacy}
                  >
                    {savingPrivacy ? "Saving Privacy..." : "Save Privacy"}
                  </Button>
                </div>

                {/* Notification Settings */}
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-purple-500" />
                    <div>
                      <h2 className="text-lg font-bold">Notifications</h2>
                      <p className="text-sm text-muted-foreground">Manage your notifications</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {[
                      { id: "emailNotifications", label: "Email Notifications", desc: "Receive updates via email", value: settings.emailNotifications },
                      { id: "pushNotifications", label: "Push Notifications", desc: "Receive browser notifications", value: settings.pushNotifications },
                    ].map((setting) => (
                      <div key={setting.id} className="flex items-center justify-between">
                        <div>
                          <Label htmlFor={setting.id} className="font-medium">{setting.label}</Label>
                          <p className="text-sm text-muted-foreground">{setting.desc}</p>
                        </div>
                        <Switch
                          id={setting.id}
                          checked={setting.value}
                          onCheckedChange={(checked) => 
                            setSettings({ ...settings, [setting.id]: checked })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : activeTab === "preferences" ? (
              <motion.div
                key="preferences"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-3xl space-y-8"
              >
                {/* Display Settings */}
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center gap-3">
                    <Palette className="h-5 w-5 text-amber-500" />
                    <div>
                      <h2 className="text-lg font-bold">Display Preferences</h2>
                      <p className="text-sm text-muted-foreground">Customize your experience</p>
                    </div>
                  </div>
                  
                  <div className="grid gap-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Theme</Label>
                        <Select value={settings.theme} onValueChange={(v) => setSettings({ ...settings, theme: v })}>
                          <SelectTrigger className="bg-muted/30 border-border/50 h-12 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="system">System</SelectItem>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Language</Label>
                        <Select value={settings.language} onValueChange={(v) => setSettings({ ...settings, language: v })}>
                          <SelectTrigger className="bg-muted/30 border-border/50 h-12 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="jp">Japanese</SelectItem>
                            <SelectItem value="kr">Korean</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Score Format</Label>
                      <Select value={settings.scoreFormat} onValueChange={(v) => setSettings({ ...settings, scoreFormat: v })}>
                        <SelectTrigger className="bg-muted/30 border-border/50 h-12 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10point">10 Point (1-10)</SelectItem>
                          <SelectItem value="100point">100 Point (1-100)</SelectItem>
                          <SelectItem value="5star">5 Star</SelectItem>
                          <SelectItem value="smiley">Smiley</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                      <div>
                        <Label className="font-medium">Adult Content</Label>
                        <p className="text-sm text-muted-foreground">Show 18+ anime content</p>
                      </div>
                      <Switch
                        checked={settings.adultContent}
                        onCheckedChange={(checked) => setSettings({ ...settings, adultContent: checked })}
                      />
                    </div>
                  </div>
                  
                  <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold" onClick={handleSavePreferences}>
                    Save Preferences
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
    </RequireAuth>
  )
}
