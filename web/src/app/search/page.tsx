"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  ChevronDown,
  LayoutGrid,
  List,
  Loader2,
  Play,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react"
import {
  fetchAniList,
  formatAniListStatus,
  getEpisodeCount,
  getMediaHref,
  getMediaTitle,
  getPreferredStreamingLink,
  getPrimaryStudio,
  
} from "@/lib/anilist"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Navigation } from "@/components/layout/Navigation"
import { AnimeCard } from "@/components/media/AnimeCard"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { logListActivity } from "@/lib/activity-service"

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "")
}

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
} as const

type SortKey = keyof typeof sortOptions

const sortLabels: Record<SortKey, string> = {
  popularity: "Most popular",
  rating: "Top rated",
  newest: "Newest",
  alphabetical: "A-Z",
}

const SEARCH_QUERY = `
query ($type: MediaType, $search: String, $page: Int, $perPage: Int, $genres: [String], $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { currentPage hasNextPage total }
    media(type: $type, search: $search, genre_in: $genres, sort: $sort, isAdult: false) {
      id
      type
      format
      title { romaji english native }
      coverImage { extraLarge large color }
      averageScore
      episodes
      chapters
      nextAiringEpisode { episode }
      status
      genres
      description
      startDate { year }
      studios(isMain: true) { nodes { name } }
      externalLinks { site url type }
      siteUrl
    }
  }
}
`

type MediaType = "ANIME" | "MANGA"

type AniListMedia = {
  id: number
  type?: string | null
  format?: string | null
  title?: {
    romaji?: string | null
    english?: string | null
    native?: string | null
  } | null
  coverImage?: {
    extraLarge?: string | null
    large?: string | null
    color?: string | null
  } | null
  averageScore?: number | null
  episodes?: number | null
  chapters?: number | null
  nextAiringEpisode?: {
    episode?: number | null
  } | null
  status?: string | null
  genres?: string[] | null
  description?: string | null
  startDate?: {
    year?: number | null
  } | null
  studios?: {
    nodes?: Array<{ name?: string | null }> | null
  } | null
  externalLinks?: Array<{
    site?: string | null
    url?: string | null
    type?: string | null
  }> | null
  siteUrl?: string | null
}

type QuickState = Record<number, "adding" | "added">

