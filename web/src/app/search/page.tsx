"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Navigation } from "@/components/Navigation"
import { AnimeDecorations } from "@/components/anime-decorations"
import {
  Search,
  Grid,
  List,
  Star,
  Heart,
  Plus,
  ChevronDown,
  X,
  SlidersHorizontal,
  Loader2,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { fetchAniList, formatAniListStatus, getEpisodeCount, getMediaHref, getMediaTitle, getPreferredStreamingLink, getPrimaryStudio } from "@/lib/anilist"

const genres = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
]

const sortOptions = {
  popularity: ["POPULARITY_DESC"],
  rating: ["SCORE_DESC", "POPULARITY_DESC"],
  newest: ["START_DATE_DESC", "POPULARITY_DESC"],
  alphabetical: ["TITLE_ROMAJI"],
}

const SEARCH_QUERY = `
query ($search: String, $page: Int, $perPage: Int, $genres: [String], $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      currentPage
      hasNextPage
      total
    }
    media(type: ANIME, search: $search, genre_in: $genres, sort: $sort, isAdult: false) {
      id
      title { romaji english native }
      coverImage { extraLarge large }
      averageScore
      episodes
      nextAiringEpisode { episode }
      status
      genres
      startDate { year }
      studios(isMain: true) { nodes { name } }
      externalLinks { site url type }
    }
  }
}
`

const buildSearchUrl = (queryValue, selectedGenres, sortBy) => {
  const params = new URLSearchParams()
  if (queryValue) params.set("query", queryValue)
  if (selectedGenres.length) params.set("genres", selectedGenres.join(","))
  if (sortBy && sortBy !== "popularity") params.set("sort", sortBy)
  const queryString = params.toString()
  return queryString ? `/search?${queryString}` : "/search"
}

const parseGenres = (value) =>
  String(value || "")
    .split(",")
    .map((genre) => genre.trim())
    .filter((genre) => genres.includes(genre))

