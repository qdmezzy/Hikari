"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Heart, Bookmark, Share2, Play, Pause, Plus, ChevronUp, ChevronDown, 
  Flame, Sparkles, Zap, Wind, Moon, Volume2, VolumeX, Check,
  Star, Info, ExternalLink, HeartIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/header"
import useAuth from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

// Vibe filters
const vibeFilters = [
  { id: "all", label: "For You", icon: Sparkles, color: "from-primary to-accent" },
  { id: "hype", label: "Hype", icon: Flame, color: "from-orange-500 to-red-500" },
  { id: "action", label: "Action", icon: Zap, color: "from-blue-500 to-cyan-500" },
  { id: "chill", label: "Chill", icon: Wind, color: "from-teal-500 to-emerald-500" },
  { id: "dark", label: "Dark", icon: Moon, color: "from-slate-600 to-slate-800" },
  { id: "romance", label: "Romance", icon: HeartIcon, color: "from-pink-500 to-rose-500" },
]

// Discover feed data with YouTube trailer IDs
const discoverFeed = [
  {
    id: 154587,
    title: "Frieren: Beyond Journey's End",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1fmjRv4JQUd.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg",
    rating: 9.1,
    episodes: 28,
    description: "After the Demon King's defeat, the hero's party disbands. Frieren, an elf mage, reflects on her journey and the fleeting nature of human life.",
    genres: ["Adventure", "Fantasy", "Drama"],
    vibes: ["chill", "dark"],
    popularity: 2400000,
    likes: 156000,
    trailerId: "qgQunxD0qCk", // YouTube trailer ID
  },
  {
    id: 151807,
    title: "Solo Leveling",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iwfIsLu.png",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-37yfQA3ym8PA.jpg",
    rating: 8.7,
    episodes: 12,
    description: "In a world where hunters battle monsters, Sung Jinwoo is the weakest E-rank hunter. Until a mysterious quest grants him the power to level up infinitely.",
    genres: ["Action", "Fantasy", "Adventure"],
    vibes: ["hype", "action"],
    popularity: 1800000,
    likes: 124000,
    trailerId: "VSnvabsEHGo",
  },
  {
    id: 145064,
    title: "Jujutsu Kaisen Season 2",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145064-5fa4ZBbW4dqA.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/145064-S7qAgxf6kMrW.jpg",
    rating: 8.8,
    episodes: 23,
    description: "The past of Gojo Satoru and Geto Suguru unfolds as they face powerful curses and make difficult choices.",
    genres: ["Action", "Supernatural"],
    vibes: ["hype", "action", "dark"],
    popularity: 2100000,
    likes: 189000,
    trailerId: "O1pMRhDias8",
  },
  {
    id: 127230,
    title: "Chainsaw Man",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-FlochcFsyoF4.png",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/127230-1Rb9kG6z5gRK.jpg",
    rating: 8.6,
    episodes: 12,
    description: "Denji, a young man with a devil dog companion, becomes a hybrid devil-human and joins the Public Safety Devil Hunters.",
    genres: ["Action", "Horror", "Supernatural"],
    vibes: ["hype", "action", "dark"],
    popularity: 1900000,
    likes: 145000,
    trailerId: "dFlDRhvM4L0",
  },
  {
    id: 150672,
    title: "Oshi no Ko",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx150672-2WWJVXIAOG11.png",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/150672-ISwoA9IW4Sjk.jpg",
    rating: 8.9,
    episodes: 11,
    description: "A doctor who was a fan of a famous idol reincarnates as her son. Now he must navigate the dark side of the entertainment industry.",
    genres: ["Drama", "Supernatural", "Mystery"],
    vibes: ["dark", "romance"],
    popularity: 1700000,
    likes: 132000,
    trailerId: "ow2K6TGYW7M",
  },
  {
    id: 21,
    title: "One Punch Man",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-YCDoj1EkAxFn.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJmZqs.jpg",
    rating: 8.5,
    episodes: 12,
    description: "Saitama is a hero who only became a hero for fun. After three years of training, he's become so strong that he can defeat any enemy with a single punch.",
    genres: ["Action", "Comedy", "Parody"],
    vibes: ["hype", "action"],
    popularity: 2500000,
    likes: 198000,
    trailerId: "ExUMiF1L0HA",
  },
]

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
  return `${num}`
}

export default function DiscoverPage() {
  const { user, logout } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [activeVibe, setActiveVibe] = useState("all")
  const [liked, setLiked] = useState<Record<number, boolean>>({})
  const [saved, setSaved] = useState<Record<number, boolean>>({})
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showControls, setShowControls] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<HTMLIFrameElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()

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

  const toggleMute = () => {
    setIsMuted(prev => !prev)
  }

  const togglePlay = () => {
    setIsPlaying(prev => !prev)
  }

  const handleShowControls = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false)
    }, 3000)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") goToNext()
      if (e.key === "ArrowUp" || e.key === "k") goToPrev()
      if (e.key === "l") currentAnime && toggleLike(currentAnime.id)
      if (e.key === "s") currentAnime && toggleSave(currentAnime.id)
      if (e.key === "m") toggleMute()
      if (e.key === " ") {
        e.preventDefault()
        togglePlay()
      }
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
    })
    return `https://www.youtube.com/embed/${trailerId}?${params.toString()}`
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onLogout={logout} />
      
      <div 
        ref={containerRef}
        className="fixed inset-0 pt-16 lg:pt-20 overflow-hidden cursor-pointer"
        onClick={handleShowControls}
        onMouseMove={handleShowControls}
      >
{/* Main Content */}
      <AnimatePresence>
          {currentAnime && (
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
                {currentAnime.trailerId && isPlaying ? (
                  <iframe
                    ref={playerRef}
                    key={`${currentAnime.trailerId}-${isMuted}`}
                    src={getYouTubeUrl(currentAnime.trailerId)}
                    className="absolute inset-0 w-full h-full scale-[1.5] pointer-events-none"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                ) : (
                  <Image
                    src={currentAnime.banner}
                    alt=""
                    fill
                    className="object-cover"
                    priority
                  />
                )}
                
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
                        <Link href={`/anime/${currentAnime.id}`}>
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

        {/* Video Controls - show on hover/tap */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20"
            >
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70"
                onClick={(e) => {
                  e.stopPropagation()
                  togglePlay()
                }}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleMute()
                }}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

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

        {/* Progress Indicator */}
        <div className="fixed bottom-4 left-4 lg:left-8 flex flex-col gap-1.5 z-20">
          {filteredFeed.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation()
                if (!isTransitioning) {
                  setIsTransitioning(true)
                  setCurrentIndex(index)
                  setTimeout(() => setIsTransitioning(false), 500)
                }
              }}
              className={cn(
                "w-1.5 rounded-full transition-all duration-300",
                index === currentIndex 
                  ? "h-8 bg-gradient-to-b from-primary to-accent" 
                  : "h-3 bg-white/30 hover:bg-white/50"
              )}
            />
          ))}
        </div>

        {/* Current position indicator */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10">
          <span className="text-xs text-white/50 font-medium">
            {currentIndex + 1} / {filteredFeed.length}
          </span>
        </div>
      </div>
    </div>
  )
}
