"use client"

import { Navigation } from "@/components/Navigation"
import { AnimeCard } from "@/components/AnimeCard"
import { SectionHeader } from "@/components/SectionHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Search,
  TrendingUp,
  Sparkles,
  Shield,
  Brain,
  Users,
  Zap,
  Chrome,
  Play,
  ArrowRight,
  Crown,
  Eye,
  Heart,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { buildAiRecommendations } from "@/lib/ai-recommendations"

const sectionCache = new Map()
const inFlight = new Map()

const TRENDING_ANIME_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: TRENDING_DESC) {
      id
      title { romaji english }
      coverImage { large }
      episodes
      averageScore
    }
  }
}
`

const NEW_RELEASES_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: START_DATE_DESC, status: RELEASING) {
      id
      title { romaji english }
      coverImage { large }
      episodes
      averageScore
    }
  }
}
`

const features = [
  {
    icon: Brain,
    title: "AI Recs",
    description: "Smart suggestions based on your taste",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: Shield,
    title: "Spoiler Safe",
    description: "Auto-hide content past your episode",
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: Zap,
    title: "One-Tap Track",
    description: "Quick +1 everywhere you watch",
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: Users,
    title: "Social",
    description: "Follow friends, share spoiler-free",
    color: "from-pink-500 to-rose-600",
  },
]