export default function BrowsePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const [searchQuery, setSearchQuery] = useState("")
  const [activeQuery, setActiveQuery] = useState("")
  const [viewMode, setViewMode] = useState("grid")
  const [selectedGenres, setSelectedGenres] = useState([])
  const [sortBy, setSortBy] = useState("popularity")
  const [isLoaded, setIsLoaded] = useState(false)
  const [results, setResults] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [quickAddState, setQuickAddState] = useState({})

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    const nextQuery = (searchParams.get("query") || "").trim()
    const nextGenres = parseGenres(searchParams.get("genres"))
    const nextSort = searchParams.get("sort") || "popularity"

    setSearchQuery((current) => (current === nextQuery ? current : nextQuery))
    setActiveQuery((current) => (current === nextQuery ? current : nextQuery))
    setSelectedGenres((current) => (current.join("|") === nextGenres.join("|") ? current : nextGenres))
    setSortBy((current) => (current === nextSort ? current : nextSort))
  }, [searchParams])

  const fetchPage = async (nextPage, append = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setError("")
    }

    try {
      const data = await fetchAniList(SEARCH_QUERY, {
        search: activeQuery || undefined,
        page: nextPage,
        perPage: 24,
        genres: selectedGenres.length ? selectedGenres : undefined,
        sort: sortOptions[sortBy] || sortOptions.popularity,
      })

      const pageData = data?.Page
      const nextResults = pageData?.media || []

      setResults((current) => (append ? [...current, ...nextResults] : nextResults))
      setPage(pageData?.pageInfo?.currentPage || nextPage)
      setHasMore(Boolean(pageData?.pageInfo?.hasNextPage))
      setTotal(pageData?.pageInfo?.total || nextResults.length)
    } catch (loadError) {
      console.error("Failed to load browse results:", loadError)
      if (!append) {
        setResults([])
        setHasMore(false)
        setTotal(0)
        setError("Could not load anime right now.")
      }
    } finally {
      if (append) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchPage(1)
  }, [activeQuery, selectedGenres, sortBy])

  const applyFilters = (nextQuery, nextGenres, nextSort) => {
    const trimmedQuery = (nextQuery || "").trim()
    setSearchQuery(trimmedQuery)
    setActiveQuery(trimmedQuery)
    setSelectedGenres(nextGenres)
    setSortBy(nextSort)
    router.push(buildSearchUrl(trimmedQuery, nextGenres, nextSort))
  }

  const toggleGenre = (genre) => {
    const nextGenres = selectedGenres.includes(genre)
      ? selectedGenres.filter((value) => value !== genre)
      : [...selectedGenres, genre]

    applyFilters(searchQuery, nextGenres, sortBy)
  }

  const handleSearchSubmit = () => {
    applyFilters(searchQuery, selectedGenres, sortBy)
  }

  const handleSortChange = (value) => {
    applyFilters(searchQuery, selectedGenres, value)
  }

  const handleQuickAdd = async (anime, event) => {
    event.preventDefault()
    event.stopPropagation()

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }

    const mediaId = anime?.id
    if (!mediaId || quickAddState[mediaId] === "adding") return

    setQuickAddState((current) => ({ ...current, [mediaId]: "adding" }))

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

      if (!existingEntry?.id) {
        const { error: insertError } = await client.from("list_entries").insert({
          user_id: user.id,
          media_id: mediaId,
          media_type: "ANIME",
          status: "plan_to_watch",
          progress: 0,
        })

        if (insertError) throw insertError
      }

      setQuickAddState((current) => ({ ...current, [mediaId]: "added" }))
      window.setTimeout(() => {
        setQuickAddState((current) => {
          const next = { ...current }
          delete next[mediaId]
          return next
        })
      }, 1800)
    } catch (addError) {
      console.error("Failed to add anime to list:", addError)
      setQuickAddState((current) => ({ ...current, [mediaId]: "error" }))
      window.setTimeout(() => {
        setQuickAddState((current) => {
          const next = { ...current }
          delete next[mediaId]
          return next
        })
      }, 1800)
    }
  }

  const resultsLabel = useMemo(() => {
    if (loading) return "Loading anime..."
    if (!results.length) return "No anime found"
    return total ? `Showing ${results.length} of ${total} anime` : `Showing ${results.length} anime`
  }, [loading, results.length, total])

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimeDecorations variant="sparse" />
      <Navigation />

      <main className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Browse Anime</h1>
            <p className="text-muted-foreground">
              Search for your next watch and explore top titles from across the catalog.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass-card p-4 mb-6"
          >
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search anime..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSearchSubmit()
                  }}
                  className="pl-10 bg-background/50"
                />
              </div>

              <Button className="lg:w-auto" onClick={handleSearchSubmit}>
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>

              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-full lg:w-48 bg-background/50">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popularity">Popularity</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="alphabetical">A-Z</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
                <Button
                  size="sm"
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  onClick={() => setViewMode("grid")}
                  className="px-3"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "list" ? "default" : "ghost"}
                  onClick={() => setViewMode("list")}
                  className="px-3"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="lg:hidden">
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Filters
                    {selectedGenres.length > 0 && (
                      <Badge className="ml-2 bg-accent">{selectedGenres.length}</Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <h4 className="font-medium mb-3">Genres</h4>
                    <div className="space-y-2">
                      {genres.map((genre) => (
                        <div key={genre} className="flex items-center gap-2">
                          <Checkbox
                            id={`mobile-${genre}`}
                            checked={selectedGenres.includes(genre)}
                            onCheckedChange={() => toggleGenre(genre)}
                          />
                          <label htmlFor={`mobile-${genre}`} className="text-sm cursor-pointer">
                            {genre}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div className="hidden lg:flex flex-wrap gap-2 mt-4">
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    selectedGenres.includes(genre)
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>

            {selectedGenres.length > 0 && (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50 flex-wrap">
                <span className="text-sm text-muted-foreground">Active:</span>
                {selectedGenres.map((genre) => (
                  <Badge
                    key={genre}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    onClick={() => toggleGenre(genre)}
                  >
                    {genre}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applyFilters(searchQuery, [], sortBy)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </Button>
              </div>
            )}
          </motion.div>

          <div className="flex items-center justify-between gap-4 mb-4">
            <p className="text-sm text-muted-foreground">{resultsLabel}</p>
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="aspect-[3/4] rounded-xl bg-white/5 animate-pulse border border-white/5" />
              ))}
            </div>
          ) : !results.length ? (
            <div className="glass-card p-12 text-center">
              <h2 className="text-xl font-semibold text-foreground mb-2">Nothing matched that search</h2>
              <p className="text-muted-foreground mb-6">
                Try a different title, remove a genre filter, or switch the sort.
              </p>
              <Button variant="outline" onClick={() => applyFilters("", [], "popularity")}>
                Reset Browse
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {results.map((anime, index) => {
                const title = getMediaTitle(anime)
                const rating = anime?.averageScore ? Number((anime.averageScore / 10).toFixed(1)) : null
                const episodeCount = getEpisodeCount(anime)
                const watchLink = getPreferredStreamingLink(anime)

                return (
                  <motion.div
                    key={anime.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.9 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                    className="group cursor-pointer"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,24,0.98)_0%,rgba(5,9,14,1)_100%)] shadow-[0_18px_44px_rgba(0,0,0,0.35)] transition-all duration-500 group-hover:-translate-y-1 group-hover:border-primary/30 group-hover:shadow-[0_28px_64px_rgba(4,14,24,0.55)]">
                      <Link href={getMediaHref(anime)} className="absolute inset-0 z-10" aria-label={`Open ${title}`} />
                      <Image
                        src={anime?.coverImage?.extraLarge || anime?.coverImage?.large || "/placeholder.svg"}
                        alt={title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_42%),linear-gradient(180deg,rgba(4,10,18,0.08)_0%,rgba(4,10,18,0.34)_40%,rgba(3,6,10,0.95)_100%)]" />

                      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
                        <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-md">
                          {episodeCount ? `${episodeCount} eps` : formatAniListStatus(anime?.status)}
                        </span>
                        {rating ? (
                          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span>{rating}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <h3 className="line-clamp-2 text-sm font-semibold text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.9)] transition-colors duration-500 group-hover:text-primary">
                          {title}
                        </h3>
                        <p className="mt-1 text-xs text-white/65 drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]">
                          {[anime?.startDate?.year, getPrimaryStudio(anime)].filter(Boolean).join(" / ")}
                        </p>
                        {watchLink?.url ? (
                          <a
                            href={watchLink.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="relative z-20 mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/12 bg-black/45 px-3 py-1.5 text-[11px] font-medium text-white/85 backdrop-blur-md transition-colors hover:border-primary/35 hover:text-primary"
                          >
                            <span className="truncate">Watch on {watchLink.site}</span>
                          </a>
                        ) : null}
                      </div>

                      <div className="absolute inset-x-4 bottom-0 overflow-hidden rounded-t-full">
                        <div className="h-1.5 w-full rounded-full bg-white/10">
                          <div className="h-full w-0 rounded-full bg-gradient-to-r from-primary via-cyan-300 to-accent transition-all duration-500 group-hover:w-full" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((anime, index) => {
                const title = getMediaTitle(anime)
                const rating = anime?.averageScore ? Number((anime.averageScore / 10).toFixed(1)) : null
                const episodeCount = getEpisodeCount(anime)
                const studio = getPrimaryStudio(anime)
                const quickState = quickAddState[anime.id]
                const watchLink = getPreferredStreamingLink(anime)

                return (
                  <Link key={anime.id} href={getMediaHref(anime)}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: isLoaded ? 1 : 0, x: isLoaded ? 0 : -20 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                      className="glass-card p-4 flex gap-4 group cursor-pointer hover:border-accent/50 transition-all"
                    >
                      <div className="relative w-20 h-28 md:w-24 md:h-32 rounded-lg overflow-hidden flex-shrink-0">
                        <Image
                          src={anime?.coverImage?.extraLarge || anime?.coverImage?.large || "/placeholder.svg"}
                          alt={title}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <h3 className="font-semibold text-foreground text-lg group-hover:text-accent transition-colors line-clamp-1">
                            {title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {[studio, anime?.startDate?.year, episodeCount ? `${episodeCount} episodes` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(anime?.genres || []).slice(0, 4).map((genre) => (
                              <Badge key={genre} variant="outline" className="text-xs">
                                {genre}
                              </Badge>
                            ))}
                            <Badge variant="outline" className="text-xs">
                              {formatAniListStatus(anime?.status)}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 gap-3">
                          <div className="flex items-center gap-3">
                            {rating ? (
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-400" fill="currentColor" />
                                <span className="font-semibold text-foreground">{rating}</span>
                              </div>
                            ) : null}
                            {watchLink?.url ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  window.open(watchLink.url, "_blank", "noopener,noreferrer")
                                }}
                                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/35 hover:text-primary"
                              >
                                Watch on {watchLink.site}
                              </button>
                            ) : null}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Heart className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              className="bg-accent hover:bg-accent/90"
                              onClick={(event) => handleQuickAdd(anime, event)}
                            >
                              {quickState === "adding" ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : quickState === "added" ? (
                                <Check className="w-4 h-4 mr-1" />
                              ) : (
                                <Plus className="w-4 h-4 mr-1" />
                              )}
                              {quickState === "added" ? "Added" : quickState === "error" ? "Retry" : "Add to List"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                )
              })}
            </div>
          )}

          {hasMore ? (
            <div className="flex justify-center mt-12">
              <Button
                variant="outline"
                size="lg"
                className="px-8"
                disabled={loadingMore}
                onClick={() => fetchPage(page + 1, true)}
              >
                {loadingMore ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Load More
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}

