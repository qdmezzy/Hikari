
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Navigation } from "@/components/Navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Play,
  Pause,
  Plus,
  Heart,
  Share2,
  Eye,
  EyeOff,
  Sparkles,
  Flame,
  Zap,
  Wind,
  Moon,
  HeartIcon,
  MessageCircle,
  Bookmark,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  Check,
  BookmarkPlus,
  Trash2,
  Send,
  X,
  Link2,
  Upload,
  AlertTriangle,
  Crown,
  Users,
  Flag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { awardXp, XP_ACTIONS } from "@/lib/xp"
import { addNotification } from "@/lib/notifications-store"
import { reportContent } from "@/lib/reporting"
import {
  addUserNotInterestedMedia,
  fetchUserNotInterestedMedia,
  fetchUserTasteProfile,
  upsertUserTasteProfile,
} from "@/lib/recommendation-profile-store"

const vibeFilters = [
  { id: "hype", label: "Hype", icon: Flame, color: "from-orange-500 to-red-500" },
  { id: "funny", label: "Funny", icon: Sparkles, color: "from-yellow-500 to-amber-500" },
  { id: "action", label: "Action", icon: Zap, color: "from-blue-500 to-cyan-500" },
  { id: "chill", label: "Chill", icon: Wind, color: "from-teal-500 to-emerald-500" },
  { id: "dark", label: "Dark", icon: Moon, color: "from-slate-600 to-slate-800" },
  { id: "romance", label: "Romance", icon: HeartIcon, color: "from-pink-500 to-rose-500" },
  { id: "slow-burn", label: "Slow Burn", icon: Play, color: "from-slate-500 to-slate-700" },
]

const listOptions = [
  { id: "watching", label: "Watching", icon: Play, color: "text-blue-400" },
  { id: "completed", label: "Completed", icon: Check, color: "text-green-400" },
  { id: "plan_to_watch", label: "Plan to Watch", icon: BookmarkPlus, color: "text-amber-400" },
  { id: "on_hold", label: "On Hold", icon: Pause, color: "text-yellow-400" },
  { id: "dropped", label: "Dropped", icon: Trash2, color: "text-red-400" },
]

const contentModeOptions = [
  { id: "official", label: "Official", icon: Crown },
  { id: "fandom", label: "Fandom", icon: Users },
  { id: "for-you", label: "For You", icon: Sparkles },
]

const DISCOVER_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
      id
      format
      season
      seasonYear
      title { romaji english }
      coverImage { extraLarge large }
      bannerImage
      genres
      tags { name rank isMediaSpoiler }
      trailer { id site thumbnail }
      popularity
      description(asHtml: false)
    }
  }
}
`

const FEED_CACHE_TTL = 1000 * 60 * 5
const FOR_YOU_PROFILE_TTL = 1000 * 60 * 30
const FOR_YOU_PROFILE_CACHE_PREFIX = "hikari:discover:for-you-profile:v1"
const DISCOVER_TASTE_PROFILE_PREFIX = "hikari:discover:taste-profile:v1"
const DISCOVER_NOT_INTERESTED_PREFIX = "hikari:discover:not-interested:v1"

const getDiscoverCacheKey = (page) => `hikari:discover:official:${page}`

const readDiscoverCache = (page) => {
  if (typeof window === "undefined") return null
  const raw = window.sessionStorage.getItem(getDiscoverCacheKey(page))
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (error) {
    return null
  }
}

const writeDiscoverCache = (page, payload) => {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(getDiscoverCacheKey(page), JSON.stringify(payload))
}

const SEARCH_QUERY = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
      id
      title { romaji english }
      coverImage { extraLarge large }
    }
  }
}
`

const PROFILE_MEDIA_QUERY = `
query ($ids: [Int], $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(id_in: $ids, type: ANIME) {
      id
      title { romaji english }
      genres
      tags { name }
    }
  }
}
`

const chunkIds = (ids, size) => {
  const batches = []
  for (let i = 0; i < ids.length; i += size) {
    batches.push(ids.slice(i, i + size))
  }
  return batches
}

const normalizeToken = (value = "") =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")

const toTitleCase = (value = "") =>
  String(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ")

const statusPreferenceWeight = {
  watching: 3,
  completed: 2,
  plan_to_watch: 2,
  on_hold: 1,
  dropped: -3,
}

const vibeLabelLookup = Object.fromEntries(vibeFilters.map((vibe) => [vibe.id, vibe.label]))

const getForYouProfileCacheKey = (userId) => `${FOR_YOU_PROFILE_CACHE_PREFIX}:${userId}`

const readForYouProfileCache = (userId) => {
  if (typeof window === "undefined" || !userId) return null
  const raw = window.localStorage.getItem(getForYouProfileCacheKey(userId))
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const writeForYouProfileCache = (userId, payload) => {
  if (typeof window === "undefined" || !userId) return
  window.localStorage.setItem(getForYouProfileCacheKey(userId), JSON.stringify(payload))
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const clampWeight = (value, min = -25, max = 25) => Math.max(min, Math.min(max, value))

  const getTasteProfileKey = (userId) => `${DISCOVER_TASTE_PROFILE_PREFIX}:${userId}`

const defaultTasteProfile = () => ({
  genreWeights: {},
  tagWeights: {},
  vibeWeights: {},
  formatWeights: {},
  updatedAt: Date.now(),
})

const readTasteProfile = (userId) => {
  if (typeof window === "undefined" || !userId) return defaultTasteProfile()
  const raw = window.localStorage.getItem(getTasteProfileKey(userId))
  if (!raw) return defaultTasteProfile()
  try {
    const parsed = JSON.parse(raw)
    return {
      ...defaultTasteProfile(),
      ...parsed,
      genreWeights: parsed?.genreWeights && typeof parsed.genreWeights === "object" ? parsed.genreWeights : {},
      tagWeights: parsed?.tagWeights && typeof parsed.tagWeights === "object" ? parsed.tagWeights : {},
      vibeWeights: parsed?.vibeWeights && typeof parsed.vibeWeights === "object" ? parsed.vibeWeights : {},
      formatWeights: parsed?.formatWeights && typeof parsed.formatWeights === "object" ? parsed.formatWeights : {},
      updatedAt: typeof parsed?.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    }
  } catch {
    return defaultTasteProfile()
  }
}

const writeTasteProfile = (userId, profile) => {
  if (typeof window === "undefined" || !userId) return
  try {
    window.localStorage.setItem(getTasteProfileKey(userId), JSON.stringify(profile))
  } catch {
    // ignore quota errors
  }
}

const applyTasteDelta = (profile, { genreDelta = {}, vibeDelta = {}, formatDelta = {} }) => {
  const next = {
    ...profile,
    genreWeights: { ...(profile?.genreWeights || {}) },
    tagWeights: { ...(profile?.tagWeights || {}) },
    vibeWeights: { ...(profile?.vibeWeights || {}) },
    formatWeights: { ...(profile?.formatWeights || {}) },
    updatedAt: Date.now(),
  }

  Object.entries(genreDelta).forEach(([key, value]) => {
    if (!key) return
    next.genreWeights[key] = clampWeight((next.genreWeights[key] || 0) + value)
  })
  Object.entries(vibeDelta).forEach(([key, value]) => {
    if (!key) return
    next.vibeWeights[key] = clampWeight((next.vibeWeights[key] || 0) + value)
  })
  Object.entries(formatDelta).forEach(([key, value]) => {
    if (!key) return
    next.formatWeights[key] = clampWeight((next.formatWeights[key] || 0) + value)
  })

  return next
}

  const getNotInterestedKey = (userId) => `${DISCOVER_NOT_INTERESTED_PREFIX}:${userId}`

const readNotInterested = (userId) => {
  if (typeof window === "undefined" || !userId) return {}
  const raw = window.localStorage.getItem(getNotInterestedKey(userId))
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

  const writeNotInterested = (userId, map) => {
  if (typeof window === "undefined" || !userId) return
  try {
    window.localStorage.setItem(getNotInterestedKey(userId), JSON.stringify(map))
  } catch {
    // ignore
  }

}

const mergeWeightMaps = (base = {}, extra = {}) => {
  const merged = { ...base }
  Object.entries(extra).forEach(([key, value]) => {
    merged[key] = (merged[key] || 0) + value
  })
  return merged
}

const createJitter = (value = "") => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash % 1000) / 100000
}

const dedupeReasons = (reasons = []) => {
  const seen = new Set()
  const result = []
  reasons.forEach((reason) => {
    const key = reason.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(reason)
    }
  })
  return result
}

const getVibes = (genres = [], tags = []) => {
  const vibeSet = new Set()
  const lowerGenres = genres.map((genre) => genre.toLowerCase())
  const tagNames = tags.map((tag) => tag.name.toLowerCase())

  if (lowerGenres.some((genre) => ["comedy", "parody"].includes(genre))) vibeSet.add("funny")
  if (lowerGenres.some((genre) => ["action", "adventure", "shounen"].includes(genre))) vibeSet.add("hype")
  if (lowerGenres.some((genre) => ["slice of life", "iyashikei"].includes(genre))) vibeSet.add("chill")
  if (lowerGenres.some((genre) => ["psychological", "horror", "thriller"].includes(genre))) vibeSet.add("dark")
  if (lowerGenres.includes("romance")) vibeSet.add("romance")
  if (lowerGenres.includes("drama") || tagNames.includes("slow burn")) vibeSet.add("slow-burn")
  if (lowerGenres.includes("action")) vibeSet.add("action")

  return Array.from(vibeSet)
}

const getSpoilerLevel = (tags = []) => {
  if (tags.some((tag) => tag.isMediaSpoiler)) return "Heavy"
  if (tags.some((tag) => /death|tragic|gore|spoiler/i.test(tag.name))) return "Mild"
  return "None"
}

const getYouTubeId = (trailer) => {
  if (!trailer?.id || trailer?.site?.toLowerCase() !== "youtube") return null
  return trailer.id
}

const getPlayerVars = (muted) => {
  const vars = {
    autoplay: 1,
    mute: muted ? 1 : 0,
    controls: 0,
    rel: 0,
    modestbranding: 1,
    playsinline: 1,
  }
  if (typeof window !== "undefined") {
    vars.origin = window.location.origin
  }
  return vars
}

const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
  return `${num}`
}