export default function HomePage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [trendingAnime, setTrendingAnime] = useState([])
  const [newReleases, setNewReleases] = useState([])
  const [trendingLoading, setTrendingLoading] = useState(true)
  const [newReleasesLoading, setNewReleasesLoading] = useState(true)
  const [aiRecommendations, setAiRecommendations] = useState(null)
  const [aiSubtitle, setAiSubtitle] = useState("Trending right now")
  const [aiMode, setAiMode] = useState("trending")
  const [aiLoading, setAiLoading] = useState(true)
  const [userStats, setUserStats] = useState(null)
  const [watchedIds, setWatchedIds] = useState([])
  const { user } = useAuth()

  const runSearch = () => {
    const trimmed = searchQuery.trim()
    const href = trimmed ? `/search?query=${encodeURIComponent(trimmed)}` : "/search"
    router.push(href)
  }

  useEffect(() => {
    let isActive = true

    const mapMediaToCard = (media) => ({
      id: media.id,
      title: media.title?.english || media.title?.romaji || "Untitled",
      image: media.coverImage?.large,
      episodes: media.episodes ?? null,
      rating: media.averageScore ? media.averageScore / 10 : null,
    })

    const fetchSection = async (query, variables) => {
      const cacheKey = JSON.stringify({ query, variables })
      if (sectionCache.has(cacheKey)) {
        return sectionCache.get(cacheKey)
      }
      if (inFlight.has(cacheKey)) {
        return inFlight.get(cacheKey)
      }

      const request = (async () => {
        const res = await fetch("/api/anilist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables }),
        })

        if (res.status === 429) {
          console.warn("AniList rate limit hit. Using cached data when available.")
          return sectionCache.get(cacheKey) || []
        }

        const data = await res.json()

        if (!res.ok || data?.errors) {
          console.warn("AniList request failed:", data?.errors?.[0]?.message || res.statusText)
          return []
        }

        return data?.data?.Page?.media ?? []
      })()

      inFlight.set(cacheKey, request)
      const result = await request
      inFlight.delete(cacheKey)
      sectionCache.set(cacheKey, result)
      return result
    }

    const loadHomeSections = async () => {
      setTrendingLoading(true)
      setNewReleasesLoading(true)

      const [trendingResult, releasesResult] = await Promise.allSettled([
        fetchSection(TRENDING_ANIME_QUERY, { page: 1, perPage: 6 }),
        fetchSection(NEW_RELEASES_QUERY, { page: 1, perPage: 4 }),
      ])

      if (!isActive) return

      if (trendingResult.status === "fulfilled") {
        setTrendingAnime(trendingResult.value.map(mapMediaToCard))
      } else {
        console.error("Failed to load trending anime:", trendingResult.reason)
        setTrendingAnime([])
      }

      if (releasesResult.status === "fulfilled") {
        setNewReleases(releasesResult.value.map(mapMediaToCard))
      } else {
        console.error("Failed to load new releases:", releasesResult.reason)
        setNewReleases([])
      }

      setTrendingLoading(false)
      setNewReleasesLoading(false)
    }

    loadHomeSections()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadAiRecommendations = async () => {
      setAiLoading(true)
      setAiMode("trending")
      setAiSubtitle("Trending right now")

      if (!user) {
        setWatchedIds([])
        setAiRecommendations(null)
        setAiLoading(false)
        return
      }

      const { data, error } = await client
        .from("list_entries")
        .select("media_id, status, progress, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(2000)

      if (!active) return

      if (error || !data?.length) {
        setWatchedIds([])
        setAiRecommendations(null)
        setAiLoading(false)
        return
      }

      const watchedSet = new Set(
        data.map((entry) => Number(entry.media_id)).filter(Number.isFinite),
      )
      setWatchedIds(Array.from(watchedSet))

      try {
        const aiResult = await buildAiRecommendations({
          listEntries: data,
          excludeIds: watchedSet,
          limit: 3,
        })

        if (!active) return

        if (aiResult.items.length > 0) {
          setAiMode("personalized")
          setAiSubtitle(aiResult.subtitle)
          setAiRecommendations(aiResult.items)
        } else {
          setAiRecommendations(null)
        }
      } catch (err) {
        console.warn("Failed to load AI recommendations:", err)
        if (active) {
          setAiRecommendations(null)
        }
      } finally {
        if (active) {
          setAiLoading(false)
        }
      }
    }

    loadAiRecommendations()

    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    let active = true

    const loadUserStats = async () => {
      if (!user) {
        setUserStats(null)
        return
      }

      const { data: entries, error: entriesError } = await client
        .from("list_entries")
        .select("progress")
        .eq("user_id", user.id)

      if (!active) return

      if (entriesError) {
        console.warn("Failed to load user stats:", entriesError)
        setUserStats(null)
        return
      }

      const totalEntries = entries?.length || 0
      const totalProgress = (entries || []).reduce(
        (sum, entry) => sum + (Number(entry.progress) || 0),
        0,
      )

      const { count: reviewCount, error: reviewError } = await client
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)

      if (!active) return

      if (reviewError) {
        console.warn("Failed to load review stats:", reviewError)
      }

      setUserStats([
        { label: "Titles tracked", value: totalEntries.toLocaleString(), icon: Eye },
        { label: "Progress logged", value: totalProgress.toLocaleString(), icon: Play },
        { label: "Reviews posted", value: (reviewCount || 0).toLocaleString(), icon: Heart },
      ])
    }

    loadUserStats()

    return () => {
      active = false
    }
  }, [user])

  const watchedSet = new Set(watchedIds)
  const fallbackRecommendations = trendingAnime
    .filter((anime) => !watchedSet.has(anime.id))
    .slice(0, 3)
    .map((anime) => ({
      id: anime.id,
      title: anime.title,
      image: anime.image,
      reason: "Trending right now",
      score: typeof anime.rating === "number" ? anime.rating : null,
    }))
  const displayRecommendations =
    aiRecommendations && aiRecommendations.length > 0 ? aiRecommendations : fallbackRecommendations
  const aiTitle = aiMode === "personalized" ? "AI Picks for You" : "Trending Picks"
  const aiBadge = aiMode === "personalized" ? "FOR YOU" : "TRENDING"
  const aiDescription = aiMode === "personalized" ? aiSubtitle : "Trending right now"
  const aiBusy = aiLoading || (aiMode === "trending" && trendingLoading)

  return (
    <div className="min-h-screen bg-background noise-overlay">
      <Navigation />

      <main className="pb-24 pt-20 md:pb-8">
        {/* Hero Section */}
        <section className="relative overflow-hidden px-4 py-12 md:py-20">
          {/* Animated background blobs - smoother animations */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-[100px] blob"
              style={{ animation: "float 8s cubic-bezier(0.4, 0, 0.2, 1) infinite" }}
            />
            <div
              className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/20 rounded-full blur-[100px] blob"
              style={{ animation: "float 8s cubic-bezier(0.4, 0, 0.2, 1) infinite 2s" }}
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-primary/5 to-accent/5 rounded-full blur-[120px]" />
          </div>

          <div className="relative mx-auto max-w-5xl text-center">
            {userStats && userStats.length > 0 && (
              <div className="mb-8 flex flex-wrap items-center justify-center gap-6">
                {userStats.map((stat, i) => {
                  const Icon = stat.icon
                  return (
                    <div
                      key={stat.label}
                      className="flex items-center gap-2 text-sm"
                      style={{
                        animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                        animationDelay: `${i * 100}ms`,
                        opacity: 0,
                      }}
                    >
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-gentle-pulse" />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground font-medium">{stat.value}</span>
                      <span className="text-muted-foreground">{stat.label}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Main headline - smoother stagger animations */}
            <h1
              className="mb-6 text-balance text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl"
              style={{
                animation: "fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                animationDelay: "200ms",
                opacity: 0,
              }}
            >
              Track anime
              <span className="relative mx-3">
                <span className="text-gradient">spoiler-free</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                  <path
                    d="M2 10C50 2 150 2 198 10"
                    stroke="url(#underline-gradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="animate-draw"
                  />
                  <defs>
                    <linearGradient id="underline-gradient" x1="0" y1="0" x2="200" y2="0">
                      <stop stopColor="var(--gradient-start)" />
                      <stop offset="1" stopColor="var(--gradient-end)" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>

            <p
              className="mx-auto mb-10 max-w-2xl text-pretty text-lg text-muted-foreground"
              style={{
                animation: "fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                animationDelay: "350ms",
                opacity: 0,
              }}
            >
              The anime tracker that actually gets it. AI recommendations, one-tap tracking, and a community that
              respects your watch progress.
            </p>

            {/* Search Bar */}
            <div
              className="mx-auto mb-10 max-w-xl"
              style={{
                animation: "fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                animationDelay: "500ms",
                opacity: 0,
              }}
            >
              <div className="relative group">
                <div
                  className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-accent/50 rounded-2xl blur-lg opacity-30 group-hover:opacity-60 transition-opacity duration-700"
                  style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                />
                <div className="relative flex items-center gap-2 bg-card/80 backdrop-blur-xl rounded-2xl p-2 border border-border/50">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          runSearch()
                        }
                      }}
                      placeholder="Search anime, manga, or users..."
                      className="h-12 pl-12 text-base rounded-xl bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                  <Button
                    size="lg"
                    onClick={runSearch}
                    className="h-12 px-6 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-500 btn-press"
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  >
                    Search
                  </Button>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div
              className="flex flex-wrap items-center justify-center gap-4"
              style={{
                animation: "fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                animationDelay: "650ms",
                opacity: 0,
              }}
            >
              {!user && (
                <Link href="/register">
                  <Button
                    size="lg"
                    className="gap-2 rounded-xl h-12 px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 glow-hover transition-all duration-500 btn-press group"
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  >
                    Start Tracking
                    <ArrowRight
                      className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-500"
                      style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                    />
                  </Button>
                </Link>
              )}
              <Link href="/discover">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 rounded-xl h-12 px-8 bg-transparent border-border/50 hover:bg-secondary/50 transition-all duration-500 group btn-press"
                  style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                >
                  <Play
                    className="h-4 w-4 group-hover:scale-110 transition-transform duration-500"
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  />
                  Discover Feed
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-4 py-8 md:py-12">
          <div className="mx-auto max-w-6xl">
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
              {features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <Card
                    key={feature.title}
                    className="min-w-[200px] md:min-w-0 bg-card/50 border-border/50 card-interactive group"
                    style={{
                      animation: "fade-in-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                      animationDelay: `${index * 100}ms`,
                      opacity: 0,
                    }}
                  >
                    <CardContent className="p-5">
                      <div
                        className={`mb-3 inline-flex rounded-xl bg-gradient-to-br ${feature.color} p-2.5 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}
                        style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                      >
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="mb-1 font-semibold text-foreground">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        {/* AI Recommendations */}
        <section className="px-4 py-8 md:py-12">
          <div className="mx-auto max-w-6xl">
            <div
              className="relative overflow-hidden rounded-3xl gradient-border p-[1px]"
              style={{
                animation: "fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                animationDelay: "100ms",
                opacity: 0,
              }}
            >
              <div className="rounded-3xl bg-card/80 backdrop-blur-sm p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-violet-500/50 rounded-xl blur-lg" />
                    <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Brain className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      {aiTitle}
                      <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-xs">
                        {aiBadge}
                      </Badge>
                    </h2>
                    <p className="text-sm text-muted-foreground">{aiDescription}</p>
                  </div>
                  <Link href="/ai-recommendations" className="ml-auto">
                    <Button variant="ghost" size="sm" className="gap-1 group">
                      See all{" "}
                      <ArrowRight
                        className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-500"
                        style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                      />
                    </Button>
                  </Link>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {aiBusy ? (
                    [...Array(3)].map((_, index) => (
                      <div
                        key={`ai-skeleton-${index}`}
                        className="flex gap-4 p-4 rounded-2xl bg-secondary/30 animate-pulse"
                      >
                        <div className="h-24 w-16 rounded-xl bg-secondary/60" />
                        <div className="flex-1 space-y-3">
                          <div className="h-4 w-3/4 rounded bg-secondary/60" />
                          <div className="h-3 w-1/2 rounded bg-secondary/50" />
                          <div className="h-7 w-20 rounded-lg bg-secondary/60" />
                        </div>
                      </div>
                    ))
                  ) : displayRecommendations.length > 0 ? (
                    displayRecommendations.map((anime, index) => (
                      <Link
                        key={anime.id}
                        href={`/media/${anime.id}`}
                        className="group flex gap-4 p-4 rounded-2xl bg-secondary/30 hover:bg-secondary/50 transition-all duration-500 spotlight-hover"
                        style={{
                          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                          animation: "fade-in-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                          animationDelay: `${200 + index * 100}ms`,
                          opacity: 0,
                        }}
                      >
                        <div className="relative">
                          <img
                            src={anime.image || "/placeholder.svg"}
                            alt={anime.title}
                            className="h-24 w-16 rounded-xl object-cover group-hover:scale-105 transition-transform duration-500"
                            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                          />
                          {typeof anime.score === "number" && (
                            <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
                              {anime.score.toFixed(1)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3
                            className="font-medium text-foreground truncate group-hover:text-primary transition-colors duration-500"
                            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                          >
                            {anime.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-violet-400" />
                            {anime.reason}
                          </p>
                          <Button size="sm" variant="secondary" className="mt-3 h-7 text-xs rounded-lg btn-press">
                            Open
                          </Button>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="col-span-full text-center text-sm text-muted-foreground">
                      No recommendations yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trending Anime */}
        <section className="px-4 py-8 md:py-12">
          <div className="mx-auto max-w-6xl">
            <SectionHeader title="Trending Now" href="/search?sort=trending" icon={TrendingUp} />
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {trendingLoading ? (
                [...Array(6)].map((_, index) => (
                  <div key={`trending-skeleton-${index}`} className="animate-pulse">
                    <div className="aspect-[3/4] rounded-2xl bg-secondary/50" />
                    <div className="mt-3 h-3 w-3/4 rounded bg-secondary/40" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-secondary/30" />
                  </div>
                ))
              ) : trendingAnime.length > 0 ? (
                trendingAnime.map((anime, index) => <AnimeCard key={anime.id} {...anime} index={index} />)
              ) : (
                <div className="col-span-full text-center text-sm text-muted-foreground">
                  No trending anime found.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* New Releases */}
        <section className="px-4 py-8 md:py-12">
          <div className="mx-auto max-w-6xl">
            <SectionHeader title="New Releases" href="/search?sort=newest" icon={Sparkles} />
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {newReleasesLoading ? (
                [...Array(4)].map((_, index) => (
                  <div key={`new-skeleton-${index}`} className="animate-pulse">
                    <div className="aspect-[3/4] rounded-2xl bg-secondary/50" />
                    <div className="mt-3 h-3 w-3/4 rounded bg-secondary/40" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-secondary/30" />
                  </div>
                ))
              ) : newReleases.length > 0 ? (
                newReleases.map((anime, index) => <AnimeCard key={anime.id} {...anime} index={index} />)
              ) : (
                <div className="col-span-full text-center text-sm text-muted-foreground">No new releases found.</div>
              )}
            </div>
          </div>
        </section>

        {/* Premium CTA */}
        <section className="px-4 py-8 md:py-12">
          <div className="mx-auto max-w-4xl">
            <div
              className="relative overflow-hidden rounded-3xl"
              style={{
                animation: "fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                animationDelay: "100ms",
                opacity: 0,
              }}
            >
              {/* Animated gradient background */}
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-orange-500/30 to-amber-500/20 animate-gradient" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />

              <div className="relative p-8 md:p-12">
                <div className="flex flex-col md:flex-row md:items-center gap-8">
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 mb-4">
                      <Crown className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-medium text-gradient-gold">Hikari Premium</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                      Level up your anime experience
                    </h2>
                    <p className="text-muted-foreground mb-6 max-w-lg">
                      Auto-tracking, unlimited AI recommendations, ad-free experience, and exclusive Discord access.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Link href="/premium">
                        <Button
                          size="lg"
                          className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 rounded-xl btn-press transition-all duration-500"
                          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                        >
                          <Zap className="h-4 w-4" />
                          Go Premium
                        </Button>
                      </Link>
                      <Link href="/extension">
                        <Button
                          size="lg"
                          variant="outline"
                          className="gap-2 bg-transparent border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-xl btn-press transition-all duration-500"
                          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                        >
                          <Chrome className="h-4 w-4" />
                          Get Extension
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Floating price card */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 to-orange-500/30 rounded-2xl blur-xl" />
                    <div className="relative bg-card/90 backdrop-blur-xl rounded-2xl p-6 border border-amber-500/20">
                      <p className="text-sm text-muted-foreground mb-1">Starting at</p>
                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-4xl font-bold text-gradient-gold">$4</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2 text-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Auto-tracking extension
                        </li>
                        <li className="flex items-center gap-2 text-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Unlimited AI recs
                        </li>
                        <li className="flex items-center gap-2 text-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          No ads, ever
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Import CTA */}
        <section className="px-4 py-8 md:py-12">
          <div className="mx-auto max-w-4xl">
            <Card
              className="bg-card/50 border-border/50 overflow-hidden"
              style={{
                animation: "fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                animationDelay: "100ms",
                opacity: 0,
              }}
            >
              <CardContent className="p-8 md:p-12 text-center relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
                <h2 className="mb-4 text-2xl font-bold text-foreground md:text-3xl relative">
                  Already tracking somewhere else?
                </h2>
                <p className="mb-6 text-muted-foreground relative">
                  Import your lists from MyAnimeList, AniList, or Kitsu in seconds.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4 relative">
                  <Link href="/import">
                    <Button size="lg" className="gap-2 rounded-xl btn-press">
                      Import Your List
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}