export default function BrowsePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeQuery, setActiveQuery] = useState("")
  const [mediaType, setMediaType] = useState<MediaType>("ANIME")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SortKey>("popularity")
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [results, setResults] = useState<AniListMedia[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [quickState, setQuickState] = useState<QuickState>({})

  const requestId = useRef(0)

  const fetchPage = async (nextPage: number, append = false) => {
    const id = ++requestId.current
    if (append) setLoadingMore(true)
    else {
      setLoading(true)
      setError("")
    }

    try {
      const data = await fetchAniList(SEARCH_QUERY, {
        type: mediaType,
        search: activeQuery || undefined,
        page: nextPage,
        perPage: 24,
        genres: selectedGenres.length ? selectedGenres : undefined,
        // With a text query, let AniList's relevance ranking lead (otherwise
        // "popularity" buries the exact title you typed under bigger shows).
        sort:
          activeQuery && sortBy === "popularity"
            ? ["SEARCH_MATCH", "POPULARITY_DESC"]
            : sortOptions[sortBy],
      })
      if (id !== requestId.current) return
      const pageData = (data as { Page?: any })?.Page
      const nextResults: AniListMedia[] = pageData?.media || []
      // Dedupe by id — AniList can repeat titles across pages, and duplicate
      // React keys make rows drop out ("content disappears" on Load more).
      setResults((current) => {
        if (!append) return nextResults
        const seen = new Set(current.map((m) => m.id))
        return [...current, ...nextResults.filter((m) => m?.id != null && !seen.has(m.id))]
      })
      setPage(pageData?.pageInfo?.currentPage || nextPage)
      setHasMore(Boolean(pageData?.pageInfo?.hasNextPage))
      setTotal(pageData?.pageInfo?.total || nextResults.length)
    } catch (loadError) {
      if (id !== requestId.current) return
      console.error("Failed to load browse results:", loadError)
      if (!append) {
        setResults([])
        setHasMore(false)
        setTotal(0)
        setError("Could not load anime right now. Try again in a moment.")
      }
    } finally {
      if (id !== requestId.current) return
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    fetchPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuery, selectedGenres, sortBy, mediaType])

  // Pick up a search term passed in the URL (e.g. from the header search box,
  // which routes here as /search?query=...). Without this, those searches just
  // land on the default browse view and appear to "do nothing".
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const incoming = (params.get("query") || params.get("q") || "").trim()
    if (incoming) {
      setSearchQuery(incoming)
      setActiveQuery(incoming)
    }
    if ((params.get("type") || "").toLowerCase() === "manga") {
      setMediaType("MANGA")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleGenre = (genre: string) => {
    setSelectedGenres((current) =>
      current.includes(genre) ? current.filter((value) => value !== genre) : [...current, genre],
    )
  }

  const handleSearchSubmit = () => setActiveQuery(searchQuery.trim())

  const clearAll = () => {
    setSelectedGenres([])
    setSearchQuery("")
    setActiveQuery("")
    setSortBy("popularity")
  }

  const handleQuickAdd = async (anime: AniListMedia) => {
    const mediaId = anime?.id
    if (!mediaId || quickState[mediaId] === "adding") return
    if (!user) {
      toast.info("Sign in to add anime to your list")
      router.push("/login?next=/search")
      return
    }

    setQuickState((current) => ({ ...current, [mediaId]: "adding" }))

    // Add to Plan to Watch/Read without clobbering an existing entry. Use the
    // media's own type (not the toggle) so a manga is never saved as an anime.
    const entryType = anime?.type === "MANGA" ? "MANGA" : "ANIME"
    const { error } = await client
      .from("list_entries")
      .upsert(
        { user_id: user.id, media_id: mediaId, media_type: entryType, status: "plan_to_watch", progress: 0 },
        { onConflict: "user_id,media_id", ignoreDuplicates: true },
      )

    if (error) {
      setQuickState((current) => {
        const next = { ...current }
        delete next[mediaId]
        return next
      })
      toast.error("Couldn't add to your list. Please try again.")
      return
    }

    toast.success(`Added "${getMediaTitle(anime)}" to Plan to ${entryType === "MANGA" ? "Read" : "Watch"}`)

    void logListActivity({
      user,
      media: anime,
      mediaId,
      mediaType: entryType,
      status: "plan_to_watch",
      progress: 0,
    })

    setQuickState((current) => ({ ...current, [mediaId]: "added" }))
    window.setTimeout(() => {
      setQuickState((current) => {
        const next = { ...current }
        delete next[mediaId]
        return next
      })
    }, 1600)
  }

  const resultsLabel = useMemo(() => {
    if (loading) return "Searching the catalog..."
    if (!results.length) return `No ${mediaType === "MANGA" ? "manga" : "anime"} found`
    // AniList caps pageInfo.total at 5000, so it isn't a reliable match count for
    // searches — only show "X of N" when N is a real (sub-cap) total.
    if (total && total < 5000) return `${results.length} of ${total.toLocaleString()} titles`
    return `${results.length}${hasMore ? "+" : ""} ${results.length === 1 ? "title" : "titles"}`
  }, [loading, results.length, total, hasMore, mediaType])

  const hasActiveFilters = selectedGenres.length > 0 || activeQuery.length > 0

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 pb-8 pt-24 md:px-6 md:pb-10 lg:pt-28">
        <header className="animate-rise">
          <p className="text-sm font-medium text-primary">Catalog</p>
          <h1 className="mt-1 text-balance text-3xl font-bold tracking-tight md:text-4xl">
            Browse {mediaType === "MANGA" ? "manga" : "anime"}
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
            {mediaType === "MANGA"
              ? "Search every series and one-shot, filter by genre, and line up your next read."
              : "Search across every studio and season, filter by genre, and line up your next watch."}
          </p>
        </header>

        <div className="mt-6 animate-rise">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="inline-flex self-start rounded-2xl border border-border bg-card p-1 shadow-sm sm:self-auto">
              {(["ANIME", "MANGA"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMediaType(type)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    mediaType === type
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {type === "ANIME" ? "Anime" : "Manga"}
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={
                  mediaType === "MANGA"
                    ? "Search manga, authors, one-shots..."
                    : "Search anime, studios, characters..."
                }
                value={searchQuery}
                onChange={(event) => {
                  const value = event.target.value
                  setSearchQuery(value)
                  // Emptying the field clears the active search filter/chip.
                  if (!value.trim() && activeQuery) setActiveQuery("")
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearchSubmit()
                }}
                className="w-full rounded-2xl border border-border bg-card py-3.5 pl-12 pr-10 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("")
                    setActiveQuery("")
                  }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleSearchSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Search className="size-4" />
              Search
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className="inline-flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm lg:hidden"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="size-4" />
              Filters
              {selectedGenres.length ? (
                <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                  {selectedGenres.length}
                </span>
              ) : null}
            </span>
            <ChevronDown className={`size-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
          </button>

          <aside className={`${filtersOpen ? "block" : "hidden"} lg:block`}>
            <div className="lg:sticky lg:top-24 space-y-6">
              <div className="card-elevated p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sort by</h2>
                <div className="mt-3 space-y-1">
                  {(Object.keys(sortLabels) as SortKey[]).map((key) => {
                    const active = sortBy === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSortBy(key)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          active ? "bg-accent font-medium text-primary" : "text-foreground hover:bg-secondary"
                        }`}
                      >
                        {sortLabels[key]}
                        {active ? <Check className="size-4" /> : null}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="card-elevated p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Genres</h2>
                  {selectedGenres.length ? (
                    <button
                      type="button"
                      onClick={() => setSelectedGenres([])}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {genres.map((genre) => {
                    const active = selectedGenres.includes(genre)
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => toggleGenre(genre)}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {genre}
                      </button>
                    )
                  })}
                </div>
              </div>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Clear all filters
                </button>
              ) : null}
            </div>
          </aside>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{resultsLabel}</p>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  className={`inline-flex size-9 items-center justify-center rounded-lg transition-colors ${
                    viewMode === "grid"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  className={`inline-flex size-9 items-center justify-center rounded-lg transition-colors ${
                    viewMode === "list"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="size-4" />
                </button>
              </div>
            </div>

            {hasActiveFilters ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {activeQuery ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-foreground">
                    &ldquo;{activeQuery}&rdquo;
                  </span>
                ) : null}
                {selectedGenres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    {genre}
                    <X className="size-3" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-5">
              {loading ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {Array.from({ length: 15 }).map((_, index) => (
                    <div key={index} className="card-elevated overflow-hidden">
                      <div className="aspect-[3/4] animate-pulse bg-secondary" />
                      <div className="space-y-2 p-3">
                        <div className="h-3.5 w-3/4 animate-pulse rounded bg-secondary" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !results.length ? (
                <div className="card-elevated flex flex-col items-center p-12 text-center">
                  <h2 className="text-xl font-semibold">Nothing matched that search</h2>
                  <p className="mt-2 text-muted-foreground">
                    Try a different title, remove a genre filter, or change the sort.
                  </p>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Reset browse
                  </button>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {results.map((anime, index) => (
                    <AnimeCard
                      key={anime.id}
                      anime={anime}
                      index={index}
                      quickState={quickState[anime.id] || "idle"}
                      onQuickAdd={handleQuickAdd}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {results.map((anime, index) => (
                    <ListRow
                      key={anime.id}
                      anime={anime}
                      index={index}
                      quickState={quickState[anime.id] || "idle"}
                      onQuickAdd={handleQuickAdd}
                    />
                  ))}
                </div>
              )}
            </div>

            {hasMore && !loading ? (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => fetchPage(page + 1, true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-8 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary disabled:opacity-60"
                >
                  {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  )
}

function ListRow({
  anime,
  index,
  quickState,
  onQuickAdd,
}: {
  anime: AniListMedia
  index: number
  quickState: "idle" | "adding" | "added"
  onQuickAdd: (anime: AniListMedia) => void
}) {
  const title = getMediaTitle(anime)
  const isManga = anime?.type === "MANGA"
  const rating = anime?.averageScore ? Number((anime.averageScore / 10).toFixed(1)) : null
  const unitCount = isManga ? anime?.chapters : getEpisodeCount(anime)
  const unitLabel = isManga ? "chapters" : "episodes"
  const studio = getPrimaryStudio(anime)
  const watchLink = getPreferredStreamingLink(anime)
  const description = stripHtml(anime?.description || "")

  return (
    <div
      className="card-elevated group flex animate-rise gap-4 p-3 transition-colors hover:border-primary/30"
      style={{ animationDelay: `${Math.min(index * 30, 360)}ms` }}
    >
      <a
        href={getMediaHref(anime)}
        className="relative h-32 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-secondary"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={anime?.coverImage?.extraLarge || anime?.coverImage?.large || "/placeholder.svg"}
          alt={title}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </a>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
        <div>
          <div className="flex items-start justify-between gap-3">
            <a href={getMediaHref(anime)} className="min-w-0">
              <h3 className="truncate text-lg font-semibold transition-colors group-hover:text-primary">{title}</h3>
            </a>
            {rating ? (
              <span className="inline-flex flex-shrink-0 items-center gap-1 text-sm font-semibold">
                <Star className="size-4 fill-chart-3 text-chart-3" />
                {rating}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[studio, anime?.startDate?.year, unitCount ? `${unitCount} ${unitLabel}` : null]
              .filter(Boolean)
              .join(" - ")}
          </p>
          {description ? (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground/90">{description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(anime?.genres || []).slice(0, 4).map((genre) => (
              <span key={genre} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {genre}
              </span>
            ))}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              {formatAniListStatus(anime?.status)}
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {watchLink?.url ? (
            <a
              href={watchLink.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground/85 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            >
              <Play className="size-3.5 shrink-0 fill-primary text-primary" />
              <span className="truncate">Watch on {watchLink.site}</span>
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => onQuickAdd(anime)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            {quickState === "adding" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : quickState === "added" ? (
              <Check className="size-3.5" />
            ) : null}
            {quickState === "added" ? "Added" : "Add to list"}
          </button>
        </div>
      </div>
    </div>
  )
}
