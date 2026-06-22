"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Heart, Bookmark, Share2, Play, Plus, ChevronUp, ChevronDown, 
  Flame, Sparkles, Zap, Wind, Moon, Check, Volume2, VolumeX,
  Star, Info, HeartIcon, Eye, EyeOff
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageLoader } from "@/components/ui/page-loader"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Navigation } from "@/components/layout/Navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getMediaHref, fetchAniListMediaByIds } from "@/lib/anilist"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"

// Vibe filters
const vibeFilters = [
  { id: "all", label: "For You", icon: Sparkles, color: "from-primary to-accent" },
  { id: "hype", label: "Hype", icon: Flame, color: "from-orange-500 to-red-500" },
  { id: "action", label: "Action", icon: Zap, color: "from-blue-500 to-cyan-500" },
  { id: "chill", label: "Chill", icon: Wind, color: "from-teal-500 to-emerald-500" },
  { id: "dark", label: "Dark", icon: Moon, color: "from-slate-600 to-slate-800" },
  { id: "romance", label: "Romance", icon: HeartIcon, color: "from-pink-500 to-rose-500" },
]

type DiscoverItem = {
  id: number
  title: string
  cover: string
  banner: string
  rating: number
  episodes: number
  description: string
  genres: string[]
  vibes: string[]
  popularity: number
  likes: number
  trailerId: string | null
}

const DISCOVER_SORT_PRESETS = [
  ["TRENDING_DESC", "POPULARITY_DESC"],
  ["POPULARITY_DESC", "TRENDING_DESC"],
  ["SCORE_DESC", "POPULARITY_DESC"],
  ["FAVOURITES_DESC", "POPULARITY_DESC"],
  ["START_DATE_DESC", "POPULARITY_DESC"],
]

