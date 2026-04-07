"use client"

import { Navigation } from "@/components/Navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  X,
  Sparkles,
  TrendingUp,
  Clock,
  Star,
  Play,
  Plus,
  Filter,
  Grid3X3,
  LayoutList,
  Check,
  Loader2,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { addNotification } from "@/lib/notifications-store"
import { awardXp, XP_ACTIONS } from "@/lib/xp"

const fallbackTrendingSearches = {
  ANIME: ["Solo Leveling", "Frieren", "Dandadan", "Blue Lock", "Chainsaw Man"],
  MANGA: ["One Piece", "Jujutsu Kaisen", "Chainsaw Man", "Kingdom", "Berserk"],
}

const genres = [
  { name: "Action", color: "from-red-500 to-orange-500", icon: "\u2694\uFE0F" },
  { name: "Romance", color: "from-pink-500 to-rose-500", icon: "\u{1F496}" },
  { name: "Comedy", color: "from-yellow-500 to-amber-500", icon: "\u{1F602}" },
  { name: "Fantasy", color: "from-purple-500 to-indigo-500", icon: "\u2728" },
  { name: "Horror", color: "from-gray-700 to-gray-900", icon: "\u{1F47B}" },
  { name: "Sci-Fi", color: "from-cyan-500 to-blue-500", icon: "\u{1F680}" },
  { name: "Slice of Life", color: "from-green-500 to-emerald-500", icon: "\u{1F338}" },
  { name: "Sports", color: "from-orange-500 to-red-500", icon: "\u26BD" },
]

const QUERY = `
query ($search: String, $type: MediaType, $page: Int, $perPage: Int, $genres: [String]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      currentPage
      hasNextPage
    }
    media(search: $search, type: $type, genre_in: $genres, sort: POPULARITY_DESC) {
      id
      type
      title { romaji english native }
      coverImage { large }
      format
      episodes
      chapters
      nextAiringEpisode { episode }
      averageScore
      status
      genres
    }
  }
}
`

const getCurrentCount = (media, mangaFallback = {}) => {
  if (!media) return null
  if (media.type === "ANIME") {
    if (media.episodes !== null && media.episodes !== undefined) return media.episodes
    if (media.nextAiringEpisode?.episode) return Math.max(media.nextAiringEpisode.episode - 1, 0)
    return null
  }
  if (media.type === "MANGA") return media.chapters ?? mangaFallback[media.id] ?? null
  return null
}

