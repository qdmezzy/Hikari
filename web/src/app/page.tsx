"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Navigation } from "@/components/Navigation"
import { AnimeCard } from "@/components/AnimeCard"
import { 
  Search, Clock, Star, Play, Heart, Plus, ChevronRight, 
  Sparkles, Flame, Calendar, Eye, Zap, ExternalLink, Compass
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import Image from "next/image"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import {
  fetchAniList,
  fetchAniListMediaByIds,
  formatAniListStatus,
  formatCompactNumber,
  formatRelativeTime,
  getEpisodeCount,
  getMediaHref,
  getMediaTitle,
  getPrimaryStudio,
  sanitizeDescription,
} from "@/lib/anilist"

const HOME_TRENDING_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
      id
      title { romaji english native }
      coverImage { extraLarge large }
      bannerImage
      averageScore
      episodes
      nextAiringEpisode { episode airingAt }
      description(asHtml: false)
      genres
      popularity
      status
      studios(isMain: true) { nodes { name } }
    }
  }
}
`

const HOME_SEASONAL_QUERY = `
query ($season: MediaSeason, $seasonYear: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, isAdult: false) {
      id
      title { romaji english native }
      coverImage { extraLarge large }
      averageScore
      episodes
      nextAiringEpisode { episode airingAt }
      status
      description(asHtml: false)
      genres
      studios(isMain: true) { nodes { name } }
    }
  }
}
`

const FEATURED_ROTATION_MS = 8000
const HERO_TITLE_MAX_LENGTH = 34

const getCurrentSeason = (date = new Date()) => {
  const month = date.getMonth() + 1
  const year = date.getFullYear()

  if (month <= 3) return { season: "WINTER", year }
  if (month <= 6) return { season: "SPRING", year }
  if (month <= 9) return { season: "SUMMER", year }
  return { season: "FALL", year }
}

const truncateAtWord = (value: string, maxLength: number) => {
  const text = String(value || "").replace(/\s+/g, " ").trim()
  if (!text) return ""
  if (text.length <= maxLength) return text

  const slice = text.slice(0, maxLength + 1)
  const boundary = slice.lastIndexOf(" ")
  const trimmed = (boundary > maxLength * 0.6 ? slice.slice(0, boundary) : slice.slice(0, maxLength)).trim()

  return `${trimmed.replace(/[,:;.-]+$/, "")}...`
}

const getHeroTitle = (media: any) => {
  const preferredCandidates = [media?.title?.english, media?.title?.romaji]
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const candidates = preferredCandidates.length
    ? preferredCandidates
    : [media?.title?.native].map((value) => String(value || "").replace(/\s+/g, " ").trim()).filter(Boolean)

  if (!candidates.length) return "Untitled"

  const alreadyShort = candidates.find((title) => title.length <= HERO_TITLE_MAX_LENGTH)
  if (alreadyShort) return alreadyShort

  for (const title of candidates) {
    const simplifiedCandidates = [
      title.replace(/\s+\([^)]*\)\s*$/g, "").trim(),
      title.replace(/\s+(?:\d+(?:st|nd|rd|th)\s+Season.*|Season\s+\d+.*|Part\s+\d+.*|Cour\s+\d+.*)$/i, "").trim(),
      title.split(/:\s+/)[0]?.trim(),
      title.split(/,\s+/)[0]?.trim(),
      title.split(/\s[-–|]\s/)[0]?.trim(),
    ].filter(Boolean)
    const safeVariant = simplifiedCandidates.find(
      (candidate) => candidate.length >= 8 && candidate.length <= HERO_TITLE_MAX_LENGTH,
    )
    if (safeVariant) {
      return safeVariant
    }

    const dashSplit = title.split(/\s[-–|]\s/)
    if (dashSplit.length > 1 && dashSplit[0].length >= 8 && dashSplit[0].length <= HERO_TITLE_MAX_LENGTH) {
      return dashSplit[0]
    }
  }

  return truncateAtWord(candidates.sort((left, right) => left.length - right.length)[0], HERO_TITLE_MAX_LENGTH)
}

const getHeroDescription = (value: string) => {
  const cleaned = sanitizeDescription(value)
    .replace(/\(source:[^)]+\)$/i, "")
    .replace(/\bsource:\s*[^.?!]+[.?!]?/i, "")
    .trim()

  if (!cleaned) return ""

  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  let teaser = ""

  for (const sentence of sentences) {
    const next = teaser ? `${teaser} ${sentence}` : sentence
    if (next.length > 220) break
    teaser = next
    if (teaser.length >= 150 && teaser.match(/[.!?]/g)?.length) break
  }

  return teaser || truncateAtWord(cleaned, 220)
}

const mapMediaToHomeAnime = (media: any, rank?: number) => ({
  id: media.id,
  title: getMediaTitle(media),
  heroTitle: getHeroTitle(media),
  cover: media?.coverImage?.extraLarge || media?.coverImage?.large || "/placeholder.svg",
  banner: media?.bannerImage || media?.coverImage?.extraLarge || media?.coverImage?.large || "/placeholder.svg",
  rating: media?.averageScore ? Number((media.averageScore / 10).toFixed(1)) : undefined,
  episodes: getEpisodeCount(media) || undefined,
  description: sanitizeDescription(media?.description),
  heroDescription: getHeroDescription(media?.description),
  genres: Array.isArray(media?.genres) ? media.genres : [],
  studio: getPrimaryStudio(media),
  popularity: Number(media?.popularity || 0),
  status: formatAniListStatus(media?.status),
  rank,
})

const getAiringMeta = (airingAt?: number | null) => {
  if (!airingAt) return { day: "TBA", time: "", isToday: false }

  const date = new Date(airingAt * 1000)
  const now = new Date()

  return {
    day: date.toLocaleDateString("en-US", { weekday: "long" }),
    time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    isToday: date.toDateString() === now.toDateString(),
  }
}

type AnimeItem = {
  id: number
  title: string
  heroTitle?: string
  cover: string
  rating?: number
  episodes?: number
  status?: string
  genres?: string[]
  rank?: number
  description?: string
  heroDescription?: string
  banner?: string
  studio?: string
  popularity?: number
  progress?: number
  currentEp?: number
  totalEp?: number | null
  nextEpIn?: string
  day?: string
  time?: string
  isToday?: boolean
}

export default function HomePage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [currentFeatured, setCurrentFeatured] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [featuredAnime, setFeaturedAnime] = useState<AnimeItem[]>([])
  const [trendingAnime, setTrendingAnime] = useState<AnimeItem[]>([])
  const [continueWatching, setContinueWatching] = useState<AnimeItem[]>([])
  const [seasonalAnime, setSeasonalAnime] = useState<AnimeItem[]>([])
  const [homeLoading, setHomeLoading] = useState(true)
  const [continueLoading, setContinueLoading] = useState(true)
  const [homeError, setHomeError] = useState("")
  const [continueError, setContinueError] = useState("")

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    let active = true

    const loadHomeData = async () => {
      setHomeLoading(true)
      setHomeError("")

      try {
        const { season, year } = getCurrentSeason()
        const [trendingData, seasonalData] = await Promise.all([
          fetchAniList(HOME_TRENDING_QUERY, { page: 1, perPage: 12 }),
          fetchAniList(HOME_SEASONAL_QUERY, { season, seasonYear: year, page: 1, perPage: 12 }),
        ])

        if (!active) return

        const trendingMedia = trendingData?.Page?.media || []
        const nextFeatured = trendingMedia.slice(0, 3).map((media: any, index: number) => mapMediaToHomeAnime(media, index + 1))
        const nextTrending = trendingMedia.slice(0, 6).map((media: any, index: number) => mapMediaToHomeAnime(media, index + 1))
        const nextSeasonal = (seasonalData?.Page?.media || [])
          .filter((media: any) => media?.nextAiringEpisode?.airingAt)
          .slice(0, 4)
          .map((media: any) => ({
            ...mapMediaToHomeAnime(media),
            ...getAiringMeta(media?.nextAiringEpisode?.airingAt),
          }))

        setFeaturedAnime(nextFeatured)
        setTrendingAnime(nextTrending)
        setSeasonalAnime(nextSeasonal)
      } catch (error) {
        console.error("Failed to load homepage anime:", error)
        if (!active) return

        setFeaturedAnime([])
        setTrendingAnime([])
        setSeasonalAnime([])
        setHomeError("Could not load live homepage anime right now.")
      } finally {
        if (active) {
          setHomeLoading(false)
        }
      }
    }

    loadHomeData()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (featuredAnime.length <= 1) return

    const interval = setInterval(() => {
      setCurrentFeatured((prev) => (prev + 1) % featuredAnime.length)
    }, FEATURED_ROTATION_MS)

    return () => clearInterval(interval)
  }, [featuredAnime.length])

  useEffect(() => {
    if (!featuredAnime.length || currentFeatured < featuredAnime.length) return
    setCurrentFeatured(0)
  }, [currentFeatured, featuredAnime.length])

  useEffect(() => {
    let active = true

    const loadContinueWatching = async () => {
      if (!user) {
        setContinueWatching([])
        setContinueLoading(false)
        setContinueError("")
        return
      }

      setContinueLoading(true)
      setContinueError("")

      const { data, error } = await client
        .from("list_entries")
        .select("id, media_id, status, progress, updated_at")
        .eq("user_id", user.id)
        .in("status", ["watching", "rewatching", "on_hold"])
        .order("updated_at", { ascending: false })
        .limit(6)

      if (!active) return

      if (error) {
        console.error("Failed to load continue watching:", error)
        setContinueWatching([])
        setContinueError("Could not load your watch progress.")
        setContinueLoading(false)
        return
      }

      if (!data?.length) {
        setContinueWatching([])
        setContinueLoading(false)
        return
      }

      try {
        const mediaById = await fetchAniListMediaByIds(data.map((entry: any) => entry.media_id))
        if (!active) return

        setContinueWatching(
          data.slice(0, 3).map((entry: any) => {
            const media = mediaById.get(entry.media_id)
            const totalEp = getEpisodeCount(media)
            const currentEp = Number(entry?.progress || 0)
            const progress = totalEp ? Math.min(Math.round((currentEp / totalEp) * 100), 100) : 0

            return {
              id: entry.media_id,
              title: getMediaTitle(media),
              cover: media?.coverImage?.extraLarge || media?.coverImage?.large || "/placeholder.svg",
              progress,
              currentEp,
              totalEp,
              nextEpIn: media?.nextAiringEpisode?.airingAt
                ? formatRelativeTime(new Date(media.nextAiringEpisode.airingAt * 1000))
                : "",
            }
          }),
        )
      } catch (loadError) {
        console.error("Failed to hydrate continue watching:", loadError)
        if (!active) return

        setContinueWatching([])
        setContinueError("Could not load your watch progress.")
      } finally {
        if (active) {
          setContinueLoading(false)
        }
      }
    }

    loadContinueWatching()

    return () => {
      active = false
    }
  }, [user])

  const featured = useMemo(() => featuredAnime[currentFeatured] || null, [currentFeatured, featuredAnime])

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-primary/20 via-accent/10 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-[30%] -right-[20%] w-[70%] h-[70%] rounded-full bg-gradient-to-tl from-accent/15 via-primary/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] rounded-full bg-gradient-radial from-sparkle/5 to-transparent blur-2xl" />
      </div>

      <Navigation />
      
      <main className="relative z-10">
        {/* Epic Hero Section with Featured Anime */}
        <section className="relative min-h-[85vh] flex items-center overflow-hidden pt-20 md:pt-24">
          {/* Banner Background */}
          {featured ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={featured.id}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0"
              >
                <motion.div
                  className="absolute inset-0"
                  animate={{
                    scale: [1.02, 1.06, 1.02],
                    x: [0, -18, 0],
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: FEATURED_ROTATION_MS / 1000,
                    ease: "easeInOut",
                    repeat: Infinity,
                  }}
                >
                  <Image
                    src={featured.banner || featured.cover}
                    alt={featured.title}
                    fill
                    className="object-cover"
                    priority
                  />
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-transparent to-background" />
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-card" />
          )}

          {/* Hero Content */}
          <div className="container mx-auto px-4 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Side - Info */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={featured?.id || "featured-empty"}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  {homeLoading ? (
                    <div className="space-y-5">
                      <div className="flex gap-2">
                        <div className="h-8 w-24 rounded-lg bg-white/10 animate-pulse" />
                        <div className="h-8 w-20 rounded-lg bg-white/10 animate-pulse" />
                        <div className="h-8 w-28 rounded-lg bg-white/10 animate-pulse" />
                      </div>
                      <div className="space-y-3">
                        <div className="h-16 w-full max-w-2xl rounded-xl bg-white/10 animate-pulse" />
                        <div className="h-16 w-4/5 rounded-xl bg-white/10 animate-pulse" />
                      </div>
                      <div className="h-24 max-w-xl rounded-xl bg-white/10 animate-pulse" />
                    </div>
                  ) : featured ? (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        transition={{ duration: 0.45, delay: 0.05 }}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-sm font-medium">
                          <Flame className="w-3.5 h-3.5" />
                          Trending
                        </span>
                        {featured.rating ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/10 backdrop-blur-sm text-foreground/90 text-sm font-medium">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {featured.rating}
                          </span>
                        ) : null}
                        {featured.studio ? (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-foreground/10 backdrop-blur-sm text-foreground/70 text-sm">
                            {featured.studio}
                          </span>
                        ) : null}
                      </motion.div>

                      <motion.h1
                        initial={{ opacity: 0, y: 24, filter: "blur(14px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        transition={{ duration: 0.5, delay: 0.12 }}
                        className="max-w-[10ch] text-4xl md:text-6xl lg:text-[clamp(3.5rem,5.5vw,6rem)] leading-[0.9] font-black tracking-tight"
                      >
                        <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent drop-shadow-lg">
                          {featured.heroTitle || featured.title}
                        </span>
                      </motion.h1>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.18 }}
                        className="flex flex-wrap gap-2"
                      >
                        {featured.genres?.map((genre) => (
                          <span
                            key={genre}
                            className="px-3 py-1 rounded-full text-sm bg-card/50 backdrop-blur-sm border border-border/50 text-foreground/80"
                          >
                            {genre}
                          </span>
                        ))}
                      </motion.div>

                      <motion.p
                        initial={{ opacity: 0, y: 22 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.24 }}
                        className="text-lg text-muted-foreground max-w-xl leading-relaxed"
                      >
                        {featured.heroDescription || featured.description || "Details are loading in from AniList."}
                      </motion.p>

                      <motion.div
                        initial={{ opacity: 0, y: 22 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.3 }}
                        className="flex items-center gap-6 text-sm flex-wrap"
                      >
                        {featured.episodes ? (
                          <div className="flex items-center gap-2">
                            <Play className="w-4 h-4 text-accent" />
                            <span className="text-muted-foreground">{featured.episodes} Episodes</span>
                          </div>
                        ) : null}
                        {featured.popularity ? (
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-accent" />
                            <span className="text-muted-foreground">{formatCompactNumber(featured.popularity)} tracking</span>
                          </div>
                        ) : null}
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.36 }}
                        className="flex flex-wrap gap-4 pt-4"
                      >
                        <Button
                          asChild
                          size="lg"
                          className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold px-8 shadow-lg shadow-primary/25 group"
                        >
                          <Link href={getMediaHref(featured.id, featured.title)}>
                            <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
                            Add to List
                          </Link>
                        </Button>
                        <Button
                          asChild
                          size="lg"
                          variant="outline"
                          className="border-2 border-foreground/20 hover:bg-foreground/10 backdrop-blur-sm group"
                        >
                          <Link href={getMediaHref(featured.id, featured.title)}>
                            <Eye className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                            View Details
                          </Link>
                        </Button>
                        <Button size="lg" variant="ghost" className="hover:bg-red-500/10 hover:text-red-400 group">
                          <Heart className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </Button>
                      </motion.div>
                    </>
                  ) : (
                    <>
                      <Badge className="w-fit bg-primary/20 text-primary border-primary/20">Live anime data</Badge>
                      <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight text-foreground">
                        Track anime without fake demo shelves.
                      </h1>
                      <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                        The redesign is now waiting on real AniList data instead of shipping hardcoded titles.
                      </p>
                      {homeError ? <p className="text-sm text-rose-400">{homeError}</p> : null}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

{/* Right Side - Featured Cover Card */}
          <div className="hidden lg:flex justify-center">
            {featured ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={featured.id}
                  initial={{ opacity: 0, y: 30, rotateY: -15 }}
                  animate={{ opacity: 1, y: 0, rotateY: 0 }}
                  exit={{ opacity: 0, y: -30, rotateY: 15 }}
                  transition={{ duration: 0.6 }}
                  className="relative"
                >
                  <Link href={getMediaHref(featured.id, featured.title)} className="block cursor-pointer">
                    <motion.div
                      className="absolute -inset-4 bg-gradient-to-r from-primary/40 via-accent/40 to-primary/40 rounded-3xl blur-2xl opacity-60"
                      animate={{ opacity: [0.45, 0.75, 0.45], scale: [0.98, 1.03, 0.98] }}
                      transition={{ duration: 4.5, ease: "easeInOut", repeat: Infinity }}
                    />
                    <motion.div
                      className="relative w-72 aspect-[3/4]"
                      animate={{ y: [0, -12, 0], rotateZ: [0, -0.75, 0, 0.75, 0] }}
                      transition={{ duration: 6.5, ease: "easeInOut", repeat: Infinity }}
                    >
                      <div className="relative h-full w-full rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 hover:scale-105 transition-transform duration-300">
                        <Image
                          src={featured.cover}
                          alt={featured.title}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-100%] animate-shimmer" />
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="w-72 aspect-[3/4] rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
            )}
          </div>
            </div>

            {/* Carousel Indicators */}
            <div className="flex items-center justify-center gap-3 mt-12">
              {(featuredAnime.length ? featuredAnime : Array.from({ length: 3 })).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentFeatured(index)}
                  className={`relative overflow-hidden h-1.5 rounded-full transition-all duration-500 ${
                    index === currentFeatured 
                      ? "w-12 bg-foreground/15" 
                      : "w-6 bg-foreground/20 hover:bg-foreground/40"
                  }`}
                >
                  {index === currentFeatured ? (
                    <motion.span
                      key={`${featured?.id || "featured"}-${index}`}
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: FEATURED_ROTATION_MS / 1000, ease: "linear" }}
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-accent"
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Search Bar - No keyboard shortcut */}
        <section className="relative -mt-8 px-4 z-20">
          <div className="max-w-4xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
              <div className="relative flex items-center bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
                <Search className="absolute left-5 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for anime, manga, characters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-14 pr-36 py-7 text-lg bg-transparent border-0 focus-visible:ring-0 placeholder:text-muted-foreground/60 sm:pr-40"
                />
                <div className="absolute right-3 flex items-center gap-2">
                  <Link href={searchQuery ? `/search?query=${encodeURIComponent(searchQuery)}` : "/search"}>
                    <Button className="h-11 rounded-xl border border-white/10 bg-secondary/85 px-4 text-foreground shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition-all duration-300 hover:border-primary/30 hover:bg-secondary">
                      <Search className="mr-2 h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Search</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Continue Watching Section */}
        <section className="px-4 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Play className="w-6 h-6 text-primary" />
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Continue Watching</h2>
                  <p className="text-sm text-muted-foreground">Pick up where you actually left off</p>
                </div>
              </div>
              <Link href="/lists" className="text-accent hover:text-accent/80 flex items-center gap-1 text-sm font-medium group">
                View All 
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {continueError ? <p className="mb-4 text-sm text-rose-400">{continueError}</p> : null}

            {continueLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-40 rounded-2xl border border-white/5 bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : continueWatching.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {continueWatching.map((anime, index) => (
                  <Link key={anime.id} href={getMediaHref(anime.id, anime.title)}>
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="group cursor-pointer"
                    >
                      <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300">
                        <div className="flex gap-4 p-4">
                          <div className="relative w-24 h-32 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                            <Image
                              src={anime.cover}
                              alt={anime.title}
                              fill
                              className="object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          </div>

                          <div className="flex-1 flex flex-col justify-between py-1">
                            <div>
                              <h3 className="font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                                {anime.title}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {anime.totalEp ? `Episode ${anime.currentEp} of ${anime.totalEp}` : `Progress ${anime.currentEp}`}
                              </p>
                              {anime.nextEpIn ? (
                                <Badge variant="outline" className="mt-2 text-xs border-green-500/30 text-green-500 bg-green-500/10">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Next {anime.nextEpIn}
                                </Badge>
                              ) : null}
                            </div>

                            {anime.totalEp ? (
                              <div className="space-y-2 mt-3">
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${anime.progress || 0}%` }}
                                    transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{anime.progress || 0}% complete</span>
                                  <span>{Math.max((anime.totalEp || 0) - (anime.currentEp || 0), 0)} left</span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="glass-card p-10 text-center">
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {user ? "No watch progress yet" : "Sign in to sync your watch progress"}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {user
                    ? "This shelf now stays empty until we have your real list activity."
                    : "The redesign no longer shows fake continue-watching cards to logged-out users."}
                </p>
                <Button asChild className="bg-accent hover:bg-accent/90">
                  <Link href={user ? "/search" : "/login"}>{user ? "Browse Anime" : "Sign In"}</Link>
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Trending Section */}
        <section className="px-4 py-16 relative">
          {/* Section Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
          
          <div className="max-w-7xl mx-auto relative">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Flame className="w-6 h-6 text-orange-500" />
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Trending Now</h2>
                  <p className="text-sm text-muted-foreground">Live AniList titles instead of the old static shelf</p>
                </div>
              </div>
              <Link href="/search" className="text-accent hover:text-accent/80 flex items-center gap-1 text-sm font-medium group">
                Browse All 
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            {homeError ? <p className="mb-4 text-sm text-rose-400">{homeError}</p> : null}

            {homeLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="aspect-[3/4] rounded-2xl border border-white/5 bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : trendingAnime.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {trendingAnime.map((anime, index) => (
                  <AnimeCard
                    key={anime.id}
                    id={String(anime.id)}
                    title={anime.title}
                    image={anime.cover}
                    episodes={anime.episodes || undefined}
                    rating={anime.rating || undefined}
                    type="anime"
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="glass-card p-10 text-center">
                <p className="text-muted-foreground">Trending anime could not be loaded right now.</p>
              </div>
            )}
          </div>
        </section>

        {/* Airing Schedule Section */}
        <section className="px-4 py-16">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6 text-purple-500" />
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Airing Schedule</h2>
                  <p className="text-sm text-muted-foreground">Upcoming episodes from the current season</p>
                </div>
              </div>
              <Link href="/calendar" className="text-accent hover:text-accent/80 flex items-center gap-1 text-sm font-medium group">
                Full Schedule 
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            {homeLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-32 rounded-2xl border border-white/5 bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : seasonalAnime.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {seasonalAnime.map((anime, index) => (
                  <Link key={anime.id} href={getMediaHref(anime.id, anime.title)} className="block">
                    <motion.div
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: isLoaded ? 1 : 0, x: isLoaded ? 0 : -30 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      className={`group cursor-pointer relative ${anime.isToday ? 'ring-2 ring-green-500/50' : ''}`}
                    >
                      {anime.isToday && (
                        <div className="absolute -top-2 left-4 z-10">
                          <Badge className="bg-green-500 text-white text-[10px] shadow-lg">
                            <Zap className="w-3 h-3 mr-1" />
                            Airing Today
                          </Badge>
                        </div>
                      )}
                      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden hover:border-accent/50 hover:shadow-xl transition-all duration-300 p-4 flex gap-4">
                        <div className="relative w-16 h-24 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                          <Image
                            src={anime.cover}
                            alt={anime.title}
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <h3 className="font-bold text-foreground text-sm line-clamp-2 group-hover:text-accent transition-colors">
                            {anime.title}
                          </h3>
                          <div className="space-y-2">
                            <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/10">
                              {anime.day}
                            </Badge>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {anime.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="glass-card p-10 text-center">
                <p className="text-muted-foreground">No seasonal schedule items are available right now.</p>
              </div>
            )}
          </div>
        </section>

        {/* CTA Section - Fixed: No more "Get Started" confusion */}
        <section className="px-4 py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20" />
          <div className="max-w-4xl mx-auto relative text-center">
            <Badge className="mb-6 bg-gradient-to-r from-primary to-accent text-white border-0">
              <Sparkles className="w-3 h-3 mr-1" />
              Join the Community
            </Badge>
            <h2 className="text-4xl md:text-5xl font-black text-foreground mb-4">
              Track anime <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">spoiler-free</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Real shelves, real progress, and a redesigned homepage that no longer ships placeholder entries.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold px-8 shadow-lg shadow-primary/25">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Start Tracking Free
                </Button>
              </Link>
              <Link href="/discover">
                <Button size="lg" variant="outline" className="border-2 border-foreground/20 hover:bg-foreground/10 backdrop-blur-sm">
                  <Compass className="w-5 h-5 mr-2" />
                  Discover Feed
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <span className="text-xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Hikari
                </span>
              </Link>
              <p className="text-sm text-muted-foreground">
                Your ultimate anime tracking companion. Discover, track, and share your anime journey.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Explore</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/search" className="hover:text-accent transition-colors">Browse Anime</Link></li>
                <li><Link href="/calendar" className="hover:text-accent transition-colors">Schedule</Link></li>
                <li><Link href="/discover" className="hover:text-accent transition-colors">Discover Feed</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Community</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/social" className="hover:text-accent transition-colors">Social</Link></li>
                <li><Link href="/ai-recommendations" className="hover:text-accent transition-colors">AI Recommendations</Link></li>
                <li><Link href="/discord/link" className="hover:text-accent transition-colors flex items-center gap-1">Discord <ExternalLink className="w-3 h-3" /></Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Account</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/login" className="hover:text-accent transition-colors">Login</Link></li>
                <li><Link href="/register" className="hover:text-accent transition-colors">Sign Up</Link></li>
                <li><Link href="/profile" className="hover:text-accent transition-colors">Profile</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Made with love for anime fans everywhere
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/settings" className="hover:text-accent transition-colors">Settings</Link>
              <Link href="/premium" className="hover:text-accent transition-colors">Premium</Link>
              <Link href="/lists" className="hover:text-accent transition-colors">My List</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