const DISCOVER_QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $genreIn: [String], $idNotIn: [Int]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { currentPage hasNextPage lastPage }
    media(type: ANIME, sort: $sort, isAdult: false, genre_in: $genreIn, id_not_in: $idNotIn) {
      id
      title { romaji english }
      coverImage { extraLarge large }
      bannerImage
      trailer { id site thumbnail }
      averageScore
      episodes
      description(asHtml: false)
      genres
      tags { name }
      popularity
      favourites
    }
  }
}
`

const getVibes = (genres: Array<string | null> = [], tags: Array<{ name?: string | null }> = []) => {
  const vibeSet = new Set<string>()
  const lowerGenres = (Array.isArray(genres) ? genres : [])
    .filter(Boolean)
    .map((genre) => String(genre).toLowerCase())
  const tagNames = (Array.isArray(tags) ? tags : []).map((tag) => String(tag?.name || "").toLowerCase())

  if (lowerGenres.some((genre) => ["action", "adventure", "shounen"].includes(genre))) vibeSet.add("hype")
  if (lowerGenres.includes("action")) vibeSet.add("action")
  if (lowerGenres.some((genre) => ["slice of life", "iyashikei", "fantasy"].includes(genre))) vibeSet.add("chill")
  if (lowerGenres.some((genre) => ["psychological", "horror", "thriller"].includes(genre))) vibeSet.add("dark")
  if (lowerGenres.includes("romance")) vibeSet.add("romance")
  if (lowerGenres.includes("drama") || tagNames.includes("slow burn")) vibeSet.add("dark")

  return Array.from(vibeSet)
}

const getYouTubeId = (trailer: { id?: string | null; site?: string | null } | null | undefined) => {
  if (!trailer?.id || trailer?.site?.toLowerCase() !== "youtube") return null
  return trailer.id
}

const mapMediaToDiscoverItem = (media: any): DiscoverItem | null => {
  const trailerId = getYouTubeId(media?.trailer)
  if (!trailerId) return null

  return {
    id: media.id,
    title: media?.title?.english || media?.title?.romaji || "Untitled",
    cover:
      media?.coverImage?.extraLarge ||
      media?.coverImage?.large ||
      media?.bannerImage ||
      "/placeholder.svg",
    banner:
      media?.bannerImage ||
      media?.trailer?.thumbnail ||
      media?.coverImage?.extraLarge ||
      media?.coverImage?.large ||
      "/placeholder.svg",
    rating: typeof media?.averageScore === "number" ? Number((media.averageScore / 10).toFixed(1)) : 0,
    episodes: media?.episodes || 0,
    description: String(media?.description || "").replace(/<[^>]+>/g, ""),
    genres: Array.isArray(media?.genres) ? media.genres : [],
    vibes: getVibes(media?.genres || [], media?.tags || []),
    popularity: media?.popularity || 0,
    likes: media?.favourites || media?.popularity || 0,
    trailerId,
  }
}

const fallbackDiscoverFeed: DiscoverItem[] = []
const DISCOVER_PAGE_SIZE = 50
const DISCOVER_MIN_BUFFER = 18
const DISCOVER_INITIAL_PAGE_MIN = 1
const DISCOVER_INITIAL_PAGE_MAX = 12
const DISCOVER_MAX_PAGE_HOPS = 5

const shuffleDiscoverItems = <T,>(items: T[]) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
  return `${num}`
}

export default function DiscoverPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [discoverFeed, setDiscoverFeed] = useState<DiscoverItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [activeVibe, setActiveVibe] = useState("all")
  const [liked, setLiked] = useState<Record<number, boolean>>({})
  const [saved, setSaved] = useState<Record<number, boolean>>({})
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [spoilerSafe, setSpoilerSafe] = useState(false)
  const [isTrailerLoaded, setIsTrailerLoaded] = useState(false)
  const [showTrailerFrame, setShowTrailerFrame] = useState(false)
  const [isTrailerPlayerOpen, setIsTrailerPlayerOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const loadMoreInFlightRef = useRef(false)
  const discoverSortRef = useRef(
    DISCOVER_SORT_PRESETS[Math.floor(Math.random() * DISCOVER_SORT_PRESETS.length)]
  )
  const discoverStartPageRef = useRef(
    Math.floor(Math.random() * (DISCOVER_INITIAL_PAGE_MAX - DISCOVER_INITIAL_PAGE_MIN + 1)) + DISCOVER_INITIAL_PAGE_MIN
  )
  // Personalization: top genres from the user's list + ids to exclude (already tracked).
  const activeVibeRef = useRef("all")
  const personalGenresRef = useRef<string[]>([])
  const personalExcludeRef = useRef<number[]>([])
  const [personalizedReady, setPersonalizedReady] = useState(false)
  // Load the feed exactly once, after we know whether/how to personalize it,
  // so personalization never reloads (and cuts off) a trailer that's playing.
  const [tasteResolved, setTasteResolved] = useState(false)
  const feedLoadedRef = useRef(false)
  // Which media are already on the user's list (id -> status), to reflect the save button.
  const [savedStatus, setSavedStatus] = useState<Record<number, string>>({})
  const savingRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    activeVibeRef.current = activeVibe
  }, [activeVibe])

  const filteredFeed = activeVibe === "all"
    ? discoverFeed 
    : discoverFeed.filter(item => item.vibes.includes(activeVibe))

  const currentAnime = filteredFeed[currentIndex] || filteredFeed[0]
  const isDiscoverPending = !currentAnime && (loadingMore || discoverFeed.length === 0)

  const redirectToLogin = useCallback(() => {
    if (typeof window === "undefined") return
    const next = `${window.location.pathname}${window.location.search}`
    router.push(`/login?next=${encodeURIComponent(next)}`)
  }, [router])

  const ensureSignedIn = useCallback(() => {
    if (authLoading) return false
    if (user) return true
    redirectToLogin()
    return false
  }, [authLoading, redirectToLogin, user])

  const goToNext = useCallback(() => {
    if (isTransitioning || currentIndex >= filteredFeed.length - 1) return
    setIsTransitioning(true)
    setCurrentIndex(prev => prev + 1)
    setTimeout(() => setIsTransitioning(false), 500)
  }, [isTransitioning, currentIndex, filteredFeed.length])

  const goToPrev = useCallback(() => {
    if (isTransitioning || currentIndex <= 0) return
    setIsTransitioning(true)
    setCurrentIndex(prev => prev - 1)
    setTimeout(() => setIsTransitioning(false), 500)
  }, [isTransitioning, currentIndex])

  const toggleLike = (id: number) => {
    if (!ensureSignedIn()) return
    setLiked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const STATUS_LABELS: Record<string, string> = {
    watching: "Watching",
    completed: "Completed",
    plan_to_watch: "Plan to Watch",
    on_hold: "On Hold",
    dropped: "Dropped",
    rewatching: "Rewatching",
  }

  const toggleSave = async (id: number) => {
    if (!ensureSignedIn() || !user) return
    if (savingRef.current.has(id)) return
    const isSaved = Boolean(saved[id])
    const status = savedStatus[id]
    savingRef.current.add(id)
    try {
      if (!isSaved) {
        const { error } = await client.from("list_entries").upsert(
          { user_id: user.id, media_id: id, media_type: "ANIME", status: "plan_to_watch", progress: 0 },
          { onConflict: "user_id,media_id" },
        )
        if (error) throw error
        setSaved((prev) => ({ ...prev, [id]: true }))
        setSavedStatus((prev) => ({ ...prev, [id]: "plan_to_watch" }))
        toast.success("Added to Plan to Watch")
      } else if (status && status !== "plan_to_watch") {
        
        toast.info(`Already in your ${STATUS_LABELS[status] || "list"}`)
      } else {
        const { error } = await client
          .from("list_entries")
          .delete()
          .eq("user_id", user.id)
          .eq("media_id", id)
        if (error) throw error
        setSaved((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        setSavedStatus((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        toast.success("Removed from your list")
      }
    } catch {
      toast.error("Couldn't update your list. Please try again.")
    } finally {
      savingRef.current.delete(id)
    }
  }

  const toggleMute = () => {
    setIsMuted((prev) => !prev)
  }

  const toggleSpoilerSafe = () => {
    setSpoilerSafe((prev) => !prev)
  }

  const loadFeedPage = useCallback(async (nextPage: number, append = false) => {
    if (loadMoreInFlightRef.current) return
    loadMoreInFlightRef.current = true
    setLoadingMore(true)

    try {
      const requestPage = async (pageNumber: number) => {
        const usePersonal = activeVibeRef.current === "all" && personalGenresRef.current.length > 0
        const response = await fetch("/api/anilist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: DISCOVER_QUERY,
            variables: {
              page: pageNumber,
              perPage: DISCOVER_PAGE_SIZE,
              sort: discoverSortRef.current,
              genreIn: usePersonal ? personalGenresRef.current : null,
              idNotIn: usePersonal ? personalExcludeRef.current.slice(0, 100) : null,
            },
          }),
        })

        const json = await response.json()
        if (!response.ok || json?.errors) {
          throw new Error(json?.errors?.[0]?.message || "Failed to load discovery feed.")
        }

        return {
          json,
          items: shuffleDiscoverItems(
            ((json?.data?.Page?.media || [])
              .map((media: any) => {
                try {
                  return mapMediaToDiscoverItem(media)
                } catch {
                  return null // one malformed item must never break the whole feed
                }
              })
              .filter(Boolean) as DiscoverItem[])
          ),
          pageInfo: json?.data?.Page?.pageInfo,
        }
      }

      let resolved = await requestPage(nextPage)
      let hops = 0

      while (!resolved.items.length && resolved.pageInfo?.hasNextPage && hops < DISCOVER_MAX_PAGE_HOPS) {
        hops += 1
        resolved = await requestPage(Number(resolved.pageInfo?.currentPage || nextPage) + 1)
      }

      if (!resolved.items.length && !append && Number(resolved.pageInfo?.currentPage || nextPage) !== 1) {
        resolved = await requestPage(1)
      }

      if (resolved.items.length) {
        setDiscoverFeed((prev) => {
          if (!append) return resolved.items
          const seen = new Set(prev.map((item) => item.id))
          const merged = [...prev]
          resolved.items.forEach((item) => {
            if (seen.has(item.id)) return
            seen.add(item.id)
            merged.push(item)
          })
          return merged
        })
      } else if (!append) {
        setDiscoverFeed([])
      }

      setPage(Number(resolved.pageInfo?.currentPage || nextPage))
      setHasMore(Boolean(resolved.pageInfo?.hasNextPage))
    } catch (error) {
      if (!append) {
        setDiscoverFeed([])
      }
    } finally {
      loadMoreInFlightRef.current = false
      setLoadingMore(false)
    }
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") {
        if (currentIndex >= filteredFeed.length - 1) {
          if (hasMore && !loadingMore) {
            loadFeedPage(page + 1, true)
          }
        } else {
          goToNext()
        }
      }
      if (e.key === "ArrowUp" || e.key === "k") goToPrev()
      if (e.key === "l") currentAnime && toggleLike(currentAnime.id)
      if (e.key === "s") currentAnime && toggleSave(currentAnime.id)
      if (e.key === "m") toggleMute()
      if (e.key === "x") toggleSpoilerSafe()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentAnime, currentIndex, filteredFeed.length, goToNext, goToPrev, hasMore, loadFeedPage, loadingMore, page, toggleLike, toggleSave])

  // Scroll/swipe handling
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let touchStartY = 0
    let lastScrollTime = 0

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const now = Date.now()
      if (now - lastScrollTime < 500) return
      lastScrollTime = now

      if (e.deltaY > 50) goToNext()
      else if (e.deltaY < -50) goToPrev()
    }

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndY = e.changedTouches[0].clientY
      const diff = touchStartY - touchEndY

      if (Math.abs(diff) > 50) {
        if (diff > 0) goToNext()
        else goToPrev()
      }
    }

    container.addEventListener("wheel", handleWheel, { passive: false })
    container.addEventListener("touchstart", handleTouchStart)
    container.addEventListener("touchend", handleTouchEnd)

    return () => {
      container.removeEventListener("wheel", handleWheel)
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchend", handleTouchEnd)
    }
  }, [goToNext, goToPrev])

  // Initial load — runs once, only after personalization is resolved, so the
  // first feed is already personalized and nothing reloads mid-trailer.
  useEffect(() => {
    if (!tasteResolved || feedLoadedRef.current) return
    feedLoadedRef.current = true
    loadFeedPage(discoverStartPageRef.current)
  }, [tasteResolved, loadFeedPage])

  // Build a taste profile from the user's list: top genres (to bias the feed)
  // and the ids they already track (to exclude). Then refresh "For You".
  useEffect(() => {
    let active = true
    if (authLoading) return // wait for auth to resolve before deciding
    if (!user) {
      personalGenresRef.current = []
      personalExcludeRef.current = []
      setPersonalizedReady(false)
      setSavedStatus({})
      setSaved({})
      setTasteResolved(true) // signed out → load the generic feed
      return
    }

    const loadTaste = async () => {
      // The whole thing is wrapped so the feed ALWAYS loads (tasteResolved)
      // even if a query/fetch throws — otherwise Discover gets stuck loading.
      try {
        const { data, error } = await client
          .from("list_entries")
          .select("media_id, status, score, media_type, updated_at")
          .eq("user_id", user.id)
        if (!active) return
        if (error || !data?.length) return

        // Reflect which titles are already tracked on the save buttons.
        const statusMap: Record<number, string> = {}
        const savedMap: Record<number, boolean> = {}
        data.forEach((entry: any) => {
          statusMap[entry.media_id] = entry.status
          savedMap[entry.media_id] = true
        })
        if (active) {
          setSavedStatus(statusMap)
          setSaved(savedMap)
        }

        // Build a rating-aware taste profile: weight each title's genres by how
        // the user engaged with it (status), how recently, and how they rated it.
        const animeEntries = data.filter((e: any) => (e.media_type || "ANIME") === "ANIME")
        personalExcludeRef.current = Array.from(new Set(data.map((e: any) => e.media_id)))

        const mediaById = await fetchAniListMediaByIds(animeEntries.map((e: any) => e.media_id).slice(0, 120))
        const STATUS_WEIGHT: Record<string, number> = {
          completed: 1.2,
          watching: 1,
          rewatching: 1.1,
          plan_to_watch: 0.4,
          on_hold: 0.3,
          dropped: 0.1,
        }
        const genreWeights = new Map<string, number>()
        animeEntries.forEach((entry: any) => {
          const media = mediaById.get(entry.media_id)
          if (!media?.genres?.length) return
          const sw = STATUS_WEIGHT[entry.status] ?? 0.6
          const days = entry.updated_at ? (Date.now() - new Date(entry.updated_at).getTime()) / 86400000 : 999
          const recency = Math.max(0.4, 1 - days / 180)
          const score = Number(entry.score) || 0
          const rating = score > 0 ? Math.max(-0.2, 1 + (score - 7) * 0.18) : 1
          const weight = sw * recency * rating
          media.genres.forEach((g: string) => genreWeights.set(g, (genreWeights.get(g) || 0) + weight))
        })
        const topGenres = Array.from(genreWeights.entries())
          .filter(([, w]) => w > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name)
        if (!active) return
        personalGenresRef.current = topGenres
        if (topGenres.length) setPersonalizedReady(true)
      } catch {
        /* ignore — fall back to the generic feed */
      } finally {
        if (active) setTasteResolved(true) // now load the (personalized) feed
      }
    }

    loadTaste()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  useEffect(() => {
    if (!hasMore || loadingMore) return
    if (discoverFeed.length >= DISCOVER_MIN_BUFFER) return
    if (!discoverFeed.length && page !== 1) return
    loadFeedPage(page + 1, true)
  }, [discoverFeed.length, hasMore, loadingMore, page, loadFeedPage])

  useEffect(() => {
    if (!filteredFeed.length || !hasMore || loadingMore) return
    if (currentIndex >= filteredFeed.length - 6) {
      loadFeedPage(page + 1, true)
    }
  }, [currentIndex, filteredFeed.length, hasMore, loadingMore, page, loadFeedPage])

  useEffect(() => {
    if (!filteredFeed.length) return
    if (currentIndex >= filteredFeed.length) {
      setCurrentIndex(Math.max(filteredFeed.length - 1, 0))
    }
  }, [currentIndex, filteredFeed.length])

  useEffect(() => {
    setIsTrailerLoaded(false)
    setShowTrailerFrame(false)
    setIsTrailerPlayerOpen(false)
  }, [currentAnime?.id])

  useEffect(() => {
    if (spoilerSafe) return
    if (!isTrailerLoaded || !currentAnime?.trailerId) return
    const timeout = window.setTimeout(() => {
      setShowTrailerFrame(true)
    }, 700)
    return () => window.clearTimeout(timeout)
  }, [isTrailerLoaded, currentAnime?.trailerId, spoilerSafe])

  useEffect(() => {
    if (typeof window === "undefined") return
    const savedPreference = window.localStorage.getItem("hikari-discover-spoiler-safe")
    if (savedPreference === "1") {
      setSpoilerSafe(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("hikari-discover-spoiler-safe", spoilerSafe ? "1" : "0")
  }, [spoilerSafe])

  // YouTube embed URL with parameters
  const getYouTubeUrl = (trailerId: string) => {
    const params = new URLSearchParams({
      autoplay: "1",
      mute: isMuted ? "1" : "0",
      controls: "0",
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      loop: "1",
      playlist: trailerId,
      disablekb: "1",
      fs: "0",
      iv_load_policy: "3",
      cc_load_policy: "0",
    })
    return `https://www.youtube-nocookie.com/embed/${trailerId}?${params.toString()}`
  }

  const getControllableYouTubeUrl = (trailerId: string) => {
    const params = new URLSearchParams({
      autoplay: "1",
      mute: spoilerSafe ? "1" : isMuted ? "1" : "0",
      controls: "1",
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      disablekb: "0",
      fs: "1",
      iv_load_policy: "3",
      cc_load_policy: "0",
    })
    return `https://www.youtube-nocookie.com/embed/${trailerId}?${params.toString()}`
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div
        ref={containerRef}
        className="fixed inset-0 pt-16 lg:pt-20 overflow-hidden"
      >
{/* Main Content */}
      {currentAnime ? (
        <AnimatePresence mode="wait" initial={false}>
          {(
            <motion.div
              key={currentAnime.id}
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -100 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-0"
            >
              {/* Video Background */}
              <div className="absolute inset-0 bg-black">
                <Image
                  src={currentAnime.banner}
                  alt=""
                  fill
                  className="object-cover"
                  priority
                />
                {currentAnime.trailerId && !spoilerSafe ? (
                  <div
                    className={cn(
                      "absolute inset-0 overflow-hidden transition-opacity duration-700",
                      showTrailerFrame ? "opacity-100" : "opacity-0",
                    )}
                  >
                    <iframe
                      key={`${currentAnime.trailerId}-${isMuted ? "muted" : "sound"}`}
                      src={getYouTubeUrl(currentAnime.trailerId)}
                      onLoad={() => setIsTrailerLoaded(true)}
                      className="absolute left-1/2 top-1/2 h-[140vh] w-[180vw] -translate-x-1/2 -translate-y-1/2 border-0 pointer-events-none"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : null}
                
                {/* Gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30" />
              </div>

              {/* Content */}
              <div className="relative h-full flex items-end pb-24 lg:pb-32">
                <div className="container mx-auto px-4 lg:px-8">
                  <div className="max-w-xl space-y-4">
                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border border-white/10 bg-white/[0.08] text-white/[0.82]">
                        <Sparkles className="w-3 h-3 mr-1 text-white/[0.58]" />
                        {vibeFilters.find((vibe) => vibe.id === activeVibe)?.label || "For You"}
                      </Badge>
                      <Badge variant="outline" className="border-white/10 bg-white/[0.06] text-white/[0.78] backdrop-blur-sm">
                        <Star className="w-3 h-3 mr-1 fill-current text-white/[0.62]" />
                        {currentAnime.rating}
                      </Badge>
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md md:text-4xl lg:text-5xl">
                      {currentAnime.title}
                    </h1>

                    {/* Genres */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {currentAnime.genres.slice(0, 5).map(genre => (
                        <span key={genre} className="text-sm font-medium text-white/[0.68]">
                          {genre}
                        </span>
                      ))}
                    </div>

                    {/* Description */}
                    {spoilerSafe ? (
                      <div className="max-w-lg rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/[0.76] backdrop-blur-md">
                        <div className="flex items-center gap-2 text-white">
                          <EyeOff className="h-4 w-4 text-white/[0.62]" />
                          <span className="font-medium">Spoiler-safe mode is on</span>
                        </div>
                        <p className="mt-2 text-white/[0.62]">
                          Trailers and synopses are hidden until you turn spoilers back on.
                        </p>
                      </div>
                    ) : (
                      <p className="text-white/80 leading-relaxed line-clamp-2 text-sm md:text-base">
                        {currentAnime.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-white/70">
                      <span className="flex items-center gap-1.5">
                        <Play className="w-4 h-4" />
                        {currentAnime.episodes} EP
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Heart className="w-4 h-4" />
                        {formatNumber(currentAnime.likes)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        {formatNumber(currentAnime.popularity)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button 
                        size="lg"
                        className={cn(
                          "font-semibold shadow-md transition-all",
                          saved[currentAnime.id] 
                            ? "border border-white/[0.16] bg-white/[0.14] text-white hover:bg-white/[0.18]"
                            : "bg-primary hover:bg-primary/90 text-primary-foreground"
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!ensureSignedIn()) return
                          toggleSave(currentAnime.id)
                        }}
                      >
                        {saved[currentAnime.id] ? (
                          <>
                            <Check className="w-5 h-5 mr-2" />
                            Added
                          </>
                        ) : (
                          <>
                            <Plus className="w-5 h-5 mr-2" />
                            Add to List
                          </>
                        )}
                      </Button>
                      <Button size="lg" variant="outline" className="border-white/[0.14] bg-white/[0.06] text-white/[0.88] backdrop-blur-sm hover:bg-white/[0.12] hover:text-white" asChild>
                        <Link href={getMediaHref(currentAnime.id, currentAnime.title)}>
                          <Info className="w-5 h-5 mr-2" />
                          Details
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <PageLoader label="Loading discover feed..." />
      )}

        {/* Side Actions */}
        {currentAnime ? (
        <motion.div 
          className="fixed bottom-28 right-5 z-30 flex flex-col gap-4 md:right-7 lg:bottom-36 lg:right-10"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Like */}
          <div className="flex flex-col items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-12 w-12 rounded-full bg-black/30 backdrop-blur-sm transition-all hover:bg-black/50",
                liked[currentAnime?.id] && "text-red-500"
              )}
              onClick={(e) => {
                e.stopPropagation()
                if (!ensureSignedIn()) return
                currentAnime && toggleLike(currentAnime.id)
              }}
            >
              <Heart className={cn("w-6 h-6", liked[currentAnime?.id] && "fill-current")} />
            </Button>
            <span className="text-xs text-white/80 font-medium">
              {formatNumber((currentAnime?.likes || 0) + (liked[currentAnime?.id] ? 1 : 0))}
            </span>
          </div>

          {/* Save */}
          <div className="flex flex-col items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-12 w-12 rounded-full bg-black/30 backdrop-blur-sm transition-all hover:bg-black/50",
                saved[currentAnime?.id] && "bg-white/[0.14] text-white"
              )}
              onClick={(e) => {
                e.stopPropagation()
                if (!ensureSignedIn()) return
                currentAnime && toggleSave(currentAnime.id)
              }}
            >
              <Bookmark className={cn("w-6 h-6", saved[currentAnime?.id] && "fill-current")} />
            </Button>
            <span className="text-xs text-white/80 font-medium">Save</span>
          </div>

          {/* Share */}
          <div className="flex flex-col items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-12 w-12 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50"
              onClick={(e) => e.stopPropagation()}
            >
              <Share2 className="w-6 h-6 text-white" />
            </Button>
            <span className="text-xs text-white/80 font-medium">Share</span>
          </div>

          {/* Trailer Controls */}
          {currentAnime?.trailerId && !spoilerSafe ? (
            <div className="flex flex-col items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-12 w-12 rounded-full bg-black/30 backdrop-blur-sm transition-all hover:bg-black/50"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsTrailerPlayerOpen(true)
                }}
              >
                <Play className="w-6 h-6 text-white" />
              </Button>
              <span className="text-xs text-white/80 font-medium">Player</span>
            </div>
          ) : null}

          {/* Audio */}
          <div className="flex flex-col items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-12 w-12 rounded-full bg-black/30 backdrop-blur-sm transition-all hover:bg-black/50",
                !spoilerSafe && !isMuted && "bg-white/[0.14] text-white",
              )}
              onClick={(e) => {
                e.stopPropagation()
                toggleMute()
              }}
              disabled={spoilerSafe}
            >
              {isMuted || spoilerSafe ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6" />}
            </Button>
            <span className="text-xs text-white/80 font-medium">{spoilerSafe ? "Hidden" : isMuted ? "Muted" : "Audio"}</span>
          </div>
        </motion.div>
        ) : null}

        {/* Navigation Arrows */}
        {currentAnime ? (
        <div className="fixed bottom-9 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/32 px-2 py-2 shadow-[0_12px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-full bg-white/[0.05] text-white transition-all hover:bg-white/[0.12] disabled:opacity-30"
            onClick={(e) => {
              e.stopPropagation()
              goToPrev()
            }}
            disabled={currentIndex === 0}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <div className="h-5 w-px bg-white/10" />
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-full bg-white/[0.05] text-white transition-all hover:bg-white/[0.12] disabled:opacity-30"
            onClick={(e) => {
              e.stopPropagation()
              if (currentIndex >= filteredFeed.length - 1) {
                if (hasMore && !loadingMore) {
                  loadFeedPage(page + 1, true)
                }
                return
              }
              goToNext()
            }}
            disabled={currentIndex === filteredFeed.length - 1 && !hasMore && !loadingMore}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
        ) : null}

        {currentAnime ? (
        <div className="fixed left-1/2 top-20 z-20 max-w-[calc(100vw-1rem)] -translate-x-1/2 px-2 lg:top-24">
          <div className="mx-auto flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/10 bg-[rgba(8,14,22,0.58)] px-2.5 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-lg">
            {vibeFilters.map(vibe => (
              <button
                key={vibe.id}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200",
                  activeVibe === vibe.id
                    ? "bg-white text-background"
                    : "text-white/[0.68] hover:bg-white/[0.06] hover:text-white"
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveVibe(vibe.id)
                  setCurrentIndex(0)
                }}
              >
                <vibe.icon className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">{vibe.label}</span>
              </button>
            ))}

            <div className="mx-1 hidden h-5 w-px bg-white/10 md:block" />

            <button
              title={spoilerSafe ? "Spoiler-safe mode is on — tap to show spoilers" : "Hide trailers & synopses (spoiler-safe)"}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200",
                spoilerSafe
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "text-white/[0.68] hover:bg-white/[0.06] hover:text-white",
              )}
              onClick={(e) => {
                e.stopPropagation()
                toggleSpoilerSafe()
              }}
            >
              {spoilerSafe ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span className="whitespace-nowrap">Spoiler-safe{spoilerSafe ? ": On" : ""}</span>
            </button>
          </div>
        </div>
        ) : null}

        {loadingMore && !isDiscoverPending ? (
          <div className="fixed bottom-4 right-4 lg:right-8 z-20 rounded-full bg-black/35 px-3 py-1.5 text-xs font-medium text-white/75 backdrop-blur-sm">
            Loading more...
          </div>
        ) : null}
      </div>

      {currentAnime?.trailerId ? (
        <Dialog open={isTrailerPlayerOpen} onOpenChange={setIsTrailerPlayerOpen}>
          <DialogContent className="max-w-4xl border-white/10 bg-[rgba(7,12,18,0.94)] p-0 text-white shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl" showCloseButton>
            <DialogHeader className="border-b border-white/10 px-6 py-4">
              <DialogTitle className="text-xl font-semibold text-white">
                Trailer Player
              </DialogTitle>
              <DialogDescription className="text-white/60">
                Pause, scrub, jump around, or fullscreen the trailer here.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-6 pt-4">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                <div className="relative aspect-video">
                  <iframe
                    src={getControllableYouTubeUrl(currentAnime.trailerId)}
                    className="absolute inset-0 h-full w-full border-0"
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{currentAnime.title}</p>
                  <p className="text-xs text-white/55">
                    Use the YouTube controls to pause, seek backward or forward, and go fullscreen.
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                >
                  <Link
                    href={`https://www.youtube.com/watch?v=${currentAnime.trailerId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open on YouTube
                  </Link>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