const formatShortDate = (value) => {
  if (!value) return ""
  const date = new Date(value)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const toSlug = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const parseVideoUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.replace("www.", "")

    if (host === "youtu.be") {
      const id = url.pathname.slice(1)
      if (!id) return null
      return { site: "youtube", id, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
    }

    if (host.includes("youtube.com")) {
      if (url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.replace("/shorts/", "").split("/")[0]
        if (!id) return null
        return { site: "youtube", id, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
      }
      const id = url.searchParams.get("v")
      if (!id) return null
      return { site: "youtube", id, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
    }

    return null
  } catch {
    return null
  }
}

const getClipKey = (clip) => `${clip.animeId}:${clip.trailerId}`

const DISCOVER_PREFS_KEY = "hikari.discover.prefs"

export default function DiscoverPage() {
  const { user } = useAuth()
  const [clips, setClips] = useState([])
  const [fandomClips, setFandomClips] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [spoilersOff, setSpoilersOff] = useState(true)
  const [showSpoilerContent, setShowSpoilerContent] = useState(false)
  const [activeVibes, setActiveVibes] = useState([])
  const [contentMode, setContentMode] = useState("for-you")
  const [isMuted, setIsMuted] = useState(true)
  const [isPlaying, setIsPlaying] = useState(true)
  const [liked, setLiked] = useState({})
  const [saved, setSaved] = useState({})
  const [learnedProfile, setLearnedProfile] = useState(null)
  const [tasteProfile, setTasteProfile] = useState(null)
  const [notInterested, setNotInterested] = useState({})
  const [reasonIndex, setReasonIndex] = useState(0)
  const [likeCounts, setLikeCounts] = useState({})
  const [commentCounts, setCommentCounts] = useState({})
  const [progress, setProgress] = useState(0)
  const [addToListOpen, setAddToListOpen] = useState(false)
  const [selectedList, setSelectedList] = useState({})

  const [listStatusesReady, setListStatusesReady] = useState(false)
  const [listPendingId, setListPendingId] = useState(null)
  const [savePendingId, setSavePendingId] = useState(null)
  const [shareNoticeId, setShareNoticeId] = useState(null)
  const [likePendingId, setLikePendingId] = useState(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState("")
  const [commentText, setCommentText] = useState("")
  const [commentPending, setCommentPending] = useState(false)
  const [commentLikes, setCommentLikes] = useState({})
  const [commentLiked, setCommentLiked] = useState({})
  const [replyToId, setReplyToId] = useState(null)
  const [replyText, setReplyText] = useState("")
  const [editCommentId, setEditCommentId] = useState(null)
  const [editText, setEditText] = useState("")
  const [commentActionPending, setCommentActionPending] = useState({})
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [direction, setDirection] = useState("down")
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [feedError, setFeedError] = useState("")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [submitLink, setSubmitLink] = useState("")
  const [submitAnime, setSubmitAnime] = useState("")
  const [submitMedia, setSubmitMedia] = useState(null)
  const [submitSuggestions, setSubmitSuggestions] = useState([])
  const [submitSuggestionsOpen, setSubmitSuggestionsOpen] = useState(false)
  const [submitSuggestionsLoading, setSubmitSuggestionsLoading] = useState(false)
  const [submitTags, setSubmitTags] = useState([])
  const [submitHasSpoilers, setSubmitHasSpoilers] = useState(false)
  const [submitSpoilerEpisode, setSubmitSpoilerEpisode] = useState("")
  const [submitPending, setSubmitPending] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [reportingClipId, setReportingClipId] = useState(null)
  const [reportingCommentId, setReportingCommentId] = useState(null)
  const [heartAnimating, setHeartAnimating] = useState(null)
  const [prefsReady, setPrefsReady] = useState(false)

  const getErrorText = (error) => {
    if (!error) return ""
    const message = typeof error?.message === "string" ? error.message : ""
    const details = typeof error?.details === "string" ? error.details : ""
    const hint = typeof error?.hint === "string" ? error.hint : ""
    return `${message} ${details} ${hint}`.toLowerCase()
  }

  const isMissingRelation = (error, relation) => {
    const code = String(error?.code || "")
    const text = getErrorText(error)
    const needle = String(relation || "").toLowerCase()
    return (
      code === "42P01" ||
      code === "42703" ||
      code === "PGRST204" ||
      (needle && text.includes(needle) && (text.includes("does not exist") || text.includes("unknown")))
    )
  }

  const feedbackWeight = {
    complete: 0.8,
    like: 1.6,
    save: 1.2,
    plan_to_watch: 2.6,
    quick_skip: -1.0,
    not_interested: -3.8,
  }

  const scheduleTasteProfileSync = useCallback(
    (profile) => {
      if (!user?.id || !profile) return
      if (tasteSyncTimerRef.current) {
        clearTimeout(tasteSyncTimerRef.current)
      }
      tasteSyncTimerRef.current = setTimeout(() => {
        upsertUserTasteProfile(client, user.id, profile)
      }, 900)
    },
    [user?.id],
  )

  const applyDiscoverFeedback = useCallback(
    (kind, clip) => {
      if (!user?.id || !clip) return
      const amount = feedbackWeight[kind] || 0
      if (!amount) return

      const vibeDelta = {}
      const genreDelta = {}
      const formatDelta = {}

      ;(clip.tags || []).forEach((tag) => {
        vibeDelta[tag] = (vibeDelta[tag] || 0) + amount
      })

      ;(clip.genres || []).forEach((genre) => {
        const key = normalizeToken(genre)
        if (!key) return
        // Genres are broader than vibes; apply slightly less weight.
        genreDelta[key] = (genreDelta[key] || 0) + amount * 0.75
      })

      if (clip.format) {
        formatDelta[clip.format] = (formatDelta[clip.format] || 0) + amount * 0.5
      }

      const current = tasteProfileRef.current || readTasteProfile(user.id)
      const next = applyTasteDelta(current, { genreDelta, vibeDelta, formatDelta })
      tasteProfileRef.current = next
      setTasteProfile(next)
      writeTasteProfile(user.id, next)
      scheduleTasteProfileSync(next)

      if (kind === "not_interested") {
        addUserNotInterestedMedia(client, user.id, clip.animeId)
        setNotInterested((prev) => {
          const nextHidden = { ...(prev || {}) }
          nextHidden[String(clip.animeId)] = true
          writeNotInterested(user.id, nextHidden)
          return nextHidden
        })
      }
    },
    [user?.id, scheduleTasteProfileSync],
  )

  const containerRef = useRef(null)
  const listMenuRef = useRef(null)
  const wasPlayingBeforeSpoilerRef = useRef(false)
  const playerRef = useRef(null)
  const tasteProfileRef = useRef(null)
  const currentClipRef = useRef(null)
  const filteredClipsRef = useRef([])
  const clipStartedAtRef = useRef(Date.now())
  const isMutedRef = useRef(true)
  const isPlayingRef = useRef(true)
  const shouldBlurRef = useRef(false)
  const isTransitioningRef = useRef(false)
  const nextClipRef = useRef(null)
  const tasteSyncTimerRef = useRef(null)
  const loadMoreCooldownUntilRef = useRef(0)
  const loadMoreInFlightRef = useRef(false)
  const [ytReady, setYtReady] = useState(false)

  useEffect(() => {
    return () => {
      if (tasteSyncTimerRef.current) {
        clearTimeout(tasteSyncTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISCOVER_PREFS_KEY)
      if (raw) {
        const prefs = JSON.parse(raw)
        const modeIds = contentModeOptions.map((option) => option.id)
        const preferredMode = prefs?.contentMode === "mixed" ? "for-you" : prefs?.contentMode
        if (modeIds.includes(preferredMode)) {
          setContentMode(preferredMode)
        }
        if (typeof prefs?.spoilersOff === "boolean") {
          setSpoilersOff(prefs.spoilersOff)
        }
        if (Array.isArray(prefs?.activeVibes)) {
          const valid = new Set(vibeFilters.map((vibe) => vibe.id))
          setActiveVibes(prefs.activeVibes.filter((vibe) => valid.has(vibe)))
        }
      }
    } catch (error) {
      console.warn("Failed to load discover preferences", error)
    } finally {
      setPrefsReady(true)
    }
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setTasteProfile(null)
      setNotInterested({})
      tasteProfileRef.current = null
      return
    }

    let active = true

    // Seed from local cache immediately (fast UI), then sync from Supabase (cross-device).
    const cachedTaste = readTasteProfile(user.id)
    const cachedHidden = readNotInterested(user.id)
    tasteProfileRef.current = cachedTaste
    setTasteProfile(cachedTaste)
    setNotInterested(cachedHidden)

    const loadRemote = async () => {
      const [tasteResult, remoteHidden] = await Promise.all([
        fetchUserTasteProfile(client, user.id),
        fetchUserNotInterestedMedia(client, user.id),
      ])

      if (!active) return

      // Prefer the newer profile (local may contain recent offline feedback).
      const remoteTaste = tasteResult?.found ? tasteResult.profile : null
      const nextTaste = remoteTaste && remoteTaste.updatedAt >= cachedTaste?.updatedAt ? remoteTaste : cachedTaste
      tasteProfileRef.current = nextTaste
      setTasteProfile(nextTaste)
      writeTasteProfile(user.id, nextTaste)

      const nextHidden = { ...(cachedHidden || {}) }
      ;(remoteHidden || []).forEach((mediaId) => {
        nextHidden[String(mediaId)] = true
      })
      setNotInterested(nextHidden)
      writeNotInterested(user.id, nextHidden)

      // Ensure a row exists server-side if we only had local.
      if (!tasteResult?.found) {
        await upsertUserTasteProfile(client, user.id, nextTaste)
      }
    }

    loadRemote()

    return () => {
      active = false
    }
  }, [user?.id])

  useEffect(() => {
    tasteProfileRef.current = tasteProfile
  }, [tasteProfile])

  useEffect(() => {
    if (!prefsReady) return
    const prefs = {
      contentMode,
      spoilersOff,
      activeVibes,
    }
    try {
      localStorage.setItem(DISCOVER_PREFS_KEY, JSON.stringify(prefs))
    } catch (error) {
      console.warn("Failed to save discover preferences", error)
    }
  }, [contentMode, spoilersOff, activeVibes, prefsReady])
  useEffect(() => {
    let isActive = true

    const loadFeed = async (pageNumber, append = false) => {
      if (!append) {
        setLoadingFeed(true)
        setFeedError("")
      }
      if (append) {
        setLoadingMore(true)
      }
      try {
        const cached = readDiscoverCache(pageNumber)
        if (cached && Date.now() - cached.cachedAt < FEED_CACHE_TTL) {
          if (isActive) {
            setClips((prev) => {
              if (!append) return cached.items
              const seen = new Set(prev.map((clip) => clip.key))
              const next = [...prev]
              cached.items.forEach((clip) => {
                if (!seen.has(clip.key)) {
                  seen.add(clip.key)
                  next.push(clip)
                }
              })
              return next
            })
            setHasMore(cached.hasNextPage)
            setLoadingFeed(false)
            setLoadingMore(false)
          }
          return
        }

        const fetchWithRetry = async (attempt = 0) => {
          const response = await fetch("/api/anilist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: DISCOVER_QUERY, variables: { page: pageNumber, perPage: 30 } }),
          })
          if (response.status === 429 && attempt < 2) {
            const retryAfter = Number(response.headers.get("Retry-After"))
            const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : 800 * (attempt + 1)
            await new Promise((resolve) => setTimeout(resolve, delay))
            return fetchWithRetry(attempt + 1)
          }
          return response
        }

        const res = await fetchWithRetry()
        let json = null
        try {
          json = await res.json()
        } catch (error) {
          json = null
        }
        if (res.status === 429) {
          throw new Error("Rate limited. Please wait a moment and try again.")
        }
        if (!res.ok || json?.errors) {
          throw new Error(json?.errors?.[0]?.message || "Failed to load discovery feed.")
        }

        const mediaList = json?.data?.Page?.media || []
        const hasNextPage = json?.data?.Page?.pageInfo?.hasNextPage ?? false
        const items = mediaList
          .map((media) => {
            const trailerId = getYouTubeId(media.trailer)
            if (!trailerId) return null
            const vibes = getVibes(media.genres || [], media.tags || [])
            const spoilerLevel = getSpoilerLevel(media.tags || [])
            return {
              key: `${media.id}:${trailerId}`,
              id: media.id,
              animeTitle: media.title?.english || media.title?.romaji || "Untitled",
              animeId: media.id,
              format: media.format || null,
              season: media.season || null,
              seasonYear: media.seasonYear || null,
              clipTitle: "Official Trailer",
              thumbnail: media.trailer?.thumbnail || media.bannerImage || media.coverImage?.extraLarge,
              type: "Official",
              spoilerLevel,
              episode: null,
              tags: vibes,
              likes: media.popularity || 0,
              comments: Math.max(10, Math.round((media.popularity || 0) / 40)),
              shares: Math.max(5, Math.round((media.popularity || 0) / 150)),
              description: (media.description || "").replace(/<[^>]+>/g, ""),
              genres: media.genres || [],
              tagNames: (media.tags || []).map((tag) => tag.name),
              trailerId,
            }
          })
          .filter(Boolean)

        if (isActive) {
          writeDiscoverCache(pageNumber, { items, hasNextPage, cachedAt: Date.now() })
          setClips((prev) => {
            if (!append) return items
            const seen = new Set(prev.map((clip) => clip.key))
            const next = [...prev]
            items.forEach((clip) => {
              if (!seen.has(clip.key)) {
                seen.add(clip.key)
                next.push(clip)
              }
            })
            return next
          })
          setHasMore(hasNextPage)
          setLoadingFeed(false)
          setLoadingMore(false)
        }
      } catch (error) {
        console.error(error)
        if (isActive) {
          setFeedError(error.message || "Could not load discovery feed.")
          setLoadingFeed(false)
          setLoadingMore(false)
        }
      }
    }

    const loadFandom = async () => {
      const { data, error } = await client
        .from("fandom_clips")
        .select(
          "id, user_id, media_id, media_title, clip_title, video_url, video_site, video_id, thumbnail_url, tags, spoiler_level, spoiler_episode, user_display_name, user_handle, user_avatar_url, created_at",
        )
        .eq("status", "approved")
        .eq("is_removed", false)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Failed to load fandom clips:", error)
        return
      }

      const mapped = (data || []).map((row) => ({
        key: `${row.media_id}:${row.video_id}`,
        id: row.id,
        animeTitle: row.media_title,
        animeId: row.media_id,
        format: null,
        season: null,
        seasonYear: null,
        clipTitle: row.clip_title || "Fandom Clip",
        thumbnail: row.thumbnail_url || null,
        type: "Fandom",
        spoilerLevel: row.spoiler_level || "None",
        spoilerEpisode: row.spoiler_episode || null,
        episode: null,
        tags: row.tags || [],
        likes: 0,
        comments: 0,
        shares: 0,
        description: row.clip_title || "Fandom submission.",
        genres: [],
        tagNames: row.tags || [],
        trailerId: row.video_id,
        creator: {
          id: row.user_id,
          username: row.user_handle || "fan",
          displayName: row.user_display_name || row.user_handle || "Hikari Fan",
          avatar: row.user_avatar_url || null,
        },
        fandomTag: row.media_title,
      }))

      setFandomClips(mapped)
    }

    loadFeed(1)
    loadFandom()

    return () => {
      isActive = false
    }
  }, [])

  const interactionProfile = useMemo(() => {
    const genreWeights = {}
    const vibeWeights = {}
    const titleWeights = {}
    const sourceClips = [...clips, ...fandomClips]
    const byAnime = sourceClips.reduce((acc, clip) => {
      if (!acc[clip.animeId]) acc[clip.animeId] = []
      acc[clip.animeId].push(clip)
      return acc
    }, {})

    const applyClipWeight = (clip, weight) => {
      if (!clip || !weight) return
      ;(clip.tags || []).forEach((tag) => {
        vibeWeights[tag] = (vibeWeights[tag] || 0) + weight
      })
      ;(clip.genres || []).forEach((genre) => {
        const key = normalizeToken(genre)
        if (!key) return
        genreWeights[key] = (genreWeights[key] || 0) + weight
      })
      if (clip.animeTitle) {
        titleWeights[clip.animeTitle] = (titleWeights[clip.animeTitle] || 0) + weight
      }
    }

    sourceClips.forEach((clip) => {
      const key = getClipKey(clip)
      if (liked[key]) applyClipWeight(clip, 3.5)
      if (saved[clip.animeId]) applyClipWeight(clip, 2.5)
      const status = selectedList[clip.animeId]
      if (status) {
        applyClipWeight(clip, statusPreferenceWeight[status] || 0)
      }
    })

    Object.entries(selectedList).forEach(([mediaId, status]) => {
      const related = byAnime[Number(mediaId)] || []
      related.forEach((clip) => applyClipWeight(clip, statusPreferenceWeight[status] || 0))
    })

    return {
      genreWeights,
      vibeWeights,
      topGenres: Object.entries(genreWeights)
        .filter(([, value]) => value > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([genre]) => genre)
        .slice(0, 4),
      topVibes: Object.entries(vibeWeights)
        .filter(([, value]) => value > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([vibe]) => vibe)
        .slice(0, 4),
      seedTitles: Object.entries(titleWeights)
        .filter(([, value]) => value > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([title]) => title)
        .slice(0, 6),
    }
  }, [clips, fandomClips, liked, saved, selectedList])

  const forYouProfile = useMemo(() => {
    const fallback = {
      genreWeights: {},
      vibeWeights: {},
      formatWeights: {},
      topGenres: [],
      topVibes: [],
      seedTitles: [],
    }

    const taste = tasteProfile || fallback

    const mergedGenreWeights = mergeWeightMaps(
      mergeWeightMaps(learnedProfile?.genreWeights || {}, interactionProfile.genreWeights),
      taste.genreWeights || {},
    )
    const mergedVibeWeights = mergeWeightMaps(
      mergeWeightMaps(learnedProfile?.vibeWeights || {}, interactionProfile.vibeWeights),
      taste.vibeWeights || {},
    )
    const mergedFormatWeights = mergeWeightMaps({}, taste.formatWeights || {})

    const topGenres = Object.entries(mergedGenreWeights)
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([genre]) => genre)
      .slice(0, 4)

    const topVibes = Object.entries(mergedVibeWeights)
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([vibe]) => vibe)
      .slice(0, 4)

    return {
      genreWeights: mergedGenreWeights,
      vibeWeights: mergedVibeWeights,
      formatWeights: mergedFormatWeights,
      topGenres,
      topVibes,
      seedTitles: dedupeReasons([...(learnedProfile?.seedTitles || []), ...(interactionProfile.seedTitles || [])]).slice(
        0,
        6,
      ),
    }
  }, [learnedProfile, interactionProfile, tasteProfile])

  const forYouClips = useMemo(() => {
    const base = [...clips, ...fandomClips]
    if (!base.length) return []

    const deduped = []
    const seenKeys = new Set()
    base.forEach((clip) => {
      if (!clip?.key || seenKeys.has(clip.key)) return
      seenKeys.add(clip.key)
      deduped.push(clip)
    })

    const shouldExcludeListed = Boolean(user?.id && listStatusesReady)
    const listedIds = shouldExcludeListed ? new Set(Object.keys(selectedList).map((id) => Number(id)).filter(Boolean)) : null

    const candidates = deduped.filter((clip) => {
      const animeId = Number(clip.animeId)
      if (Number.isFinite(animeId)) {
        if (listedIds?.has(animeId)) return false
        if (notInterested?.[String(animeId)]) return false
      }
      return true
    })

    if (!candidates.length) return []

    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    const currentSeason = month < 3 ? "WINTER" : month < 6 ? "SPRING" : month < 9 ? "SUMMER" : "FALL"

    const topVibes = forYouProfile.topVibes || []
    const topGenres = forYouProfile.topGenres || []

    const scoreCandidate = (clip) => {
      const clipKey = getClipKey(clip)
      const reasons = []

      const vibeMatches = (clip.tags || [])
        .map((tag) => ({ tag, weight: forYouProfile.vibeWeights?.[tag] || 0 }))
        .sort((a, b) => b.weight - a.weight)
      const topVibeMatch = vibeMatches[0] || null

      const genreMatches = (clip.genres || [])
        .map((genre) => {
          const key = normalizeToken(genre)
          return { genre: key, weight: forYouProfile.genreWeights?.[key] || 0 }
        })
        .sort((a, b) => b.weight - a.weight)
      const topGenreMatch = genreMatches[0] || null

      const formatWeight = clip.format ? forYouProfile.formatWeights?.[clip.format] || 0 : 0

      const isSeasonal = Boolean(
        clip.season && clip.seasonYear && String(clip.season).toUpperCase() === currentSeason && Number(clip.seasonYear) === year,
      )

      let globalScore = clip.type === "Official" ? 1.25 : 0.95
      globalScore += Math.min((clip.likes || 0) / 55000, 2.5)
      if (isSeasonal) globalScore += 0.55

      let personalScore = 0
      if (liked[clipKey]) {
        personalScore += 5.5
        reasons.push(`Because you liked ${clip.animeTitle}`)
      }
      if (saved[clip.animeId]) {
        personalScore += 3.4
        reasons.push(`Because you saved ${clip.animeTitle}`)
      }

      if (topVibeMatch && topVibeMatch.weight) {
        personalScore += topVibeMatch.weight * 0.6
        if (topVibeMatch.weight > 0) {
          reasons.push(`Because you liked ${vibeLabelLookup[topVibeMatch.tag] || topVibeMatch.tag}`)
        }
      }

      if (topGenreMatch && topGenreMatch.weight) {
        personalScore += topGenreMatch.weight * 0.35
        if (topGenreMatch.weight > 0) {
          reasons.push(`Because you watched ${toTitleCase(topGenreMatch.genre)}`)
        }
      }

      if (formatWeight) {
        personalScore += formatWeight * 0.25
      }

      const seedTitles = forYouProfile.seedTitles || []
      const normalizedTitle = normalizeToken(clip.animeTitle)
      const matchedSeed = seedTitles.find((seed) => {
        const token = normalizeToken(seed)
        if (!token || !normalizedTitle) return false
        return token === normalizedTitle || token.includes(normalizedTitle) || normalizedTitle.includes(token)
      })
      if (matchedSeed && clip.type === "Fandom") {
        personalScore += 1.4
        reasons.push(`Because you liked ${matchedSeed}`)
      }

      if (isSeasonal) {
        reasons.push("New this season")
      }

      const primaryVibe = topVibeMatch?.tag || (clip.tags || [])[0] || null
      const primaryGenre = topGenreMatch?.genre || (clip.genres?.[0] ? normalizeToken(clip.genres[0]) : null)

      const poolSignals = {
        primaryVibe,
        primaryGenre,
        globalScore,
        personalScore,
        isSeasonal,
      }

      if (!reasons.length && topVibes.length) {
        const fallbackVibe = topVibes[0]
        reasons.push(`Because you liked ${vibeLabelLookup[fallbackVibe] || fallbackVibe}`)
      }

      if (!reasons.length && topGenres.length) {
        reasons.push(`Because you watched ${toTitleCase(topGenres[0])}`)
      }

      if (!reasons.length) {
        reasons.push(clip.type === "Fandom" ? "Because this fandom clip is trending now" : "Because this is trending now")
      }

      const forYouScore = personalScore * 1.0 + globalScore * 1.15 + createJitter(clip.key)

      return {
        ...clip,
        ...poolSignals,
        forYouScore,
        forYouReasons: dedupeReasons(reasons).slice(0, 3),
      }
    }

    const scored = candidates.map(scoreCandidate)

    // Pools:
    // - personal: strongly matches the user's taste profile
    // - global: generally trending + seasonal
    // - explore: outside top vibes/genres but still strong globally
    const personalRanked = [...scored].sort(
      (a, b) => b.personalScore + b.globalScore * 0.25 - (a.personalScore + a.globalScore * 0.25),
    )
    const globalRanked = [...scored].sort((a, b) => b.globalScore + b.personalScore * 0.08 - (a.globalScore + a.personalScore * 0.08))

    const exploreRanked = scored
      .filter((clip) => {
        if (!topVibes.length && !topGenres.length) return true
        const matchesTopVibe = clip.primaryVibe ? topVibes.includes(clip.primaryVibe) : false
        const matchesTopGenre = clip.primaryGenre ? topGenres.includes(clip.primaryGenre) : false
        if (matchesTopVibe || matchesTopGenre) return false
        return clip.personalScore > -2
      })
      .sort((a, b) => b.globalScore + b.personalScore * 0.04 - (a.globalScore + a.personalScore * 0.04))

    const pools = {
      personal: personalRanked,
      global: globalRanked,
      explore: exploreRanked,
    }

    const pointers = {
      personal: 0,
      global: 0,
      explore: 0,
    }

    const ratioPattern = ["personal", "personal", "personal", "personal", "personal", "personal", "personal", "global", "global", "explore"]
    const picked = new Set()
    const mixed = []

    const takeNext = (poolId) => {
      const pool = pools[poolId]
      if (!pool?.length) return null
      let idx = pointers[poolId] || 0
      while (idx < pool.length && picked.has(pool[idx].key)) idx += 1
      pointers[poolId] = idx + 1
      const item = pool[idx]
      if (!item || picked.has(item.key)) return null
      picked.add(item.key)
      return { ...item, forYouPool: poolId }
    }

    for (let step = 0; mixed.length < scored.length && step < scored.length * 3; step += 1) {
      const desiredPool = ratioPattern[step % ratioPattern.length]
      const item =
        takeNext(desiredPool) || takeNext("personal") || takeNext("global") || takeNext("explore")
      if (!item) break
      mixed.push(item)
    }

      const applyVariety = (items) => {
      const queue = [...items]
      const output = []
      const maxLookahead = 18

      const violates = (candidate) => {
        if (!candidate) return true
        const last = output[output.length - 1]
        const last2 = output[output.length - 2]
        if (last && last2) {
          if (candidate.animeId === last.animeId && last.animeId === last2.animeId) return true
          if (candidate.primaryVibe && candidate.primaryVibe === last.primaryVibe && last.primaryVibe === last2.primaryVibe) return true
          if (candidate.type && candidate.type === last.type && last.type === last2.type) {
            const last3 = output[output.length - 3]
            if (last3 && last3.type === candidate.type) return true
          }
        }
        return false
      }

      while (queue.length) {
        const lookahead = Math.min(queue.length, maxLookahead)
        let pickIndex = -1
        for (let i = 0; i < lookahead; i += 1) {
          if (!violates(queue[i])) {
            pickIndex = i
            break
          }
        }
        if (pickIndex === -1) pickIndex = 0
        output.push(queue.splice(pickIndex, 1)[0])
      }

      // Ensure pool-specific reasons show up.
      return output.map((clip) => {
        const reasons = [...(clip.forYouReasons || [])]
        if (clip.forYouPool === "explore" && !reasons.some((r) => /try something new/i.test(r))) {
          reasons.unshift("Try something new")
        }
        if (clip.forYouPool === "global" && !reasons.length) {
          reasons.push("Trending right now")
        }
        return { ...clip, forYouReasons: dedupeReasons(reasons).slice(0, 3) }
      })
    }

    return applyVariety(mixed)
  }, [clips, fandomClips, liked, saved, selectedList, forYouProfile, user?.id, listStatusesReady, notInterested])

  const allClips = useMemo(() => {
    if (contentMode === "official") return clips
    if (contentMode === "fandom") return fandomClips
    return forYouClips
  }, [clips, fandomClips, forYouClips, contentMode])

  const listedMediaIds = useMemo(
    () => new Set(Object.keys(selectedList).map((id) => Number(id)).filter(Boolean)),
    [selectedList],
  )

  const discoverClips = useMemo(() => {
    if (!user) return allClips
    if (!listStatusesReady) return []
    return allClips.filter((clip) => {
      const animeId = Number(clip.animeId)
      if (listedMediaIds.has(animeId)) return false
      if (notInterested?.[String(animeId)]) return false
      return true
    })
  }, [allClips, user, listedMediaIds, listStatusesReady, notInterested])

  const filteredClips = useMemo(() => {
    if (!activeVibes.length) return discoverClips
    return discoverClips.filter((clip) => clip.tags?.some((tag) => activeVibes.includes(tag)))
  }, [discoverClips, activeVibes])

  const currentClip = filteredClips[currentIndex]
  const currentClipKey = currentClip ? getClipKey(currentClip) : null
  const currentForYouReasons = contentMode === "for-you" ? currentClip?.forYouReasons || [] : []
  const activeForYouReason = currentForYouReasons.length
    ? currentForYouReasons[reasonIndex % currentForYouReasons.length]
    : ""
  const listFilteredOutEverything =
    Boolean(user) && listStatusesReady && allClips.length > 0 && discoverClips.length === 0
  const shouldBlur =
    currentClip && spoilersOff && currentClip.spoilerLevel !== "None" && !showSpoilerContent
  const isFandomClip = currentClip?.type === "Fandom"
  const playerId = useMemo(() => {
    if (!currentClipKey) return null
    return `discover-player-${String(currentClipKey).replace(/[^a-zA-Z0-9_-]+/g, "-")}`
  }, [currentClipKey])

  useEffect(() => {
    currentClipRef.current = currentClip || null
    clipStartedAtRef.current = Date.now()
  }, [currentClipKey])

  useEffect(() => {
    filteredClipsRef.current = filteredClips
  }, [filteredClips])

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    shouldBlurRef.current = Boolean(shouldBlur)
  }, [shouldBlur])

  useEffect(() => {
    isTransitioningRef.current = Boolean(isTransitioning)
  }, [isTransitioning])

  useEffect(() => {
    if (shouldBlur) {
      wasPlayingBeforeSpoilerRef.current = isPlaying
      if (isPlaying) setIsPlaying(false)
      return
    }

    if (wasPlayingBeforeSpoilerRef.current) {
      wasPlayingBeforeSpoilerRef.current = false
      setIsPlaying(true)
    }
  }, [shouldBlur, isPlaying])
  const commentThreads = useMemo(() => {
    const roots = []
    const repliesByParent = {}
    comments.forEach((comment) => {
      if (comment.parent_id) {
        if (!repliesByParent[comment.parent_id]) repliesByParent[comment.parent_id] = []
        repliesByParent[comment.parent_id].push(comment)
      } else {
        roots.push(comment)
      }
    })
    return { roots, repliesByParent }
  }, [comments])

  useEffect(() => {
    if (!user?.id) {
      setSelectedList({})
      setListStatusesReady(true)
      return
    }

    let active = true
    const loadStatuses = async () => {
      if (active) {
        setListStatusesReady(false)
      }
      const statusMap = {}
      const { data, error } = await client
        .from("list_entries")
        .select("media_id, status")
        .eq("user_id", user.id)

      if (error) {
        console.warn("Failed to load list statuses:", error?.message || error)
        if (active) {
          setSelectedList({})
          setListStatusesReady(true)
        }
        return
      }

      ;(data || []).forEach((entry) => {
        statusMap[entry.media_id] = entry.status
      })

      if (active) {
        setSelectedList(statusMap)
        setListStatusesReady(true)
      }
    }

    loadStatuses()

    return () => {
      active = false
    }
  }, [user?.id])

  useEffect(() => {
    const sourceClips = [...clips, ...fandomClips]
    if (!user || !sourceClips.length) return

    let active = true
    const loadLikes = async () => {
      const ids = Array.from(new Set(sourceClips.map((clip) => clip.animeId))).filter(Boolean)
      if (!ids.length) return

      const batches = chunkIds(ids, 200)
      const likedMap = {}

      for (const batch of batches) {
        const { data, error } = await client
          .from("clip_likes")
          .select("media_id, trailer_id")
          .eq("user_id", user.id)
          .in("media_id", batch)

        if (error) {
          console.error("Failed to load liked clips:", error)
          continue
        }

        ;(data || []).forEach((entry) => {
          likedMap[`${entry.media_id}:${entry.trailer_id}`] = true
        })
      }

      if (active) {
        setLiked((prev) => ({ ...prev, ...likedMap }))
      }
    }

    loadLikes()

    return () => {
      active = false
    }
  }, [user, clips, fandomClips])

  useEffect(() => {
    if (!filteredClips.length || !hasMore || loadingMore || contentMode === "fandom") return
    if (currentIndex >= filteredClips.length - 4) {
      const now = Date.now()
      if (loadMoreInFlightRef.current) return
      if (loadMoreCooldownUntilRef.current && now < loadMoreCooldownUntilRef.current) return

      const nextPage = page + 1
      setPage(nextPage)
      setLoadingMore(true)
      let cancelled = false
      loadMoreInFlightRef.current = true

      const cached = readDiscoverCache(nextPage)
      if (cached?.items?.length) {
        setClips((prev) => {
          const seen = new Set(prev.map((clip) => clip.key))
          const next = [...prev]
          ;(cached.items || []).forEach((clip) => {
            if (!clip || seen.has(clip.key)) return
            seen.add(clip.key)
            next.push(clip)
          })
          return next
        })
        setHasMore(Boolean(cached.hasNextPage))
        setLoadingMore(false)
        loadMoreInFlightRef.current = false
        return () => {
          cancelled = true
        }
      }

      const fetchWithRetry = async (attempt = 0) => {
        const response = await fetch("/api/anilist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: DISCOVER_QUERY, variables: { page: nextPage, perPage: 30 } }),
        })
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("Retry-After"))
          const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : 900 * (attempt + 1)
          await new Promise((resolve) => setTimeout(resolve, delay))
          return fetchWithRetry(attempt + 1)
        }
        return response
      }

      ;(async () => {
        try {
          const res = await fetchWithRetry()
          if (cancelled) return
          let json = null
          try {
            json = await res.json()
          } catch {
            json = null
          }

          if (res.status === 429) {
            // Back off a bit so quick skipping doesn't spam AniList.
            loadMoreCooldownUntilRef.current = Date.now() + 12_000
            setFeedError("Rate limited. Please wait a moment and try again.")
            return
          }

          if (!res.ok || json?.errors) {
            throw new Error(json?.errors?.[0]?.message || "Failed to load more clips.")
          }

          const mediaList = json?.data?.Page?.media || []
          const hasNextPage = json?.data?.Page?.pageInfo?.hasNextPage ?? false
          const items = mediaList
            .map((media) => {
              const trailerId = getYouTubeId(media.trailer)
              if (!trailerId) return null
              const vibes = getVibes(media.genres || [], media.tags || [])
              const spoilerLevel = getSpoilerLevel(media.tags || [])
              return {
                key: `${media.id}:${trailerId}`,
                id: media.id,
                animeTitle: media.title?.english || media.title?.romaji || "Untitled",
                animeId: media.id,
                format: media.format || null,
                season: media.season || null,
                seasonYear: media.seasonYear || null,
                clipTitle: "Official Trailer",
                thumbnail: media.trailer?.thumbnail || media.bannerImage || media.coverImage?.extraLarge,
                type: "Official",
                spoilerLevel,
                episode: null,
                tags: vibes,
                likes: media.popularity || 0,
                comments: Math.max(10, Math.round((media.popularity || 0) / 40)),
                shares: Math.max(5, Math.round((media.popularity || 0) / 150)),
                description: (media.description || "").replace(/<[^>]+>/g, ""),
                genres: media.genres || [],
                tagNames: (media.tags || []).map((tag) => tag.name),
                trailerId,
              }
            })
            .filter(Boolean)

          writeDiscoverCache(nextPage, { items, hasNextPage, cachedAt: Date.now() })

          setClips((prev) => {
            const seen = new Set(prev.map((clip) => clip.key))
            const next = [...prev]
            items.forEach((clip) => {
              if (!seen.has(clip.key)) {
                seen.add(clip.key)
                next.push(clip)
              }
            })
            return next
          })
          setHasMore(hasNextPage)
        } catch (err) {
          console.error(err)
        } finally {
          if (!cancelled) setLoadingMore(false)
          loadMoreInFlightRef.current = false
        }
      })()

      return () => {
        cancelled = true
      }
    }
    return undefined
  }, [currentIndex, filteredClips.length, hasMore, loadingMore, page, contentMode])

  useEffect(() => {
    if (!filteredClips.length) return
    if (currentIndex >= filteredClips.length) {
      setCurrentIndex(Math.max(filteredClips.length - 1, 0))
    }
  }, [filteredClips, currentIndex])

  useEffect(() => {
    setCurrentIndex(0)
  }, [contentMode])

  useEffect(() => {
    setReasonIndex(0)
  }, [currentClipKey])

  useEffect(() => {
    if (!user) {
      setSaved({})
      return
    }

    let active = true
    const loadSaved = async () => {
      const { data, error } = await client.from("saved_clips").select("media_id").eq("user_id", user.id)
      if (error) {
        console.error("Failed to load saved clips:", error)
        return
      }
      if (!active) return
      const savedMap = {}
      ;(data || []).forEach((item) => {
        savedMap[item.media_id] = true
      })
      setSaved(savedMap)
    }

    loadSaved()

    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    if (!user?.id) {
      setLearnedProfile(null)
      return
    }

    const cached = readForYouProfileCache(user.id)
    if (cached && Date.now() - cached.cachedAt < FOR_YOU_PROFILE_TTL) {
      setLearnedProfile(cached.profile)
      return
    }

    let active = true
    const buildProfile = async () => {
      try {
        const [listResult, savedResult, likedResult] = await Promise.all([
          client.from("list_entries").select("media_id, status").eq("user_id", user.id),
          client.from("saved_clips").select("media_id").eq("user_id", user.id),
          client.from("clip_likes").select("media_id").eq("user_id", user.id),
        ])

        const mediaWeights = {}
        const applyWeight = (mediaId, delta) => {
          if (!mediaId || !Number.isFinite(delta) || delta === 0) return
          mediaWeights[mediaId] = (mediaWeights[mediaId] || 0) + delta
        }

        if (listResult.error) {
          console.error("Failed to load list profile:", listResult.error)
        } else {
          ;(listResult.data || []).forEach((entry) => {
            applyWeight(entry.media_id, statusPreferenceWeight[entry.status] || 0)
          })
        }

        if (savedResult.error) {
          console.error("Failed to load saved profile:", savedResult.error)
        } else {
          ;(savedResult.data || []).forEach((entry) => {
            applyWeight(entry.media_id, 2)
          })
        }

        if (likedResult.error) {
          console.error("Failed to load likes profile:", likedResult.error)
        } else {
          ;(likedResult.data || []).forEach((entry) => {
            applyWeight(entry.media_id, 3)
          })
        }

        const topMediaIds = Object.entries(mediaWeights)
          .filter(([, weight]) => weight > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 60)
          .map(([id]) => Number(id))
          .filter(Boolean)

        const genreWeights = {}
        const vibeWeights = {}
        const titleWeights = {}

        for (const batch of chunkIds(topMediaIds, 30)) {
          const response = await fetch("/api/anilist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: PROFILE_MEDIA_QUERY,
              variables: { ids: batch, perPage: batch.length },
            }),
          })

          if (!response.ok) {
            continue
          }

          const json = await response.json()
          const profileMedia = json?.data?.Page?.media || []
          profileMedia.forEach((media) => {
            const weight = mediaWeights[media.id] || 0
            if (!weight) return

            const title = media.title?.english || media.title?.romaji || null
            if (title) {
              titleWeights[title] = (titleWeights[title] || 0) + weight
            }

            const genres = media.genres || []
            const tags = media.tags || []
            genres.forEach((genre) => {
              const key = normalizeToken(genre)
              genreWeights[key] = (genreWeights[key] || 0) + weight
            })

            const vibes = getVibes(genres, tags)
            vibes.forEach((vibe) => {
              vibeWeights[vibe] = (vibeWeights[vibe] || 0) + weight * 1.1
            })
          })
        }

        const profile = {
          genreWeights,
          vibeWeights,
          topGenres: Object.entries(genreWeights)
            .filter(([, value]) => value > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([genre]) => genre)
            .slice(0, 4),
          topVibes: Object.entries(vibeWeights)
            .filter(([, value]) => value > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([vibe]) => vibe)
            .slice(0, 4),
          seedTitles: Object.entries(titleWeights)
            .filter(([, value]) => value > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([title]) => title)
            .slice(0, 6),
        }

        if (!active) return
        setLearnedProfile(profile)
        writeForYouProfileCache(user.id, { cachedAt: Date.now(), profile })
      } catch (error) {
        if (active) {
          console.error("Failed to build For You profile:", error)
        }
      }
    }

    buildProfile()

    return () => {
      active = false
    }
  }, [user?.id])
  const fetchComments = useCallback(async () => {
    if (!currentClip) return
    setCommentsLoading(true)
    setCommentsError("")

    const { data, error } = await client
      .from("clip_comments")
      .select("id, user_id, comment_text, user_display_name, user_handle, user_avatar_url, created_at, updated_at, parent_id, is_removed")
      .eq("media_id", currentClip.animeId)
      .eq("trailer_id", currentClip.trailerId)
      .eq("is_removed", false)
      .order("created_at", { ascending: false })

    if (error) {
      if (isMissingRelation(error, "clip_comments")) {
        setCommentsError("Comments aren't set up yet. Run web/db/create-clip-comments.sql in Supabase.")
      } else {
        console.warn("Failed to load comments:", error?.message || error)
        setCommentsError("Could not load comments.")
      }
      setCommentsLoading(false)
      return
    }

    const nextComments = data || []
    const commentIds = nextComments.map((comment) => comment.id)

    let likesData = []
    if (commentIds.length) {
      const { data: likes, error: likesError } = await client
        .from("clip_comment_likes")
        .select("comment_id, user_id")
        .in("comment_id", commentIds)
      if (likesError) {
        console.error("Failed to load comment likes:", likesError)
      } else {
        likesData = likes || []
      }
    }

    const likesCountMap = {}
    const likedMap = {}
    likesData.forEach((like) => {
      likesCountMap[like.comment_id] = (likesCountMap[like.comment_id] || 0) + 1
      if (user && like.user_id === user.id) {
        likedMap[like.comment_id] = true
      }
    })

    const clipKey = getClipKey(currentClip)
    setComments(nextComments)
    setCommentLikes(likesCountMap)
    setCommentLiked(likedMap)
    setCommentCounts((prev) => ({
      ...prev,
      [clipKey]: nextComments.length,
    }))
    setCommentsLoading(false)
  }, [currentClip, user])

  const fetchCounts = useCallback(async () => {
    if (!currentClip) return
    const clipKey = getClipKey(currentClip)

    const { count: commentCount, error: commentError } = await client
      .from("clip_comments")
      .select("id", { count: "exact", head: true })
      .eq("media_id", currentClip.animeId)
      .eq("trailer_id", currentClip.trailerId)
      .eq("is_removed", false)

    if (commentError) {
      if (!isMissingRelation(commentError, "clip_comments")) {
        console.warn("Failed to load comment count:", commentError?.message || commentError)
      }
    }

    const { count: likeCount, error: likeError } = await client
      .from("clip_likes")
      .select("id", { count: "exact", head: true })
      .eq("media_id", currentClip.animeId)
      .eq("trailer_id", currentClip.trailerId)

    if (likeError) {
      if (!isMissingRelation(likeError, "clip_likes")) {
        console.warn("Failed to load like count:", likeError?.message || likeError)
      }
    }

    let likedByUser = false
    if (user) {
      const { data: likeRow, error: likedError } = await client
        .from("clip_likes")
        .select("id")
        .eq("user_id", user.id)
        .eq("media_id", currentClip.animeId)
        .eq("trailer_id", currentClip.trailerId)
        .maybeSingle()

      if (likedError) {
        if (!isMissingRelation(likedError, "clip_likes")) {
          console.warn("Failed to load like state:", likedError?.message || likedError)
        }
      }
      likedByUser = !!likeRow
    }

    setCommentCounts((prev) => ({
      ...prev,
      [clipKey]: typeof commentCount === "number" ? commentCount : prev[clipKey] || 0,
    }))
    setLikeCounts((prev) => ({
      ...prev,
      [clipKey]: typeof likeCount === "number" ? likeCount : prev[clipKey] || 0,
    }))
    if (user) {
      setLiked((prev) => ({ ...prev, [clipKey]: likedByUser }))
    }
  }, [currentClip, user])

  useEffect(() => {
    if (!commentsOpen) return
    fetchComments()
  }, [commentsOpen, fetchComments])

  useEffect(() => {
    if (typeof window === "undefined") return

    if (window.YT && window.YT.Player) {
      setYtReady(true)
      return
    }

    if (window.__hikariYtApiPromise) {
      window.__hikariYtApiPromise.then(() => setYtReady(true))
      return
    }

    window.__hikariYtApiPromise = new Promise((resolve) => {
      const script = document.createElement("script")
      script.src = "https://www.youtube.com/iframe_api"
      script.async = true
      script.onload = () => resolve()
      document.body.appendChild(script)
    })

    const prevHandler = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevHandler === "function") prevHandler()
      setYtReady(true)
    }
  }, [])

  const goToClip = useCallback(
    (newIndex, dir, targetKey = null) => {
      if (isTransitioning) return

      if (dir === "down") {
        const leavingClip = currentClipRef.current
        if (leavingClip) {
          const elapsedMs = Date.now() - (clipStartedAtRef.current || Date.now())
          let watchedSeconds = null
          const player = playerRef.current
          if (player && typeof player.getCurrentTime === "function") {
            try {
              watchedSeconds = player.getCurrentTime()
            } catch {
              watchedSeconds = null
            }
          }

          const quickSkip =
            (typeof watchedSeconds === "number" && watchedSeconds >= 0 && watchedSeconds < 2.25) || elapsedMs < 2200

          if (quickSkip) {
            applyDiscoverFeedback("quick_skip", leavingClip)
          }
        }
      }

      setIsTransitioning(true)
      setDirection(dir)

      setTimeout(() => {
        let resolvedIndex = newIndex
        if (targetKey) {
          const latest = filteredClipsRef.current || []
          const nextIndex = latest.findIndex((clip) => clip?.key === targetKey)
          if (nextIndex >= 0) resolvedIndex = nextIndex
        }

        setCurrentIndex(resolvedIndex)
        setShowSpoilerContent(false)
        setProgress(0)
        setAddToListOpen(false)
        setCommentsOpen(false)
        setCommentText("")
        setIsPlaying(true)
      }, 30)

      setTimeout(() => {
        setIsTransitioning(false)
      }, 300)
    },
    [isTransitioning, applyDiscoverFeedback],
  )

  const nextClip = useCallback(() => {
    if (!filteredClips.length) return
    if (currentIndex >= filteredClips.length - 1) {
      setIsPlaying(false)
      return
    }
    const newIndex = currentIndex + 1
    goToClip(newIndex, "down", filteredClips[newIndex]?.key || null)
  }, [currentIndex, filteredClips, goToClip])

  useEffect(() => {
    nextClipRef.current = nextClip
  }, [nextClip])

  const prevClip = useCallback(() => {
    if (!filteredClips.length) return
    if (currentIndex <= 0) return
    const newIndex = currentIndex - 1
    goToClip(newIndex, "up", filteredClips[newIndex]?.key || null)
  }, [currentIndex, filteredClips, goToClip])

  useEffect(() => {
    if (!ytReady || !playerId || !currentClip?.trailerId) return
    if (typeof window === "undefined" || !window.YT || !window.YT.Player) return

    // Only (re)create the player when the clip changes. Other state (mute/play/blur)
    // is handled via refs + dedicated effects, otherwise the iframe flashes constantly.
    if (playerRef.current?.destroy) {
      playerRef.current.destroy()
      playerRef.current = null
    }

    const player = new window.YT.Player(playerId, {
      videoId: currentClip.trailerId,
      playerVars: getPlayerVars(isMutedRef.current),
      events: {
        onReady: (event) => {
          if (isMutedRef.current) event.target.mute()
          else event.target.unMute()

          if (!isPlayingRef.current || shouldBlurRef.current) {
            event.target.pauseVideo()
          } else {
            event.target.playVideo()
          }
        },
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            applyDiscoverFeedback("complete", currentClipRef.current)
            if (!isTransitioningRef.current && typeof nextClipRef.current === "function") {
              nextClipRef.current()
            }
          }
        },
      },
    })

    playerRef.current = player

    return () => {
      if (playerRef.current?.destroy) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [ytReady, playerId, currentClip?.trailerId, applyDiscoverFeedback])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !player.playVideo) return
    if (isPlaying && !shouldBlur) {
      player.playVideo()
    } else {
      player.pauseVideo()
    }
  }, [isPlaying, shouldBlur, currentClipKey])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !player.mute) return
    if (isMuted) player.mute()
    else player.unMute()
  }, [isMuted, currentClipKey])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  const toggleVibe = (vibe) => {
    setActiveVibes((prev) => (prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe]))
  }

  const handleAddToList = async (clipId, listId) => {
    if (!user) return
    setListPendingId(clipId)
    const isNewEntry = !selectedList[clipId]
    const { error } = await client
      .from("list_entries")
      .upsert(
        {
          user_id: user.id,
          media_id: clipId,
          media_type: "ANIME",
          status: listId,
          progress: 0,
        },
        { onConflict: "user_id,media_id" },
      )

    if (!error) {
      setSelectedList((prev) => ({ ...prev, [clipId]: listId }))
      if (listId === "plan_to_watch") {
        const clipSnapshot = currentClipRef.current
        if (clipSnapshot && Number(clipSnapshot.animeId) === Number(clipId)) {
          applyDiscoverFeedback("plan_to_watch", clipSnapshot)
        }
      }
      if (isNewEntry) {
        awardXp(user, XP_ACTIONS.list_add, "list_add")
      }
    }
    setAddToListOpen(false)
    setListPendingId(null)
  }

  const handleRemoveFromList = async (clipId) => {
    if (!user) return
    setListPendingId(clipId)
    const { error } = await client.from("list_entries").delete().eq("user_id", user.id).eq("media_id", clipId)
    if (!error) {
      setSelectedList((prev) => {
        const next = { ...prev }
        delete next[clipId]
        return next
      })
    }
    setAddToListOpen(false)
    setListPendingId(null)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target
      const isTextInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      if (isTextInput) return
      if (e.key === "ArrowUp") {
        e.preventDefault()
        prevClip()
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        nextClip()
      }
      if (e.key === " ") {
        e.preventDefault()
        setIsPlaying((p) => !p)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [nextClip, prevClip])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e) => {
      e.preventDefault()
      if (Math.abs(e.deltaY) > 30) {
        if (e.deltaY > 0) nextClip()
        else prevClip()
      }
    }

    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => {
      container.removeEventListener("wheel", handleWheel)
    }
  }, [nextClip, prevClip])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let startY = 0
    let startTime = 0

    const handleTouchStart = (e) => {
      startY = e.touches[0].clientY
      startTime = Date.now()
    }

    const handleTouchEnd = (e) => {
      const endY = e.changedTouches[0].clientY
      const diff = startY - endY
      const timeDiff = Date.now() - startTime

      if ((Math.abs(diff) > 50 && timeDiff < 300) || Math.abs(diff) > 100) {
        if (diff > 0) nextClip()
        else prevClip()
      }
    }

    container.addEventListener("touchstart", handleTouchStart, { passive: true })
    container.addEventListener("touchend", handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchend", handleTouchEnd)
    }
  }, [nextClip, prevClip])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (listMenuRef.current && !listMenuRef.current.contains(e.target)) {
        setAddToListOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleToggleSave = async () => {
    if (!user || !currentClip) return
    const clipSnapshot = currentClip
    const clipId = clipSnapshot.animeId
    setSavePendingId(clipId)

    if (saved[clipId]) {
      const { error } = await client
        .from("saved_clips")
        .delete()
        .eq("user_id", user.id)
        .eq("media_id", clipId)
      if (!error) {
        setSaved((prev) => {
          const next = { ...prev }
          delete next[clipId]
          return next
        })
      }
      setSavePendingId(null)
      return
    }

    const { error } = await client.from("saved_clips").upsert(
      {
        user_id: user.id,
        media_id: clipId,
        trailer_id: clipSnapshot.trailerId,
        media_title: clipSnapshot.animeTitle,
        thumbnail_url: clipSnapshot.thumbnail || null,
        clip_type: clipSnapshot.type,
      },
      { onConflict: "user_id,media_id" },
    )
    if (!error) {
      setSaved((prev) => ({ ...prev, [clipId]: true }))
      applyDiscoverFeedback("save", clipSnapshot)
    }
    setSavePendingId(null)
  }

  const handleShare = async () => {
    if (!currentClip || typeof window === "undefined") return
    const shareUrl = `${window.location.origin}/media/${currentClip.animeId}`
    try {
      if (navigator.share) {
        await navigator.share({ title: currentClip.animeTitle, url: shareUrl })
        return
      }
      await navigator.clipboard.writeText(shareUrl)
      setShareNoticeId(currentClip.key)
      setTimeout(() => setShareNoticeId(null), 1600)
    } catch (error) {
      console.error("Share failed:", error)
    }
  }

  const handleToggleLike = () => {
    if (!currentClip || !user) return
    const clipSnapshot = currentClip
    const clipKey = getClipKey(clipSnapshot)
    if (likePendingId === clipKey) return
    const nextLiked = !liked[clipKey]
    setLikePendingId(clipKey)

    const updateLocal = (value) => {
      setLiked((prev) => ({ ...prev, [clipKey]: value }))
      setLikeCounts((prev) => {
        const base = typeof prev[clipKey] === "number" ? prev[clipKey] : clipSnapshot.likes || 0
        const nextValue = Math.max(base + (value ? 1 : -1), 0)
        return { ...prev, [clipKey]: nextValue }
      })
    }

    updateLocal(nextLiked)

    if (nextLiked) {
      setHeartAnimating(clipKey)
      setTimeout(() => setHeartAnimating(null), 800)
    }

    const run = async () => {
      if (nextLiked) {
        const { error } = await client.from("clip_likes").insert({
          user_id: user.id,
          media_id: clipSnapshot.animeId,
          trailer_id: clipSnapshot.trailerId,
        })
        if (error) {
          console.error("Failed to like clip:", error)
          updateLocal(false)
        } else {
          applyDiscoverFeedback("like", clipSnapshot)
        }
      } else {
        const { error } = await client
          .from("clip_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("media_id", clipSnapshot.animeId)
          .eq("trailer_id", clipSnapshot.trailerId)
        if (error) {
          console.error("Failed to unlike clip:", error)
          updateLocal(true)
        }
      }
      setLikePendingId(null)
    }

    run()
  }

  const postComment = async ({ text, parentId = null }) => {
    if (!user || !currentClip) return null
    const trimmed = text.trim()
    if (!trimmed) return null

    const displayName =
      user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || "User"
    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || null

    setCommentPending(true)
    const { data, error } = await client
      .from("clip_comments")
      .insert({
        user_id: user.id,
        media_id: currentClip.animeId,
        trailer_id: currentClip.trailerId,
        parent_id: parentId,
        comment_text: trimmed,
        user_display_name: displayName,
        user_handle: user?.user_metadata?.username || user?.user_metadata?.handle || null,
        user_avatar_url: avatarUrl,
      })
      .select("id, user_id, comment_text, user_display_name, user_handle, user_avatar_url, created_at, updated_at, parent_id")
      .single()

    if (error) {
      console.error("Failed to post comment:", error)
      setCommentPending(false)
      return null
    }

    const clipKey = getClipKey(currentClip)
    setComments((prev) => {
      const next = [data, ...prev]
      setCommentCounts((counts) => ({
        ...counts,
        [clipKey]: next.length,
      }))
      return next
    })
    setCommentPending(false)
    return data
  }

  const handleSubmitComment = async () => {
    const posted = await postComment({ text: commentText })
    if (posted) setCommentText("")
  }

  const handleSubmitReply = async () => {
    if (!replyToId) return
    const posted = await postComment({ text: replyText, parentId: replyToId })
    if (posted) {
      setReplyText("")
      setReplyToId(null)
    }
  }

  const handleToggleCommentLike = async (commentId) => {
    if (!user) return
    setCommentActionPending((prev) => ({ ...prev, [commentId]: true }))
    const alreadyLiked = !!commentLiked[commentId]

    if (alreadyLiked) {
      const { error } = await client
        .from("clip_comment_likes")
        .delete()
        .eq("user_id", user.id)
        .eq("comment_id", commentId)
      if (!error) {
        setCommentLiked((prev) => ({ ...prev, [commentId]: false }))
        setCommentLikes((prev) => ({
          ...prev,
          [commentId]: Math.max((prev[commentId] || 0) - 1, 0),
        }))
      }
    } else {
      const { error } = await client.from("clip_comment_likes").insert({
        user_id: user.id,
        comment_id: commentId,
      })
      if (!error) {
        setCommentLiked((prev) => ({ ...prev, [commentId]: true }))
        setCommentLikes((prev) => ({
          ...prev,
          [commentId]: (prev[commentId] || 0) + 1,
        }))
      }
    }

    setCommentActionPending((prev) => ({ ...prev, [commentId]: false }))
  }

  const handleDeleteComment = async (commentId) => {
    if (!user || !currentClip) return
    setCommentActionPending((prev) => ({ ...prev, [commentId]: true }))
    const { error } = await client
      .from("clip_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", user.id)
    if (!error) {
      const clipKey = getClipKey(currentClip)
      setComments((prev) => {
        const next = prev.filter((comment) => comment.id !== commentId && comment.parent_id !== commentId)
        setCommentCounts((counts) => ({
          ...counts,
          [clipKey]: next.length,
        }))
        return next
      })
    }
    setCommentActionPending((prev) => ({ ...prev, [commentId]: false }))
  }

  const handleStartEdit = (comment) => {
    setEditCommentId(comment.id)
    setEditText(comment.comment_text)
  }

  const handleSaveEdit = async () => {
    if (!user || !editCommentId) return
    const trimmed = editText.trim()
    if (!trimmed) return
    setCommentActionPending((prev) => ({ ...prev, [editCommentId]: true }))
    const { data, error } = await client
      .from("clip_comments")
      .update({ comment_text: trimmed })
      .eq("id", editCommentId)
      .eq("user_id", user.id)
      .select("id, user_id, comment_text, user_display_name, user_handle, user_avatar_url, created_at, updated_at, parent_id")
      .single()
    if (!error && data) {
      setComments((prev) => prev.map((comment) => (comment.id === data.id ? data : comment)))
      setEditCommentId(null)
      setEditText("")
    }
    setCommentActionPending((prev) => ({ ...prev, [editCommentId]: false }))
  }

  const handleReportComment = async (comment) => {
    if (!user || !currentClip || !comment?.id) return
    setReportingCommentId(comment.id)
    try {
      await reportContent({
        reporterId: user.id,
        targetType: "clip_comment",
        targetId: comment.id,
        targetLabel: comment.comment_text?.slice(0, 140),
        targetUrl: `/discover`,
        targetUserId: comment.user_id,
        targetUserHandle: comment.user_handle,
        targetUserDisplayName: comment.user_display_name,
        targetUserAvatarUrl: comment.user_avatar_url,
      })
      addNotification(user.id, {
        title: "Comment reported",
        message: "Thanks for letting us know. We'll review it.",
        type: "report",
      })
    } catch (error) {
      addNotification(user.id, {
        title: "Report failed",
        message: error.message || "Could not report this comment.",
        type: "report",
      })
    } finally {
      setReportingCommentId(null)
    }
  }

  const handleReportClip = async () => {
    if (!user || !currentClip) return
    const targetId = currentClip.id || null
    setReportingClipId(currentClip.key)
    try {
      await reportContent({
        reporterId: user.id,
        targetType: "clip",
        targetId,
        targetLabel: currentClip.clipTitle || currentClip.animeTitle,
        targetUrl: currentClip.type === "Fandom" ? `/hub/${toSlug(currentClip.fandomTag || currentClip.animeTitle)}` : `/media/${currentClip.animeId}`,
        targetUserId: currentClip.creator?.id || null,
        targetUserHandle: currentClip.creator?.username ? `@${currentClip.creator.username}` : null,
        targetUserDisplayName: currentClip.creator?.displayName || null,
        targetUserAvatarUrl: currentClip.creator?.avatar || null,
      })
      addNotification(user.id, {
        title: "Clip reported",
        message: "Thanks for letting us know. We'll review it.",
        type: "report",
      })
    } catch (error) {
      addNotification(user.id, {
        title: "Report failed",
        message: error.message || "Could not report this clip.",
        type: "report",
      })
    } finally {
      setReportingClipId(null)
    }
  }

  useEffect(() => {
    if (!currentClip) return
    const channel = client.channel(`discover-${currentClip.animeId}-${currentClip.trailerId}`)

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "clip_comments", filter: `media_id=eq.${currentClip.animeId}` },
      () => {
        fetchCounts()
        if (commentsOpen) fetchComments()
      },
    )

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "clip_comment_likes" },
      () => {
        if (commentsOpen) fetchComments()
      },
    )

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "clip_likes", filter: `media_id=eq.${currentClip.animeId}` },
      () => {
        fetchCounts()
      },
    )

    channel.subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [currentClip, commentsOpen, fetchComments, fetchCounts])

  const handleSubmitLink = async () => {
    if (!user) {
      setSubmitError("Sign in to submit a clip.")
      return
    }
    if (!submitLink.trim() || !submitAnime.trim()) {
      setSubmitError("Add both a link and an anime.")
      return
    }

    const parsed = parseVideoUrl(submitLink.trim())
    if (!parsed) {
      setSubmitError("Only YouTube links are supported right now.")
      return
    }

    setSubmitPending(true)
    setSubmitError("")

    try {
      let media = submitMedia
      if (!media) {
        const searchRes = await fetch("/api/anilist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: SEARCH_QUERY,
            variables: { search: submitAnime.trim(), page: 1, perPage: 5 },
          }),
        })
        const searchJson = await searchRes.json()
        const results = searchJson?.data?.Page?.media || []
        if (!searchRes.ok || searchJson?.errors || !results.length) {
          throw new Error(searchJson?.errors?.[0]?.message || "Anime not found.")
        }
        media = results[0]
      }
      const displayName =
        user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || "User"
      const handle = user?.user_metadata?.username || user?.user_metadata?.handle || null
      const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || null

      const { data, error } = await client
        .from("fandom_clips")
        .insert({
          user_id: user.id,
          media_id: media.id,
          media_title: media.title?.english || media.title?.romaji || submitAnime.trim(),
          clip_title: null,
          video_url: submitLink.trim(),
          video_site: parsed.site,
          video_id: parsed.id,
          thumbnail_url: parsed.thumbnail,
          tags: submitTags,
          spoiler_level: submitHasSpoilers ? "Mild" : "None",
          spoiler_episode: submitHasSpoilers && submitSpoilerEpisode ? Number(submitSpoilerEpisode) : null,
        status: "approved",
          user_display_name: displayName,
          user_handle: handle,
          user_avatar_url: avatarUrl,
        })
        .select(
          "id, media_id, media_title, clip_title, video_url, video_site, video_id, thumbnail_url, tags, spoiler_level, spoiler_episode, user_display_name, user_handle, user_avatar_url, created_at",
        )
        .single()

      if (error) {
        throw error
      }

      if (data) {
        awardXp(user, XP_ACTIONS.fandom_clip, "fandom_clip")
        const key = `${data.media_id}:${data.video_id}`
        setFandomClips((prev) => {
          if (prev.some((clip) => clip.key === key)) return prev
          return [
            {
              key,
              id: data.id,
              animeTitle: data.media_title,
              animeId: data.media_id,
              clipTitle: data.clip_title || "Fandom Clip",
              thumbnail: data.thumbnail_url || parsed.thumbnail || null,
              type: "Fandom",
              spoilerLevel: data.spoiler_level || "None",
              spoilerEpisode: data.spoiler_episode || null,
              episode: null,
              tags: data.tags || submitTags,
              likes: 0,
              comments: 0,
              shares: 0,
              description: data.clip_title || "Fandom submission.",
              genres: [],
              tagNames: data.tags || submitTags,
              trailerId: data.video_id,
              creator: {
                username: data.user_handle || handle || "fan",
                displayName: data.user_display_name || displayName,
                avatar: data.user_avatar_url || avatarUrl || null,
              },
              fandomTag: data.media_title,
            },
            ...prev,
          ]
        })
      }

      setSubmitDialogOpen(false)
      setSubmitLink("")
      setSubmitAnime("")
      setSubmitMedia(null)
      setSubmitSuggestions([])
      setSubmitSuggestionsOpen(false)
      setSubmitTags([])
      setSubmitHasSpoilers(false)
      setSubmitSpoilerEpisode("")
    } catch (error) {
      setSubmitError(error.message || "Submit failed.")
    } finally {
      setSubmitPending(false)
    }
  }

  useEffect(() => {
    if (!submitDialogOpen) return
    const query = submitAnime.trim()
    if (query.length < 2) {
      setSubmitSuggestions([])
      setSubmitSuggestionsOpen(false)
      setSubmitSuggestionsLoading(false)
      return
    }

    let active = true
    setSubmitSuggestionsLoading(true)
    const timer = setTimeout(async () => {
      try {
        const searchRes = await fetch("/api/anilist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: SEARCH_QUERY,
            variables: { search: query, page: 1, perPage: 6 },
          }),
        })
        const searchJson = await searchRes.json()
        const results = searchJson?.data?.Page?.media || []
        if (!searchRes.ok || searchJson?.errors) {
          throw new Error(searchJson?.errors?.[0]?.message || "Search failed.")
        }
        if (!active) return
        setSubmitSuggestions(results)
        setSubmitSuggestionsOpen(true)
      } catch (error) {
        if (!active) return
        setSubmitSuggestions([])
        setSubmitSuggestionsOpen(true)
        console.error("Search failed:", error)
      } finally {
        if (active) setSubmitSuggestionsLoading(false)
      }
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [submitAnime, submitDialogOpen])

  if (loadingFeed) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="flex min-h-screen items-center justify-center text-white/70">Loading discovery feed...</div>
      </div>
    )
  }

  if (feedError) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="flex min-h-screen items-center justify-center text-white/70 px-4 text-center">
          {feedError}
        </div>
      </div>
    )
  }

  const currentListOption = currentClip
    ? listOptions.find((option) => option.id === selectedList[currentClip.animeId])
    : null
  const currentLikeCount =
    currentClip && currentClipKey ? likeCounts[currentClipKey] ?? currentClip.likes ?? 0 : 0
  const currentCommentCount =
    currentClip && currentClipKey ? commentCounts[currentClipKey] ?? currentClip.comments ?? 0 : 0

  const renderComment = (comment, depth = 0) => {
    const replies = commentThreads.repliesByParent[comment.id] || []
    const displayName = comment.user_display_name || comment.user_handle || "User"
    const handle = comment.user_handle ? `@${comment.user_handle}` : null
    const isOwner = user && comment.user_id === user.id
    const isEditing = editCommentId === comment.id
    const isReplying = replyToId === comment.id
    const likeCount = commentLikes[comment.id] || 0
    const isPending = commentActionPending[comment.id]
    const showEdited = comment.updated_at && comment.updated_at !== comment.created_at

    return (
      <div key={comment.id} className={cn("flex gap-3", depth > 0 && "ml-6")}>
        <div className="h-9 w-9 rounded-full bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center text-xs font-semibold text-white/70 shrink-0">
          {comment.user_avatar_url ? (
            <img src={comment.user_avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>{displayName.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white">{displayName}</span>
            {handle && <span className="text-[10px] text-white/40">{handle}</span>}
            <span className="text-[10px] text-white/40">{formatShortDate(comment.created_at)}</span>
            {showEdited && <span className="text-[9px] text-white/30">Edited</span>}
          </div>
          {isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm px-3 py-2 h-20 resize-none"
              />
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  onClick={handleSaveEdit}
                  disabled={isPending || !editText.trim()}
                  className="px-3 py-1.5 rounded-full bg-white text-black disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditCommentId(null)
                    setEditText("")
                  }}
                  className="px-3 py-1.5 rounded-full text-white/50 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/70 mt-1 leading-snug whitespace-pre-line">{comment.comment_text}</p>
          )}

          <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
            <button
              onClick={() => handleToggleCommentLike(comment.id)}
              disabled={!user || isPending}
              className={cn(
                "flex items-center gap-1 transition-colors",
                commentLiked[comment.id] ? "text-rose-400" : "text-white/40 hover:text-white/70",
              )}
            >
              <Heart className={cn("h-3 w-3", commentLiked[comment.id] && "fill-rose-400")} />
              {formatNumber(likeCount)}
            </button>
            <button
              onClick={() => {
                setReplyToId(comment.id)
                setReplyText("")
                setEditCommentId(null)
              }}
              className="hover:text-white"
            >
              Reply
            </button>
            {user && (
              <button
                onClick={() => handleReportComment(comment)}
                disabled={reportingCommentId === comment.id}
                className="hover:text-white"
              >
                Report
              </button>
            )}
            {isOwner && !isEditing && (
              <button onClick={() => handleStartEdit(comment)} className="hover:text-white">
                Edit
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => handleDeleteComment(comment.id)}
                disabled={isPending}
                className="text-red-300 hover:text-red-200"
              >
                Delete
              </button>
            )}
          </div>

          {isReplying && (
            <div className="mt-2 flex items-center gap-2">
              <Input
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    handleSubmitReply()
                  }
                }}
                placeholder="Write a reply..."
                className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9 rounded-full px-3 text-xs"
              />
              <button
                onClick={handleSubmitReply}
                disabled={!replyText.trim() || commentPending}
                className="h-9 px-3 rounded-full bg-rose-500 text-white text-xs font-medium disabled:opacity-60"
              >
                Reply
              </button>
              <button
                onClick={() => {
                  setReplyToId(null)
                  setReplyText("")
                }}
                className="text-[11px] text-white/50 hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}

          {replies.length > 0 && <div className="mt-3 space-y-3">{replies.map((reply) => renderComment(reply, depth + 1))}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black overflow-hidden">
      <Navigation />

      <main className="fixed inset-0 pt-24 md:pt-24 flex flex-col overflow-hidden select-none">
        <div className="relative z-[60] px-4 pb-2 pointer-events-auto">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-center gap-2 flex-wrap">
            {contentModeOptions.map((mode) => {
              const Icon = mode.icon
              const isActive = contentMode === mode.id
              return (
                <button
                  key={mode.id}
                  onClick={() => setContentMode(mode.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all duration-300 ease-out",
                    isActive ? "bg-white text-black shadow-lg shadow-white/10" : "text-white/60 hover:text-white",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5 transition-transform duration-300", isActive && "scale-110")} />
                  <span className="hidden sm:inline">{mode.label}</span>
                </button>
              )
            })}

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all duration-300",
                "bg-white/5 backdrop-blur-md border border-white/10",
                showFilters || activeVibes.length > 0 ? "text-white" : "text-white/60 hover:text-white",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Vibes</span>
              {activeVibes.length > 0 && (
                <span className="ml-1 rounded-full bg-white/20 text-rose-300 text-[10px] px-2 py-0.5">
                  {activeVibes.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                const next = !spoilersOff
                setSpoilersOff(next)
                setShowSpoilerContent(false)
                if (!next) {
                  wasPlayingBeforeSpoilerRef.current = false
                  setIsPlaying(true)
                }
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all duration-300",
                "bg-white/5 backdrop-blur-md border border-white/10",
                spoilersOff ? "text-emerald-400" : "text-white/60",
              )}
            >
              {spoilersOff ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Shield</span>
            </button>

            {(contentMode === "fandom" || contentMode === "for-you") && (
              <Dialog
                open={submitDialogOpen}
                onOpenChange={(open) => {
                  setSubmitDialogOpen(open)
                  if (open && currentClip) {
                    setSubmitAnime(currentClip.animeTitle)
                  }
                  if (!open) {
                    setSubmitError("")
                    setSubmitMedia(null)
                    setSubmitSuggestions([])
                    setSubmitSuggestionsOpen(false)
                  }
                }}
              >
                <DialogTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-gradient-to-r from-rose-500/90 to-pink-500/90 text-white transition-all duration-300 hover:shadow-lg hover:shadow-rose-500/20 hover:scale-105">
                    <Upload className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Submit</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-950/95 backdrop-blur-xl border-white/10 text-white max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-rose-400" />
                      Submit a Link
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-white/70 text-xs">Video Link</Label>
                      <Input
                        placeholder="https://youtube.com/watch?v=..."
                        value={submitLink}
                        onChange={(e) => setSubmitLink(e.target.value)}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/70 text-xs">Anime / Fandom</Label>
                      <div className="relative">
                        <Input
                          placeholder="Search anime..."
                          value={submitAnime}
                          onChange={(e) => {
                            setSubmitAnime(e.target.value)
                            setSubmitMedia(null)
                          }}
                          onFocus={() => {
                            if (submitSuggestions.length) setSubmitSuggestionsOpen(true)
                          }}
                          onBlur={() => {
                            setTimeout(() => setSubmitSuggestionsOpen(false), 150)
                          }}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 rounded-xl text-sm"
                        />
                        {submitSuggestionsOpen && (
                          <div className="absolute z-50 mt-2 w-full rounded-xl border border-white/10 bg-zinc-950/95 backdrop-blur-xl shadow-xl">
                            {submitSuggestionsLoading ? (
                              <div className="flex items-center gap-2 px-3 py-2 text-xs text-white/50">
                                <div className="h-3 w-3 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                Searching...
                              </div>
                            ) : submitSuggestions.length ? (
                              <div className="max-h-56 overflow-y-auto">
                                {submitSuggestions.map((result) => {
                                  const title = result.title?.english || result.title?.romaji || "Untitled"
                                  const thumb = result.coverImage?.large || result.coverImage?.extraLarge
                                  return (
                                    <button
                                      key={result.id}
                                      type="button"
                                      onMouseDown={(event) => {
                                        event.preventDefault()
                                        setSubmitAnime(title)
                                        setSubmitMedia(result)
                                        setSubmitSuggestionsOpen(false)
                                      }}
                                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-xs text-white/80 hover:bg-white/5 transition-colors"
                                    >
                                      <div className="h-8 w-6 rounded-md bg-white/5 overflow-hidden flex items-center justify-center">
                                        {thumb ? (
                                          <img src={thumb} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                          <span className="text-[10px] text-white/40">No Art</span>
                                        )}
                                      </div>
                                      <span className="flex-1 truncate">{title}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="px-3 py-2 text-xs text-white/50">No results</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/70 text-xs">Vibe Tags</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {vibeFilters.map((vibe) => {
                          const Icon = vibe.icon
                          const isSelected = submitTags.includes(vibe.id)
                          return (
                            <button
                              key={vibe.id}
                              onClick={() =>
                                setSubmitTags((prev) =>
                                  isSelected ? prev.filter((t) => t !== vibe.id) : [...prev, vibe.id],
                                )
                              }
                              className={cn(
                                "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200",
                                isSelected
                                  ? `bg-gradient-to-r ${vibe.color} text-white`
                                  : "bg-white/10 text-white/50 hover:text-white",
                              )}
                            >
                              <Icon className="h-3 w-3" />
                              {vibe.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="submit-spoilers"
                        checked={submitHasSpoilers}
                        onCheckedChange={(checked) => setSubmitHasSpoilers(checked)}
                        className="border-white/20 data-[state=checked]:bg-rose-500"
                      />
                      <Label htmlFor="submit-spoilers" className="cursor-pointer text-white/70 text-xs">
                        Contains spoilers
                      </Label>
                    </div>
                    {submitHasSpoilers && (
                      <div className="space-y-1.5">
                        <Label className="text-white/70 text-xs">Spoilers up to episode</Label>
                        <Input
                          placeholder="e.g. 12"
                          value={submitSpoilerEpisode}
                          onChange={(e) => setSubmitSpoilerEpisode(e.target.value)}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 rounded-xl text-sm"
                        />
                      </div>
                    )}
                    {submitError && <p className="text-xs text-red-400">{submitError}</p>}
                    <Button
                      onClick={handleSubmitLink}
                      disabled={!submitLink.trim() || !submitAnime.trim() || submitPending}
                      className="w-full h-10 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-sm font-medium"
                    >
                      {submitPending ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="h-3.5 w-3.5" />
                          Submit
                        </span>
                      )}
                    </Button>
                    {!user && <p className="text-[11px] text-white/40">Sign in to submit fandom clips.</p>}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-out",
              showFilters ? "max-h-24 opacity-100 mt-3" : "max-h-0 opacity-0",
            )}
          >
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {vibeFilters.map((vibe) => {
                const Icon = vibe.icon
                const isActive = activeVibes.includes(vibe.id)
                return (
                  <button
                    key={vibe.id}
                    onClick={() => toggleVibe(vibe.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                      isActive
                        ? `bg-gradient-to-r ${vibe.color} text-white shadow-lg`
                        : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {vibe.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div ref={containerRef} className="relative flex-1 z-10">
          {!filteredClips.length && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
              <div className="max-w-sm rounded-2xl border border-white/10 bg-black/60 px-6 py-5 text-white/70">
                {user && !listStatusesReady ? (
                  <>
                    <p className="text-sm font-medium text-white">Building your Discover feed...</p>
                    <p className="mt-2 text-xs text-white/50">
                      Filtering out titles already on your list so they never show up here.
                    </p>
                    <div className="mt-4 flex items-center justify-center">
                      <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-white">No clips yet</p>
                    <p className="mt-2 text-xs text-white/50">
                      {contentMode === "fandom"
                        ? "Be the first to submit a fandom clip."
                        : listFilteredOutEverything
                          ? "You're caught up. Discover only shows new titles not already on your list."
                          : "Try switching filters or content mode."}
                    </p>
                  </>
                )}

                {(!user || listStatusesReady) && (contentMode === "fandom" || contentMode === "for-you") && (
                  <button
                    onClick={() => setSubmitDialogOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-xs font-medium text-white hover:bg-rose-600"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Submit a clip
                  </button>
                )}
              </div>
            </div>
          )}
          {filteredClips.map((clip, index) => {
            const isActive = index === currentIndex
            const isPrev = direction === "down" ? index < currentIndex : index > currentIndex
            return (
              <div
                key={clip.key}
                className={cn(
                  "absolute inset-0 will-change-transform",
                  isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none",
                )}
                style={{
                  transform: isActive ? "translateY(0)" : isPrev ? "translateY(-100%)" : "translateY(100%)",
                  transition: "transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 250ms ease-out",
                }}
              >
                {/* Keep the background calm/consistent; the blurred poster was creating a big "separator" band. */}
                <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950 to-black" />

                {isActive && (
                  <div className="absolute inset-0 flex items-start justify-center pt-4 md:pt-6">
                    <div className="w-full max-w-[400px] aspect-[9/16] rounded-3xl overflow-hidden bg-black shadow-2xl shadow-black/50 ring-1 ring-white/10">
                      <div id={playerId} className="h-full w-full" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {shouldBlur && currentClip && (
            <div className="absolute inset-0 flex items-center justify-center z-20 px-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-zinc-900/95 backdrop-blur-2xl rounded-3xl p-8 text-center w-80 border border-white/10 shadow-2xl shadow-black/50">
                <div className="h-16 w-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-5">
                  <EyeOff className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Spoiler Alert</h3>
                <p className="text-white/50 text-sm mb-6">
                  This clip contains{" "}
                  <span className="text-red-400 font-medium">{currentClip.spoilerLevel.toLowerCase()}</span> spoilers
                  {currentClip.spoilerEpisode && (
                    <span className="block mt-1 text-white/40">Up to Episode {currentClip.spoilerEpisode}</span>
                  )}
                </p>
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => setShowSpoilerContent(true)}
                    className="w-full bg-white text-black hover:bg-white/90 rounded-full h-12 text-sm font-medium gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Show Anyway
                  </Button>
                  <button
                    onClick={nextClip}
                    className="w-full text-white/50 hover:text-white text-sm font-medium py-2 transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          )}

          {!shouldBlur && (
            <button
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 flex items-center justify-center z-10"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              <div
                className={cn(
                  "h-16 w-16 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center transition-all duration-300",
                  isPlaying ? "opacity-0 scale-50" : "opacity-100 scale-100",
                )}
              >
                {isPlaying ? (
                  <Pause className="h-8 w-8 text-white" fill="white" />
                ) : (
                  <Play className="h-8 w-8 text-white ml-1" fill="white" />
                )}
              </div>
            </button>
          )}

          {currentClip && (
            <div
              className={cn(
                "absolute bottom-24 md:bottom-20 left-4 right-20 md:left-6 md:right-auto md:max-w-sm z-20",
                "transition-all duration-300 ease-out",
                isTransitioning ? "opacity-0 translate-y-3" : "opacity-100 translate-y-0",
              )}
            >
              {isFandomClip && currentClip.creator && (
                <Link
                  href={`/hub/${toSlug(currentClip.fandomTag || currentClip.animeTitle)}`}
                  className="inline-flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/15 transition-colors"
                >
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center text-white text-xs font-medium">
                    {currentClip.creator.displayName.slice(0, 1)}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-medium text-white leading-tight">{currentClip.creator.displayName}</p>
                    <p className="text-[10px] text-white/50">@{currentClip.creator.username}</p>
                  </div>
                  <Badge className="ml-2 bg-rose-500/20 text-rose-300 border-0 text-[10px] px-2 py-0.5">
                    {currentClip.fandomTag}
                  </Badge>
                </Link>
              )}

              <Link
                href={
                  isFandomClip
                    ? `/hub/${toSlug(currentClip.fandomTag || currentClip.animeTitle)}`
                    : `/media/${currentClip.animeId}`
                }
              >
                <h2 className="text-xl md:text-2xl font-bold text-white mb-0.5 hover:text-white/80 transition-colors leading-tight">
                  {currentClip.animeTitle}
                </h2>
              </Link>
              <p className="text-white/70 text-sm mb-2">{currentClip.clipTitle}</p>

              {contentMode === "for-you" && activeForYouReason && (
                <button
                  onClick={() =>
                    setReasonIndex((prev) => (currentForYouReasons.length ? (prev + 1) % currentForYouReasons.length : 0))
                  }
                  className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-500/15 transition-colors"
                >
                  <Sparkles className="h-3 w-3 text-emerald-300" />
                  <span className="truncate max-w-[260px]">{activeForYouReason}</span>
                  {currentForYouReasons.length > 1 && (
                    <span className="rounded-full bg-emerald-300/15 px-1.5 py-0.5 text-[10px] text-emerald-200">
                      {reasonIndex % currentForYouReasons.length + 1}/{currentForYouReasons.length}
                    </span>
                  )}
                </button>
              )}

              <div className="flex flex-wrap gap-1.5 mb-4">
                {(currentClip.tags || []).slice(0, 3).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleVibe(tag)}
                    className={cn(
                      "text-xs font-medium transition-colors",
                      activeVibes.includes(tag) ? "text-rose-400" : "text-rose-400/60 hover:text-rose-400",
                    )}
                  >
                    #{tag}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative" ref={listMenuRef}>
                  <Button
                    size="sm"
                    disabled={!user || listPendingId === currentClip.animeId}
                    onClick={() => setAddToListOpen(!addToListOpen)}
                    className={cn(
                      "gap-1.5 rounded-full px-4 h-9 text-xs transition-all duration-200",
                      currentListOption
                        ? "bg-white/15 hover:bg-white/20 text-white"
                        : "bg-white hover:bg-white/90 text-black",
                    )}
                  >
                    {currentListOption ? (
                      <>
                        <currentListOption.icon className={cn("h-3.5 w-3.5", currentListOption.color)} />
                        {currentListOption.label}
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </>
                    )}
                  </Button>

                  <div
                    className={cn(
                      "absolute bottom-full left-0 mb-2 w-44 transition-all duration-200 origin-bottom-left",
                      addToListOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none",
                    )}
                  >
                    <div className="bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden p-1">
                      {listOptions.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => handleAddToList(currentClip.animeId, option.id)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors",
                            selectedList[currentClip.animeId] === option.id
                              ? "bg-white/15 text-white"
                              : "text-white/60 hover:text-white hover:bg-white/10",
                          )}
                        >
                          <option.icon className={cn("h-3.5 w-3.5", option.color)} />
                          {option.label}
                          {selectedList[currentClip.animeId] === option.id && (
                            <Check className="h-3.5 w-3.5 ml-auto text-rose-400" />
                          )}
                        </button>
                      ))}
                      {selectedList[currentClip.animeId] && (
                        <>
                          <div className="my-1 border-t border-white/10" />
                          <button
                            onClick={() => handleRemoveFromList(currentClip.animeId)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-red-300 hover:bg-red-500/10 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <Link
                  href={
                    isFandomClip
                      ? `/hub/${toSlug(currentClip.fandomTag || currentClip.animeTitle)}`
                      : `/media/${currentClip.animeId}`
                  }
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    className={cn(
                      "gap-1.5 rounded-full px-4 h-9 text-xs border-0",
                      isFandomClip ? "bg-rose-500/80 hover:bg-rose-500 text-white" : "bg-white/15 hover:bg-white/20 text-white",
                    )}
                  >
                    {isFandomClip ? (
                      <>
                        <Users className="h-3.5 w-3.5" />
                        View Hub
                      </>
                    ) : (
                      "View Anime"
                    )}
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {currentClip && (
            <div
              className={cn(
                "absolute bottom-28 md:bottom-24 right-4 flex flex-col items-center gap-3 z-20",
                "transition-all duration-300 ease-out",
                isTransitioning ? "opacity-0 translate-x-2" : "opacity-100 translate-x-0",
              )}
            >
              <button
                onClick={handleToggleLike}
                disabled={!user || likePendingId === currentClipKey}
                className="flex flex-col items-center gap-1 group relative disabled:opacity-50"
              >
                <div
                  className={cn(
                    "h-11 w-11 rounded-full flex items-center justify-center transition-all duration-200",
                    liked[currentClipKey]
                      ? "bg-red-500"
                      : "bg-white/10 backdrop-blur-sm group-hover:bg-white/20",
                    heartAnimating === currentClipKey && "animate-pulse",
                  )}
                >
                  <Heart
                    className={cn(
                      "h-5 w-5 transition-all duration-200",
                      liked[currentClipKey] ? "text-white fill-white" : "text-white",
                      heartAnimating === currentClipKey && "scale-125",
                    )}
                  />
                </div>
                {heartAnimating === currentClipKey && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="absolute animate-ping">
                      <Heart className="h-8 w-8 text-red-500 fill-red-500 opacity-75" />
                    </div>
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute h-2 w-2 bg-red-500 rounded-full animate-bounce"
                        style={{
                          transform: `rotate(${i * 60}deg) translateY(-20px)`,
                          animationDelay: `${i * 50}ms`,
                          animationDuration: "400ms",
                        }}
                      />
                    ))}
                  </div>
                )}
                <span className={cn("text-[10px] font-medium", liked[currentClipKey] ? "text-red-400" : "text-white/70")}>
                  {formatNumber(currentLikeCount)}
                </span>
              </button>

              <button onClick={() => setCommentsOpen(true)} className="flex flex-col items-center gap-1 group">
                <div
                  className={cn(
                    "h-11 w-11 rounded-full flex items-center justify-center transition-all duration-200",
                    commentsOpen ? "bg-white/20" : "bg-white/10 backdrop-blur-sm group-hover:bg-white/20",
                  )}
                >
                  <MessageCircle className="h-5 w-5 text-white" />
                </div>
                <span className="text-[10px] text-white/70 font-medium">{formatNumber(currentCommentCount)}</span>
              </button>

              <button
                onClick={handleToggleSave}
                disabled={!user || savePendingId === currentClip.animeId}
                className="flex flex-col items-center gap-1 group disabled:opacity-50"
              >
                <div
                  className={cn(
                    "h-11 w-11 rounded-full flex items-center justify-center transition-all duration-200",
                    saved[currentClip.animeId]
                      ? "bg-rose-500 scale-105"
                      : "bg-white/10 backdrop-blur-sm group-hover:bg-white/20",
                  )}
                >
                  <Bookmark
                    className={cn(
                      "h-5 w-5 transition-all",
                      saved[currentClip.animeId] ? "text-white fill-white" : "text-white",
                    )}
                  />
                </div>
              </button>

              <button
                onClick={() => {
                  if (!user || !currentClip) return
                  applyDiscoverFeedback("not_interested", currentClip)
                  nextClip()
                }}
                disabled={!user}
                className="flex flex-col items-center gap-1 group disabled:opacity-50"
                aria-label="Not interested"
                title="Not interested"
              >
                <div className="h-11 w-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center transition-all duration-200 group-hover:bg-white/20">
                  <X className="h-5 w-5 text-white" />
                </div>
                <span className="text-[10px] text-white/50">Hide</span>
              </button>

              <button onClick={handleShare} className="flex flex-col items-center gap-1 group">
                <div className="h-11 w-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center transition-all duration-200 group-hover:bg-white/20">
                  <Share2 className="h-5 w-5 text-white" />
                </div>
                <span className="text-[10px] text-white/50">{shareNoticeId === currentClip.key ? "Copied" : "Share"}</span>
              </button>

              <button
                onClick={handleReportClip}
                disabled={!user || reportingClipId === currentClip.key}
                className="flex flex-col items-center gap-1 group disabled:opacity-50"
              >
                <div className="h-11 w-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center transition-all duration-200 group-hover:bg-white/20">
                  <Flag className="h-5 w-5 text-white" />
                </div>
                <span className="text-[10px] text-white/50">Report</span>
              </button>

              <button onClick={() => setIsMuted(!isMuted)} className="mt-1">
                <div className="h-9 w-9 rounded-full bg-white/5 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:bg-white/10">
                  {isMuted ? (
                    <VolumeX className="h-4 w-4 text-white/50" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-white/50" />
                  )}
                </div>
              </button>
            </div>
          )}

          <div className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 flex-col gap-2 z-30">
            <button
              onClick={prevClip}
              disabled={isTransitioning || currentIndex === 0}
              className="h-10 w-10 rounded-full bg-white/5 backdrop-blur-sm flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
            <button
              onClick={nextClip}
              disabled={isTransitioning || currentIndex === filteredClips.length - 1}
              className="h-10 w-10 rounded-full bg-white/5 backdrop-blur-sm flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
          {commentsOpen && (
            <div className="absolute inset-x-4 bottom-4 md:inset-x-auto md:right-20 z-50 w-auto md:w-[380px] h-[40vh] max-h-[40vh] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-2 duration-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="text-sm font-medium text-white">{formatNumber(currentCommentCount)} Comments</span>
                <button
                  onClick={() => setCommentsOpen(false)}
                  className="p-1 -mr-1 text-white/40 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {commentsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="h-6 w-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  </div>
                ) : commentsError ? (
                  <p className="text-sm text-white/50">{commentsError}</p>
                ) : commentThreads.roots.length ? (
                  commentThreads.roots.map((comment) => renderComment(comment))
                ) : (
                  <p className="text-sm text-white/50">No comments yet. Be the first to reply.</p>
                )}
              </div>

              <div className="border-t border-white/10 p-3 space-y-2">
                {!user && <p className="text-[11px] text-white/40">Sign in to comment.</p>}
                <div className="flex items-center gap-2">
                  <Input
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        handleSubmitComment()
                      }
                    }}
                    placeholder="Add a comment..."
                    className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9 rounded-full px-3 text-xs"
                    disabled={!user || commentPending}
                  />
                  <button
                    onClick={handleSubmitComment}
                    disabled={!user || commentPending || !commentText.trim()}
                    className="h-9 w-9 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors shrink-0 disabled:opacity-60"
                  >
                    {commentPending ? (
                      <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5 text-white" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      