const formatCountLabel = (media, variant = "short", mangaFallback = {}) => {
  const count = getCurrentCount(media, mangaFallback)
  const isOngoing = media?.status === "RELEASING"
  if (count !== null && count !== undefined) {
    if (variant === "short") return `${count} ${media.type === "ANIME" ? "eps" : "ch"}`
    return `${count} ${media.type === "ANIME" ? "episodes" : "chapters"}`
  }
  if (isOngoing) return "Ongoing"
  return "Unknown"
}
const TRENDING_SEARCHES_QUERY = `
query ($page: Int, $perPage: Int, $type: MediaType) {
  Page(page: $page, perPage: $perPage) {
    media(type: $type, sort: TRENDING_DESC) {
      id
      title { romaji english }
    }
  }
}
`

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [query, setQuery] = useState("")
  const [searchType, setSearchType] = useState("ANIME")
  const [trendingSearches, setTrendingSearches] = useState([])
  const [activeGenres, setActiveGenres] = useState([])
  const [viewMode, setViewMode] = useState("grid")
  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [trendingLoading, setTrendingLoading] = useState(true)
  const [mangaCounts, setMangaCounts] = useState({})
  const [quickAddState, setQuickAddState] = useState({})
  const lastSearchRef = useRef("")
  const lastGenresRef = useRef("")
  const loadMoreRef = useRef(null)
  const mangaRequestedRef = useRef(new Set())
  const quickAddTimeoutsRef = useRef({})

  const clearQuickAddState = (mediaId) => {
    setQuickAddState((prev) => {
      const next = { ...prev }
      delete next[mediaId]
      return next
    })
  }

  const handleQuickAdd = async (media) => {
    if (!media?.id) return
    if (!user) {
      router.push("/login")
      return
    }

    const mediaId = media.id
    if (quickAddState[mediaId] === "adding" || quickAddState[mediaId] === "added") return

    setQuickAddState((prev) => ({ ...prev, [mediaId]: "adding" }))

    try {
      const { data: existingEntry, error: existingError } = await client
        .from("list_entries")
        .select("id")
        .eq("user_id", user.id)
        .eq("media_id", mediaId)
        .maybeSingle()

      if (existingError && existingError.code !== "PGRST116") {
        throw existingError
      }

      if (existingEntry?.id) {
        setQuickAddState((prev) => ({ ...prev, [mediaId]: "added" }))
        addNotification(user.id, {
          title: "Already in your list",
          message: `${media.title?.english || media.title?.romaji || "This title"} is already saved.`,
          type: "list",
        })
        return
      }

      const { error: insertError } = await client.from("list_entries").insert({
        user_id: user.id,
        media_id: mediaId,
        media_type: media.type,
        status: "plan_to_watch",
        progress: 0,
      })

      if (insertError) {
        throw insertError
      }

      await awardXp(user, XP_ACTIONS.list_add, "list_add")
      addNotification(user.id, {
        title: "Added to your list",
        message: `${media.title?.english || media.title?.romaji || "This title"} is now in your plan.`,
        type: "list",
      })
      setQuickAddState((prev) => ({ ...prev, [mediaId]: "added" }))
    } catch (err) {
      console.error("Quick add failed:", err)
      setQuickAddState((prev) => ({ ...prev, [mediaId]: "error" }))
      if (quickAddTimeoutsRef.current[mediaId]) {
        clearTimeout(quickAddTimeoutsRef.current[mediaId])
      }
      quickAddTimeoutsRef.current[mediaId] = setTimeout(() => clearQuickAddState(mediaId), 2000)
    }
  }

  const toggleGenre = (genre) => {
    const next = activeGenres.includes(genre)
      ? activeGenres.filter((g) => g !== genre)
      : [...activeGenres, genre]
    setActiveGenres(next)
    runSearch(query, { genresOverride: next })
  }

  const runSearch = useCallback(
    async (searchValue, { updateUrl = true, typeOverride, genresOverride, pageOverride = 1, append = false } = {}) => {
      const normalized = (searchValue || "").trim()
      const typeValue = typeOverride || searchType
      const genresValue = genresOverride ?? activeGenres
      const hasGenres = genresValue.length > 0
      const pageValue = pageOverride || 1

      if (!normalized && !hasGenres) {
        setResults([])
        setShowResults(false)
        setLoading(false)
        setLoadingMore(false)
        setPage(1)
        setHasMore(false)
        lastSearchRef.current = ""
        lastGenresRef.current = ""
        if (updateUrl) {
          const params = new URLSearchParams()
          if (typeValue && typeValue !== "ANIME") {
            params.set("type", typeValue.toLowerCase())
          }
          const queryString = params.toString()
          router.push(`/search${queryString ? `?${queryString}` : ""}`)
        }
        return
      }

      setQuery(normalized)
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setShowResults(true)
      lastSearchRef.current = normalized
      lastGenresRef.current = genresValue.join("|")

      if (updateUrl) {
        const params = new URLSearchParams()
        if (normalized) {
          params.set("query", normalized)
        }
        if (typeValue && typeValue !== "ANIME") {
          params.set("type", typeValue.toLowerCase())
        }
        if (hasGenres) {
          params.set("genres", genresValue.join(","))
        }
        router.push(`/search?${params.toString()}`)
      }

      try {
        const res = await fetch("/api/anilist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: QUERY,
            variables: {
              search: normalized || undefined,
              type: typeValue,
              page: pageValue,
              perPage: 24,
              genres: hasGenres ? genresValue : undefined,
            },
          }),
        })

        const data = await res.json()

        if (!res.ok || data?.errors) {
          throw new Error(data?.errors?.[0]?.message || "Search failed")
        }

        const pageData = data?.data?.Page
        const media = pageData?.media || []
        const nextHasMore = pageData?.pageInfo?.hasNextPage ?? false

        setHasMore(nextHasMore)
        setPage(pageValue)
        if (append) {
          setResults((prev) => [...prev, ...media])
        } else {
          setResults(media)
        }
      } catch (err) {
        console.error("Search error:", err)
        if (!append) {
          setResults([])
        }
      } finally {
        if (append) {
          setLoadingMore(false)
        } else {
          setLoading(false)
        }
      }
    },
    [activeGenres, router, searchType],
  )

  useEffect(() => {
    let isActive = true

    const loadTrending = async () => {
      setTrendingLoading(true)

      try {
        const res = await fetch("/api/anilist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: TRENDING_SEARCHES_QUERY,
            variables: { page: 1, perPage: 6, type: searchType },
          }),
        })

        const data = await res.json()

        if (!res.ok || data?.errors) {
          const fallback = fallbackTrendingSearches[searchType] || fallbackTrendingSearches.ANIME
          if (isActive) {
            setTrendingSearches(fallback)
          }
          return
        }

        const titles = (data?.data?.Page?.media ?? [])
          .map((media) => media.title?.english || media.title?.romaji)
          .filter(Boolean)

        const uniqueTitles = Array.from(new Set(titles))

        if (isActive) {
          setTrendingSearches(uniqueTitles)
        }
      } catch (err) {
        const fallback = fallbackTrendingSearches[searchType] || fallbackTrendingSearches.ANIME
        if (isActive) {
          setTrendingSearches(fallback)
        }
      } finally {
        if (isActive) {
          setTrendingLoading(false)
        }
      }
    }

    loadTrending()

    return () => {
      isActive = false
    }
  }, [searchType])

  useEffect(() => {
    let active = true

    const loadMangaCounts = async () => {
      if (searchType !== "MANGA") return
      const pending = results.filter(
        (media) =>
          media.type === "MANGA" &&
          (media.chapters === null || media.chapters === undefined) &&
          !mangaRequestedRef.current.has(media.id),
      )

      for (const media of pending) {
        mangaRequestedRef.current.add(media.id)
        const title = media.title?.english || media.title?.romaji
        if (!title) continue
        try {
          const res = await fetch("/api/mangadex", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          })
          const data = await res.json()
          if (!res.ok || data?.error) continue
          if (active && data?.chapterCount) {
            setMangaCounts((prev) => ({ ...prev, [media.id]: data.chapterCount }))
          }
        } catch (err) {
          // ignore and keep fallback
        }
      }
    }

    loadMangaCounts()

    return () => {
      active = false
    }
  }, [results, searchType])

  useEffect(() => {
    return () => {
      Object.values(quickAddTimeoutsRef.current).forEach((timeoutId) => clearTimeout(timeoutId))
      quickAddTimeoutsRef.current = {}
    }
  }, [])

  useEffect(() => {
    const paramQuery = (searchParams.get("query") || "").trim()
    const paramType = (searchParams.get("type") || "").toUpperCase()
    const paramGenres = (searchParams.get("genres") || "")
      .split(",")
      .map((genre) => genre.trim())
      .filter(Boolean)
    const nextType = paramType === "MANGA" ? "MANGA" : "ANIME"
    const paramGenresKey = paramGenres.join("|")

    if (nextType !== searchType) {
      setSearchType(nextType)
    }

    if (paramGenresKey !== lastGenresRef.current) {
      lastGenresRef.current = paramGenresKey
      setActiveGenres(paramGenres)
    }

    if (!paramQuery && paramGenres.length === 0) {
      if (lastSearchRef.current) {
        lastSearchRef.current = ""
        lastGenresRef.current = ""
        setQuery("")
        setShowResults(false)
        setResults([])
      }
      return
    }

    if (paramQuery === lastSearchRef.current && paramGenresKey === lastGenresRef.current) {
      setQuery(paramQuery)
      return
    }

    runSearch(paramQuery, { updateUrl: false, typeOverride: nextType, genresOverride: paramGenres })
  }, [searchParams, runSearch, searchType])

  useEffect(() => {
    if (!showResults) return
    if (!hasMore) return
    const node = loadMoreRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && !loading && !loadingMore) {
          runSearch(query, {
            updateUrl: false,
            typeOverride: searchType,
            genresOverride: activeGenres,
            pageOverride: page + 1,
            append: true,
          })
        }
      },
      { rootMargin: "200px" },
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [showResults, hasMore, loading, loadingMore, page, query, searchType, activeGenres, runSearch])

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="pt-24 pb-24 md:pb-8">
        <div className="px-4 md:px-8">
          <div className="mx-auto max-w-5xl">
            {/* Hero Search Area */}
            <div className="mb-12 animate-fade-in-up">
              <div className="text-center mb-8">
                <h1 className="text-4xl md:text-5xl font-bold mb-3">
                  <span className="text-gradient">Discover</span> Your Next
                </h1>
                <h1 className="text-4xl md:text-5xl font-bold mb-4">Favorite Anime</h1>
                <p className="text-muted-foreground text-lg">Search through thousands of anime and manga titles</p>
              </div>

              {/* Big Search Bar */}
              <div className="relative max-w-2xl mx-auto">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary via-accent to-primary rounded-2xl blur-lg opacity-30 animate-gradient-flow" />
                <div className="relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runSearch(e.currentTarget.value)
                    }}
                    placeholder="Search anime, manga, characters..."
                    className="h-16 pl-14 pr-14 text-lg rounded-2xl bg-card border-none shadow-xl focus-visible:ring-2 focus-visible:ring-primary/50"
                  />
                  {query && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl hover:bg-secondary"
                      onClick={() => {
                        setQuery("")
                        lastSearchRef.current = ""
                        runSearch("", { genresOverride: activeGenres })
                      }}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Type Toggle */}
              <div className="mt-4 flex justify-center">
                <div className="inline-flex rounded-xl bg-secondary/50 p-1">
                  <Button
                    size="sm"
                    variant={searchType === "ANIME" ? "secondary" : "ghost"}
                    className="rounded-lg px-4"
                    onClick={() => {
                      const nextType = "ANIME"
                      setSearchType(nextType)
                      runSearch(query, { typeOverride: nextType, genresOverride: activeGenres })
                    }}
                  >
                    Anime
                  </Button>
                  <Button
                    size="sm"
                    variant={searchType === "MANGA" ? "secondary" : "ghost"}
                    className="rounded-lg px-4"
                    onClick={() => {
                      const nextType = "MANGA"
                      setSearchType(nextType)
                      runSearch(query, { typeOverride: nextType, genresOverride: activeGenres })
                    }}
                  >
                    Manga
                  </Button>
                </div>
              </div>
            </div>

            {!showResults ? (
              <>
                {/* Trending Searches */}
                <div className="mb-10 animate-fade-in-up stagger-2 opacity-0" style={{ animationFillMode: "forwards" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Trending Now</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {trendingLoading ? (
                      <div className="w-full text-sm text-muted-foreground">Loading trending searches...</div>
                    ) : trendingSearches.length > 0 ? (
                      trendingSearches.map((search, i) => (
                        <button
                          key={search}
                          onClick={() => {
                            runSearch(search)
                          }}
                          className="group px-4 py-2.5 rounded-xl bg-card hover:bg-secondary border border-border/50 transition-all duration-300 hover:scale-105 hover:shadow-lg animate-pop-in opacity-0"
                          style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "forwards" }}
                        >
                          <span className="text-sm font-medium group-hover:text-primary transition-colors">{search}</span>
                        </button>
                      ))
                    ) : (
                      <div className="w-full text-sm text-muted-foreground">No trending searches right now.</div>
                    )}
                  </div>
                </div>

                {/* Browse by Genre */}
                <div className="animate-fade-in-up stagger-3 opacity-0" style={{ animationFillMode: "forwards" }}>
                  <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="h-5 w-5 text-accent" />
                    <span className="font-semibold">Browse by Genre</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {genres.map((genre, i) => (
                      <button
                        key={genre.name}
                        onClick={() => toggleGenre(genre.name)}
                        className={`group relative overflow-hidden rounded-2xl p-5 transition-all duration-500 hover:scale-[1.02] hover:shadow-xl animate-pop-in opacity-0 ${
                          activeGenres.includes(genre.name)
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : ""
                        }`}
                        style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "forwards" }}
                      >
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${genre.color} opacity-80 group-hover:opacity-100 transition-opacity duration-300`}
                        />
                        <div className="absolute inset-0 bg-black/20" />
                        <div className="relative z-10 flex flex-col items-start gap-2">
                          <span className="text-2xl">{genre.icon}</span>
                          <span className="font-semibold text-white text-lg">{genre.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* Search Results */
              <div>
                {/* Active Filters */}
                {activeGenres.length > 0 && (
                  <div className="flex items-center gap-2 mb-6 flex-wrap">
                    <span className="text-sm text-muted-foreground">Filters:</span>
                    {activeGenres.map((genre) => (
                      <Badge
                        key={genre}
                        className="gap-1.5 px-3 py-1.5 cursor-pointer hover:bg-primary/80 transition-colors"
                        onClick={() => toggleGenre(genre)}
                      >
                        {genre}
                        <X className="h-3 w-3" />
                      </Badge>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setActiveGenres([])
                        runSearch(query, { genresOverride: [] })
                      }}
                    >
                      Clear all
                    </Button>
                  </div>
                )}

                {/* Results Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Showing <span className="text-foreground font-medium">{results.length}</span> results
                      {query && (
                        <>
                          {" "}
                          for <span className="text-primary font-medium">"{query}"</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                      <Filter className="h-4 w-4" />
                    </Button>
                    <div className="flex bg-secondary/50 rounded-lg p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 rounded-md transition-colors ${viewMode === "grid" ? "bg-background shadow-sm" : ""}`}
                        onClick={() => setViewMode("grid")}
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 rounded-md transition-colors ${viewMode === "list" ? "bg-background shadow-sm" : ""}`}
                        onClick={() => setViewMode("list")}
                      >
                        <LayoutList className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Results Grid/List */}
                {loading ? (
                  <div className="text-center py-12 text-muted-foreground">Searching...</div>
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {results.map((anime, index) => {
                      const title = anime.title.english || anime.title.romaji
                      const isOngoing = anime.status === "RELEASING"
                      const countLabel = formatCountLabel(anime, "short", mangaCounts)
                      return (
                        <Link
                          href={`/media/${anime.id}`}
                          key={anime.id}
                          className="group animate-fade-in-up opacity-0"
                          style={{ animationDelay: `${index * 0.05}s`, animationFillMode: "forwards" }}
                        >
                          <div className="relative overflow-hidden rounded-2xl bg-card">
                            <div className="aspect-[3/4] relative overflow-hidden">
                              <img
                                src={anime.coverImage?.large || "/placeholder.svg"}
                                alt={title}
                                className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                              <div className="absolute inset-x-0 bottom-0 p-4">
                                <h3 className="font-semibold text-sm text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.9)] group-hover:text-primary transition-colors">
                                {title}
                                </h3>
                                <div className="flex items-center justify-between mt-1.5 text-xs text-white/75">
                                  <div className="flex items-center gap-2">
                                    <span>{countLabel}</span>
                                    {isOngoing && countLabel !== "Ongoing" && (
                                      <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">Ongoing</Badge>
                                    )}
                                  </div>
                                  {anime.averageScore && (
                                    <div className="flex items-center gap-1">
                                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                      <span>{(anime.averageScore / 10).toFixed(1)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="hidden p-3">
                              <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                                {title}
                              </h3>
                              <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <span>{countLabel}</span>
                                  {isOngoing && countLabel !== "Ongoing" && (
                                    <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">Ongoing</Badge>
                                  )}
                                </div>
                                {anime.averageScore && (
                                  <div className="flex items-center gap-1">
                                    <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                    <span>{(anime.averageScore / 10).toFixed(1)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {results.map((anime, index) => {
                      const title = anime.title.english || anime.title.romaji
                      const isOngoing = anime.status === "RELEASING"
                      const countLabel = formatCountLabel(anime, "long", mangaCounts)
                      return (
                        <Link
                          href={`/media/${anime.id}`}
                          key={anime.id}
                          className="group animate-fade-in-up opacity-0"
                          style={{ animationDelay: `${index * 0.05}s`, animationFillMode: "forwards" }}
                        >
                          <div className="flex gap-4 p-4 rounded-2xl bg-card hover:bg-secondary/50 transition-all duration-300 border border-transparent hover:border-border/50">
                            <div className="relative w-24 h-32 rounded-xl overflow-hidden flex-shrink-0">
                              <img
                                src={anime.coverImage?.large || "/placeholder.svg"}
                                alt={title}
                                className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                                    {title}
                                  </h3>
                                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                    <span>{countLabel}</span>
                                    {isOngoing && countLabel !== "Ongoing" && (
                                      <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">
                                        Ongoing
                                      </Badge>
                                    )}
                                    {anime.status && (
                                      <>
                                        <span>-</span>
                                        <Badge
                                          className={`text-[10px] ${
                                            anime.status === "RELEASING"
                                              ? "bg-green-500/20 text-green-400"
                                              : anime.status === "FINISHED"
                                                ? "bg-blue-500/20 text-blue-400"
                                                : "bg-amber-500/20 text-amber-400"
                                          }`}
                                        >
                                          {anime.status}
                                        </Badge>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {anime.averageScore && (
                                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10">
                                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                                    <span className="font-semibold text-amber-400">{(anime.averageScore / 10).toFixed(1)}</span>
                                  </div>
                                )}
                              </div>
                              {anime.genres && anime.genres.length > 0 && (
                                <div className="flex items-center gap-2 mt-3">
                                  {anime.genres.slice(0, 3).map((g) => (
                                    <Badge key={g} variant="outline" className="text-xs bg-transparent">
                                      {g}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}

                <div ref={loadMoreRef} className="h-10" />
                {loadingMore && <div className="text-center py-6 text-muted-foreground">Loading more...</div>}
                {!loading && !loadingMore && results.length > 0 && !hasMore && (
                  <div className="text-center py-6 text-muted-foreground">You're all caught up.</div>
                )}

                {!loading && results.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">No results found</div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
