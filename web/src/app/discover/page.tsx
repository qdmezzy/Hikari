"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Heart, Bookmark, Share2, Play, Plus, ChevronUp, ChevronDown, 
  Flame, Sparkles, Zap, Wind, Moon, Check,
  Star, Info, HeartIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Navigation } from "@/components/Navigation"
import { cn } from "@/lib/utils"
import { getMediaHref } from "@/lib/anilist"

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

const DISCOVER_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
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

const getVibes = (genres: string[] = [], tags: Array<{ name?: string | null }> = []) => {
  const vibeSet = new Set<string>()
  const lowerGenres = genres.map((genre) => genre.toLowerCase())
  const tagNames = tags.map((tag) => String(tag?.name || "").toLowerCase())

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

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
  return `${num}`
}

export default function DiscoverPage() {
  const [discoverFeed, setDiscoverFeed] = useState<DiscoverItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [activeVibe, setActiveVibe] = useState("all")
  const [liked, setLiked] = useState<Record<number, boolean>>({})
  const [saved, setSaved] = useState<Record<number, boolean>>({})
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isTrailerLoaded, setIsTrailerLoaded] = useState(false)
  const [showTrailerFrame, setShowTrailerFrame] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const loadMoreInFlightRef = useRef(false)

  const filteredFeed = activeVibe === "all" 
    ? discoverFeed 
    : discoverFeed.filter(item => item.vibes.includes(activeVibe))

  const currentAnime = filteredFeed[currentIndex] || filteredFeed[0]

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
    setLiked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleSave = (id: number) => {
    setSaved(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const loadFeedPage = useCallback(async (nextPage: number, append = false) => {
    if (loadMoreInFlightRef.current) return
    loadMoreInFlightRef.current = true
    setLoadingMore(true)

    try {
      const response = await fetch("/api/anilist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: DISCOVER_QUERY,
          variables: { page: nextPage, perPage: 30 },
        }),
      })

      const json = await response.json()
      if (!response.ok || json?.errors) {
        throw new Error(json?.errors?.[0]?.message || "Failed to load discovery feed.")
      }

      const items = (json?.data?.Page?.media || [])
        .map(mapMediaToDiscoverItem)
        .filter(Boolean) as DiscoverItem[]

      if (items.length) {
        setDiscoverFeed((prev) => {
          if (!append) return items
          const seen = new Set(prev.map((item) => item.id))
          const merged = [...prev]
          items.forEach((item) => {
            if (seen.has(item.id)) return
            seen.add(item.id)
            merged.push(item)
          })
          return merged
        })
      } else if (!append) {
        setDiscoverFeed([])
      }

      setPage(nextPage)
      setHasMore(Boolean(json?.data?.Page?.pageInfo?.hasNextPage))
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
      if (e.key === "ArrowDown" || e.key === "j") goToNext()
      if (e.key === "ArrowUp" || e.key === "k") goToPrev()
      if (e.key === "l") currentAnime && toggleLike(currentAnime.id)
      if (e.key === "s") currentAnime && toggleSave(currentAnime.id)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [goToNext, goToPrev, currentAnime])

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

  useEffect(() => {
    loadFeedPage(1)
  }, [loadFeedPage])

  useEffect(() => {
    if (!filteredFeed.length || !hasMore || loadingMore) return
    if (currentIndex >= filteredFeed.length - 4) {
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
  }, [currentAnime?.id])

  useEffect(() => {
    if (!isTrailerLoaded || !currentAnime?.trailerId) return
    const timeout = window.setTimeout(() => {
      setShowTrailerFrame(true)
    }, 700)
    return () => window.clearTimeout(timeout)
  }, [isTrailerLoaded, currentAnime?.trailerId])

  // YouTube embed URL with parameters
  const getYouTubeUrl = (trailerId: string) => {
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
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
                {currentAnime.trailerId ? (
                  <div
                    className={cn(
                      "absolute inset-0 overflow-hidden transition-opacity duration-700",
                      showTrailerFrame ? "opacity-100" : "opacity-0",
                    )}
                  >
                    <iframe
                      key={currentAnime.trailerId}
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
                      <Badge className="bg-gradient-to-r from-primary to-accent text-white border-0">
                        <Sparkles className="w-3 h-3 mr-1" />
                        For You
                      </Badge>
                      <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10 backdrop-blur-sm">
                        <Star className="w-3 h-3 mr-1 fill-current" />
                        {currentAnime.rating}
                      </Badge>
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-lg">
                      {currentAnime.title}
                    </h1>

                    {/* Genres */}
                    <div className="flex flex-wrap gap-2">
                      {currentAnime.genres.map(genre => (
                        <span key={genre} className="px-3 py-1 text-sm rounded-full bg-white/10 backdrop-blur-sm text-white/90">
                          {genre}
                        </span>
                      ))}
                    </div>

                    {/* Description */}
                    <p className="text-white/80 leading-relaxed line-clamp-2 text-sm md:text-base">
                      {currentAnime.description}
                    </p>

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
                          "font-semibold shadow-lg transition-all",
                          saved[currentAnime.id] 
                            ? "bg-green-500 hover:bg-green-600 text-white"
                            : "bg-primary hover:bg-primary/90 text-primary-foreground"
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
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
                      <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20" asChild>
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
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className="max-w-md rounded-3xl border border-white/10 bg-black/50 p-8 text-center backdrop-blur-xl">
            <h1 className="text-2xl font-bold text-white">Discover feed is loading</h1>
            <p className="mt-3 text-sm text-white/70">
              We removed the old hardcoded backup clips here, so this view now waits for live AniList data.
            </p>
          </div>
        </div>
      )}

        {/* Side Actions */}
        <motion.div 
          className="fixed right-4 lg:right-8 bottom-32 lg:bottom-40 flex flex-col gap-4 z-20"
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
                saved[currentAnime?.id] && "text-primary"
              )}
              onClick={(e) => {
                e.stopPropagation()
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
        </motion.div>

        {/* Navigation Arrows */}
        <div className="fixed right-4 lg:right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 disabled:opacity-30"
            onClick={(e) => {
              e.stopPropagation()
              goToPrev()
            }}
            disabled={currentIndex === 0}
          >
            <ChevronUp className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 disabled:opacity-30"
            onClick={(e) => {
              e.stopPropagation()
              goToNext()
            }}
            disabled={currentIndex === filteredFeed.length - 1}
          >
            <ChevronDown className="w-5 h-5" />
          </Button>
        </div>

        {/* Vibe Filters - Cleaner horizontal pill design */}
        <div className="fixed left-1/2 -translate-x-1/2 top-20 lg:top-24 flex items-center gap-2 z-20 p-1.5 bg-black/40 backdrop-blur-md rounded-full">
          {vibeFilters.map(vibe => (
            <button
              key={vibe.id}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                activeVibe === vibe.id 
                  ? `bg-gradient-to-r ${vibe.color} text-white shadow-lg` 
                  : "text-white/70 hover:text-white hover:bg-white/10"
              )}
              onClick={(e) => {
                e.stopPropagation()
                setActiveVibe(vibe.id)
                setCurrentIndex(0)
              }}
            >
              <vibe.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{vibe.label}</span>
            </button>
          ))}
        </div>

        {loadingMore ? (
          <div className="fixed bottom-4 right-4 lg:right-8 z-20 rounded-full bg-black/35 px-3 py-1.5 text-xs font-medium text-white/75 backdrop-blur-sm">
            Loading more...
          </div>
        ) : null}
      </div>
    </div>
  )
}
