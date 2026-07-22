"use client";

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import useAuth from '@/hooks/useAuth'
import client from '@/lib/client'
import { Navigation } from '@/components/layout/Navigation'
import { AnimeCard } from '@/components/media/AnimeCard'
import { SectionHeader } from '@/components/media/SectionHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import {
  Star,
  Plus,
  Play,
  Calendar,
  Clock,
  Users,
  Heart,
  Share2,
  ChevronDown,
  Check,
  Pause,
  Bookmark,
  BookmarkPlus,
  Trash2,
  ExternalLink,
  History,
  Flag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { awardXp, XP_ACTIONS } from '@/lib/xp'
import { addNotification } from '@/lib/notifications-store'
import { reportContent } from '@/lib/reporting'
import { logListActivity } from '@/lib/activity-service'
import { AddToCollection } from '@/components/lists/AddToCollection'
import { StarRating } from '@/components/media/StarRating'
import { syncPublicFavorites } from '@/lib/public-profile'
import { toast } from 'sonner'
import { buildLoginPath } from '@/lib/safe-navigation.mjs'
import { FoundingName } from '@/components/founding/FoundingName'

const MEDIA_FIELDS = `
    id
    idMal
    type
    title { romaji english native }
    coverImage { extraLarge large }
    bannerImage
    trailer { id site thumbnail }
    description
    episodes
    chapters
    averageScore
    popularity
    favourites
    rankings { rank type allTime year season }
    genres
    tags { name }
    characters(perPage: 12, sort: [ROLE, RELEVANCE]) {
      edges {
        role
        node {
          id
          name { full native }
          image { large medium }
        }
        voiceActors(language: JAPANESE, sort: [RELEVANCE]) {
          id
          name { full }
          image { large medium }
        }
      }
    }
    studios { nodes { name } }
    externalLinks { site url type language }
    streamingEpisodes { title thumbnail url site }
    nextAiringEpisode { airingAt timeUntilAiring episode }
    startDate { year month day }
    endDate { year month day }
    duration
    format
    season
    seasonYear
    source
    status
    recommendations(sort: RATING_DESC, perPage: 8) {
      nodes {
        rating
        mediaRecommendation {
          id
          title { romaji english native }
          coverImage { large }
          episodes
          averageScore
        }
      }
    }
`

const MEDIA_BY_ID = `
query ($id: Int) {
  Media(id: $id) {
${MEDIA_FIELDS}
  }
}
`;

const MEDIA_BY_MAL_ID = `
query ($idMal: Int) {
  Media(idMal: $idMal) {
${MEDIA_FIELDS}
  }
}
`;

const MEDIA_SEARCH_QUERY = `
query ($search: String) {
  Page(perPage: 10) {
    media(search: $search, sort: POPULARITY_DESC, isAdult: false) {
${MEDIA_FIELDS}
    }
  }
}
`;

const getRouteValue = (rawId) => {
  const value = Array.isArray(rawId) ? rawId[0] : rawId
  return decodeURIComponent(String(value || "")).trim()
}

const uniqueNumbers = (values = []) =>
  Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  )

const normalizeTitle = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const buildMediaLookupHints = (rawId) => {
  const value = getRouteValue(rawId)
  const hasExplicitNumericPrefix = /^\d+(?:[-_]|$)/.test(value)
  const numberMatches = Array.from(value.matchAll(/\d+/g), (match) => Number(match[0])).filter(Number.isFinite)
  const bxMatch = value.match(/bx(\d+)/i)
  const trailingIdMatch = value.match(/(?:^|[-_])(\d{2,})(?:$|[-_])/)
  const numericCandidates = uniqueNumbers([
    bxMatch?.[1],
    /^\d+$/.test(value) ? value : null,
    numberMatches[numberMatches.length - 1],
    trailingIdMatch?.[1],
    ...numberMatches.slice().reverse(),
  ])

  const searchCandidate = value
    .replace(/^bx\d+[-_]?/i, "")
    .replace(/^\d+[-_]+/i, "")
    .replace(/[-_](?:id-)?\d+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return {
    raw: value,
    hasExplicitNumericPrefix,
    numericCandidates,
    searchCandidate: /^\d+$/.test(searchCandidate) ? "" : searchCandidate,
  }
}

const mediaMatchesSearch = (media, searchCandidate) => {
  const normalizedSearch = normalizeTitle(searchCandidate)
  if (!normalizedSearch) return true

  const titles = [media?.title?.english, media?.title?.romaji, media?.title?.native]
    .map((title) => normalizeTitle(title))
    .filter(Boolean)

  return titles.some(
    (title) =>
      title === normalizedSearch ||
      title.includes(normalizedSearch) ||
      normalizedSearch.includes(title),
  )
}

const scoreSearchMatch = (media, searchCandidate) => {
  const normalizedSearch = normalizeTitle(searchCandidate)
  if (!normalizedSearch) return 0

  const titles = [media?.title?.english, media?.title?.romaji, media?.title?.native]
    .map((title) => normalizeTitle(title))
    .filter(Boolean)

  let score = 0

  titles.forEach((title) => {
    if (title === normalizedSearch) score = Math.max(score, 120)
    else if (title.startsWith(normalizedSearch)) score = Math.max(score, 100)
    else if (title.includes(normalizedSearch)) score = Math.max(score, 80)
    else if (normalizedSearch.includes(title)) score = Math.max(score, 60)
  })

  if (media?.format === "TV") score += 12
  if (media?.format === "ONA") score += 6
  if (media?.format === "MOVIE") score -= 8
  if (media?.format === "SPECIAL") score -= 10

  return score
}

async function getMedia(rawId) {
  const { numericCandidates, searchCandidate } = buildMediaLookupHints(rawId)

  try {
    const request = async (query, variables) => {
      const res = await fetch("/api/anilist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.errors) return null;
      return json;
    }

    if (numericCandidates.length) {
      for (const candidate of numericCandidates) {
        const direct = await request(MEDIA_BY_ID, { id: candidate })
        const directMatch = direct?.data?.Media
        if (directMatch && (!searchCandidate || mediaMatchesSearch(directMatch, searchCandidate))) {
          return directMatch
        }
      }
    }

    if (numericCandidates.length) {
      for (const candidate of numericCandidates) {
        const malDirect = await request(MEDIA_BY_MAL_ID, { idMal: candidate })
        const malMatch = malDirect?.data?.Media
        if (malMatch && (!searchCandidate || mediaMatchesSearch(malMatch, searchCandidate))) {
          return malMatch
        }
      }
    }

    if (searchCandidate) {
      const search = await request(MEDIA_SEARCH_QUERY, { search: searchCandidate })
      const searchMatches = (search?.data?.Page?.media || []).filter(Boolean)
      const matchedSearch =
        searchMatches
          .map((item) => ({ item, score: scoreSearchMatch(item, searchCandidate) }))
          .sort((left, right) => right.score - left.score)[0]?.item || searchMatches[0]

      if (matchedSearch) {
        return matchedSearch
      }
    }

    return null
  } catch {
    return null;
  }
}

function formatTimeUntil(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "soon"
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (!days && minutes) parts.push(`${minutes}m`)
  return parts.join(" ") || "soon"
}

function getTrailerUrl(trailer) {
  if (!trailer?.id || !trailer?.site) return null
  const site = trailer.site.toLowerCase()
  if (site === "youtube") return `https://www.youtube.com/watch?v=${trailer.id}`
  if (site === "dailymotion") return `https://www.dailymotion.com/video/${trailer.id}`
  return null
}

function getTrailerEmbedUrl(trailer) {
  if (!trailer?.id || !trailer?.site) return null
  const site = trailer.site.toLowerCase()
  if (site === "youtube") return `https://www.youtube.com/embed/${trailer.id}`
  if (site === "dailymotion") return `https://www.dailymotion.com/embed/video/${trailer.id}`
  return null
}

function getTrailerThumbnail(trailer) {
  if (!trailer?.id) return "/placeholder.svg"
  if (trailer.thumbnail) return trailer.thumbnail
  const site = trailer?.site?.toLowerCase()
  if (site === "youtube") return `https://img.youtube.com/vi/${trailer.id}/hqdefault.jpg`
  if (site === "dailymotion") return `https://www.dailymotion.com/thumbnail/video/${trailer.id}`
  return "/placeholder.svg"
}

function formatEnumLabel(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim()
}

function getMangaDexId(externalLinks = []) {
  const link = externalLinks.find(
    (item) =>
      item?.site?.toLowerCase().includes("mangadex") ||
      item?.url?.toLowerCase().includes("mangadex.org/title/"),
  )
  if (!link?.url) return null
  const match = link.url.match(/mangadex\.org\/title\/([a-f0-9-]+)/i)
  return match?.[1] || null
}

const toSecureExternalUrl = (value) => String(value || "").replace(/^http:\/\//i, "https://")

function MediaPageSkeleton() {
  return (
    <main className="pb-20 pt-16 md:pb-8 md:pt-0">
      <div className="relative h-64 overflow-hidden md:h-80">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-card to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="px-4 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="relative -mt-32 flex flex-col gap-6 md:flex-row md:items-end">
            <div className="mx-auto w-48 flex-shrink-0 md:mx-0 md:w-56">
              <div className="aspect-[3/4] rounded-2xl border border-white/10 bg-card/70 shadow-2xl animate-pulse" />
            </div>

            <div className="flex-1 pb-4">
              <div className="mb-3 flex flex-wrap gap-2">
                <div className="h-7 w-24 rounded-full bg-card/70 animate-pulse" />
                <div className="h-7 w-28 rounded-full bg-card/50 animate-pulse" />
              </div>
              <div className="mb-3 h-12 w-full max-w-xl rounded-2xl bg-card/80 animate-pulse" />
              <div className="mb-6 h-6 w-56 rounded-xl bg-card/50 animate-pulse" />
              <div className="mb-6 flex flex-wrap gap-4">
                <div className="h-5 w-28 rounded-lg bg-card/50 animate-pulse" />
                <div className="h-5 w-36 rounded-lg bg-card/50 animate-pulse" />
                <div className="h-5 w-32 rounded-lg bg-card/50 animate-pulse" />
              </div>
              <div className="space-y-3">
                <div className="h-4 w-full max-w-3xl rounded-lg bg-card/60 animate-pulse" />
                <div className="h-4 w-full max-w-2xl rounded-lg bg-card/50 animate-pulse" />
                <div className="h-4 w-4/5 max-w-xl rounded-lg bg-card/40 animate-pulse" />
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
            <div className="rounded-3xl border border-border/50 bg-card/50 p-6 backdrop-blur-xl">
              <div className="mb-5 flex gap-3">
                <div className="h-10 w-36 rounded-xl bg-card/70 animate-pulse" />
                <div className="h-10 w-28 rounded-xl bg-card/50 animate-pulse" />
              </div>
              <div className="space-y-3">
                <div className="h-4 w-full rounded-lg bg-card/60 animate-pulse" />
                <div className="h-4 w-full rounded-lg bg-card/50 animate-pulse" />
                <div className="h-4 w-5/6 rounded-lg bg-card/40 animate-pulse" />
                <div className="h-4 w-3/4 rounded-lg bg-card/40 animate-pulse" />
              </div>
            </div>

            <div className="rounded-3xl border border-border/50 bg-card/40 p-6 backdrop-blur-xl">
              <div className="mb-4 h-6 w-32 rounded-lg bg-card/70 animate-pulse" />
              <div className="space-y-3">
                <div className="h-12 rounded-2xl bg-card/60 animate-pulse" />
                <div className="h-12 rounded-2xl bg-card/50 animate-pulse" />
                <div className="h-12 rounded-2xl bg-card/40 animate-pulse" />
                <div className="h-32 rounded-2xl bg-card/30 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function MediaNotFoundState() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 pt-16 md:pt-0">
      <div className="w-full max-w-xl rounded-3xl border border-border/50 bg-card/60 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
        <Badge className="mb-4 bg-primary/15 text-primary">Unavailable</Badge>
        <h1 className="mb-3 text-3xl font-black text-foreground">This title could not be loaded</h1>
        <p className="mb-6 text-muted-foreground">
          The page opened, but AniList did not return media data for this entry.
        </p>
        <Button asChild className="bg-gradient-to-r from-primary to-accent text-white hover:opacity-90">
          <Link href="/search">Browse other anime</Link>
        </Button>
      </div>
    </main>
  )
}

export default function MediaPage() {
  const { id: rawId } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const routeValue = getRouteValue(rawId)
  const [media, setMedia] = useState(null)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const mediaId = Number.isFinite(Number(media?.id)) ? Number(media.id) : null
  
  // Add to list state
  const [status, setStatus] = useState(null)
  const [progress, setProgress] = useState(0)
  const [entryScore, setEntryScore] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [trailerPlaying, setTrailerPlaying] = useState(null)
  const [favoriteIds, setFavoriteIds] = useState([])
  const [favoriteSaving, setFavoriteSaving] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [hasEntry, setHasEntry] = useState(false)
  const [existingProgress, setExistingProgress] = useState(0)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewHover, setReviewHover] = useState(0)
  const [reviewText, setReviewText] = useState("")
  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewsError, setReviewsError] = useState(null)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewExists, setReviewExists] = useState(false)
  const [reportingReviewId, setReportingReviewId] = useState(null)
  const [mangaDexChapterCount, setMangaDexChapterCount] = useState(null)
  const [mangaDexLoading, setMangaDexLoading] = useState(false)
  const resumedAction = useRef("")

  const requestLoginForAction = (action) => {
    const params = new URLSearchParams(searchParams?.toString() || "")
    params.set("action", action)
    const nextPath = `/media/${encodeURIComponent(routeValue)}?${params.toString()}`
    toast.info(action === "favorite" ? "Sign in to save this favorite" : "Sign in to add this title to your list")
    router.push(buildLoginPath(nextPath))
  }

  const loadReviews = async () => {
    if (!Number.isFinite(mediaId)) return
    setReviewsLoading(true)
    setReviewsError(null)

    let reviewsResult = await client
      .from("reviews")
      .select("id, user_id, media_id, rating, review_text, user_display_name, user_handle, user_avatar_url, created_at")
      .eq("media_id", mediaId)
      .eq("is_removed", false)
      .order("created_at", { ascending: false })

    if (reviewsResult.error && ["42703", "PGRST204"].includes(String(reviewsResult.error.code || ""))) {
      reviewsResult = await client
        .from("reviews")
        .select("id, user_id, media_id, rating, review_text, user_display_name, user_avatar_url, created_at")
        .eq("media_id", mediaId)
        .eq("is_removed", false)
        .order("created_at", { ascending: false })
    }
    const { data, error: reviewsFetchError } = reviewsResult

    if (reviewsFetchError) {
      console.warn("Failed to load reviews:", reviewsFetchError)
      setReviews([])
      setReviewsError("Could not load reviews yet.")
      setReviewsLoading(false)
      return
    }

    setReviews(data || [])
    setReviewsLoading(false)

    if (user) {
      const existing = (data || []).find((item) => item.user_id === user.id)
      if (existing) {
        setReviewRating(existing.rating || 0)
        setReviewText(existing.review_text || "")
        setReviewExists(true)
      } else {
        setReviewExists(false)
      }
    }
  }

  // Load media and existing list entry
  useEffect(() => {
    let active = true

    setMedia(null)
    setLoading(true)
    getMedia(routeValue).then((data) => {
      if (!active) return
      setMedia(data)
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [routeValue])

  // Load existing list entry if user is logged in
  useEffect(() => {
    if (!user || !Number.isFinite(mediaId) || !media) return

    const loadExistingEntry = async () => {
      try {
        setHasEntry(false)
        setExistingProgress(0)
        setStatus(null)
        setProgress(0)
        setEntryScore(0)
        const { data, error } = await client
          .from('list_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('media_id', mediaId)
          .single()

        if (!error && data) {
          setStatus(data.status)
          setProgress(data.progress || 0)
          setEntryScore(Number(data.score) || 0)
          setHasEntry(true)
          setExistingProgress(data.progress || 0)
        }
      } catch {
        // Entry doesn't exist yet, that's fine
      }
    }

    loadExistingEntry()
  }, [user, mediaId, media])

  useEffect(() => {
    if (!user) {
      setFavoriteIds([])
      return
    }
    const ids = Array.isArray(user?.user_metadata?.favorite_media_ids)
      ? user.user_metadata.favorite_media_ids
      : []
    const normalized = ids.map((value) => Number(value)).filter(Number.isFinite)
    setFavoriteIds(Array.from(new Set(normalized)))
  }, [user])

  const handleToggleFavorite = async (options = {}) => {
    if (!user) {
      requestLoginForAction("favorite")
      return
    }
    if (!Number.isFinite(mediaId)) return
    const metadataFavorites = Array.isArray(user?.user_metadata?.favorite_media_ids)
      ? user.user_metadata.favorite_media_ids.map((value) => Number(value)).filter(Number.isFinite)
      : []
    const currentFavorites = options?.forceAdd === true ? Array.from(new Set(metadataFavorites)) : favoriteIds
    const previous = currentFavorites
    const isFavorite = currentFavorites.includes(mediaId)
    if (options?.forceAdd === true && isFavorite) {
      toast.success("Already in your favorites")
      return
    }
    const next = isFavorite ? currentFavorites.filter((value) => value !== mediaId) : [...currentFavorites, mediaId]
    const normalizedNext = Array.from(new Set(next.map((value) => Number(value)).filter(Number.isFinite)))
    setFavoriteSaving(true)
    setFavoriteIds(normalizedNext)
    const { error: updateError } = await client.auth.updateUser({
      data: { favorite_media_ids: normalizedNext },
    })
    if (updateError) {
      console.error("Failed to update favorites:", updateError)
      setFavoriteIds(previous)
      toast.error("Couldn't update favorites. Please try again.")
    } else {
      // Keep the shareable public profile in sync so favorites show on /u/[handle].
      syncPublicFavorites({ ...user, user_metadata: { ...user.user_metadata, favorite_media_ids: normalizedNext } })
      addNotification(user.id, {
        title: isFavorite ? "Removed from favorites" : "Added to favorites",
        message: `${media?.title?.english || media?.title?.romaji || "This title"} ${isFavorite ? "was removed from" : "was added to"} your favorites.`,
        type: "favorite",
      })
      toast.success(isFavorite ? "Removed from favorites" : "Added to favorites")
    }
    setFavoriteSaving(false)
  }

  useEffect(() => {
    const action = searchParams?.get("action") || ""
    if (!user || !media || !Number.isFinite(mediaId) || !action || resumedAction.current === action) return

    resumedAction.current = action
    const cleanParams = new URLSearchParams(searchParams.toString())
    cleanParams.delete("action")
    router.replace(
      `/media/${encodeURIComponent(routeValue)}${cleanParams.toString() ? `?${cleanParams.toString()}` : ""}`,
      { scroll: false },
    )

    if (action === "favorite") {
      void handleToggleFavorite({ forceAdd: true })
    } else if (action === "list") {
      setStatus((current) => current || "plan_to_watch")
      setPopoverOpen(true)
      toast.info("Choose a status, then save this title to your list")
    }
    // The ref makes this a one-time continuation after authentication.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media, mediaId, routeValue, router, searchParams, user])

  const handleShare = async () => {
    if (typeof window === "undefined") return
    const url = Number.isFinite(mediaId)
      ? new URL(`/media/${mediaId}`, window.location.origin).toString()
      : window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 1500)
    } catch (error) {
      window.prompt("Copy this link:", url)
    }
  }

  useEffect(() => {
    if (!Number.isFinite(mediaId)) return
    loadReviews()
  }, [mediaId, user])

  useEffect(() => {
    if (!media || media.type !== "MANGA") {
      setMangaDexChapterCount(null)
      setMangaDexLoading(false)
      return
    }
    if (media.chapters) {
      setMangaDexChapterCount(media.chapters)
      setMangaDexLoading(false)
      return
    }

    let active = true
    const mangadexId = getMangaDexId(media.externalLinks || [])
    const title =
      media.title?.english || media.title?.romaji || media.title?.native || ""

    const loadMangaDex = async () => {
      setMangaDexLoading(true)
      try {
        const res = await fetch("/api/mangadex", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, mangadexId }),
        })
        const data = await res.json()
        if (!res.ok || data?.error) {
          setMangaDexLoading(false)
          return
        }
        const parsed =
          typeof data.chapterCount === "number"
            ? data.chapterCount
            : Number.parseFloat(data.chapterCountDisplay || data.chapterCount)
        if (active && Number.isFinite(parsed)) {
          setMangaDexChapterCount(parsed)
        }
      } catch (error) {
        console.warn("Failed to load MangaDex chapters:", error)
      } finally {
        if (active) {
          setMangaDexLoading(false)
        }
      }
    }

    loadMangaDex()

    return () => {
      active = false
    }
  }, [media])

  const handleSubmitReview = async () => {
    if (!user) {
      setReviewsError("Please log in to leave a review.")
      return
    }
    if (!Number.isFinite(mediaId)) {
      setReviewsError("This title is still loading. Try again in a moment.")
      return
    }
    if (!reviewRating) {
      setReviewsError("Select a rating before submitting.")
      return
    }
    if (!reviewText.trim()) {
      setReviewsError("Write a short review before submitting.")
      return
    }

    setSubmittingReview(true)
    setReviewsError(null)

    const displayName =
      user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || "User"
    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || null
    const userHandle = user?.user_metadata?.username || user?.user_metadata?.handle || null

    const reviewPayload = {
      user_id: user.id,
      media_id: mediaId,
      rating: reviewRating,
      review_text: reviewText.trim(),
      user_display_name: displayName,
      user_handle: userHandle,
      user_avatar_url: avatarUrl,
    }
    let reviewResult = await client
      .from("reviews")
      .upsert(reviewPayload, { onConflict: "user_id,media_id" })
    if (reviewResult.error && ["42703", "PGRST204"].includes(String(reviewResult.error.code || ""))) {
      const { user_handle, ...legacyPayload } = reviewPayload
      reviewResult = await client.from("reviews").upsert(legacyPayload, { onConflict: "user_id,media_id" })
    }
    const { error: reviewError } = reviewResult

    if (reviewError) {
      console.error("Failed to save review:", reviewError)
      setReviewsError(reviewError.message || "Failed to save review.")
      toast.error(reviewError.message || "Couldn't save your review.")
      setSubmittingReview(false)
      return
    }

    const wasEditing = reviewExists
    await loadReviews()
    if (!reviewExists) {
      awardXp(user, XP_ACTIONS.review_create, "review_create")
      setReviewExists(true)
    }
    addNotification(user.id, {
      title: "Review posted",
      message: `Your review for ${media?.title?.english || media?.title?.romaji || "this title"} is live.`,
      type: "review",
    })
    toast.success(wasEditing ? "Review updated" : "Review posted")
    setSubmittingReview(false)
  }

  const handleReportReview = async (review) => {
    if (!user || !review?.id) return
    setReportingReviewId(review.id)
    try {
      await reportContent({
        reporterId: user.id,
        targetType: "review",
        targetId: review.id,
        targetLabel: review.review_text?.slice(0, 140),
        targetUrl: Number.isFinite(mediaId) ? `/media/${mediaId}` : "/search",
        targetUserId: review.user_id,
        targetUserDisplayName: review.user_display_name,
        targetUserAvatarUrl: review.user_avatar_url,
      })
      addNotification(user.id, {
        title: "Review reported",
        message: "Thanks for letting us know. We'll review it.",
        type: "report",
      })
    } catch (error) {
      addNotification(user.id, {
        title: "Report failed",
        message: error.message || "Could not report this review.",
        type: "report",
      })
    } finally {
      setReportingReviewId(null)
    }
  }

  const handleSaveToList = async () => {
    if (!user) {
      setError('Please log in to add to your list')
      return
    }
    if (!Number.isFinite(mediaId)) {
      setError('This title is still loading. Try again in a moment.')
      return
    }
    if (!status) {
      setError('Choose a status before saving.')
      return
    }

    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const { error: upsertError } = await client
        .from('list_entries')
        .upsert({
          user_id: user.id,
          media_id: mediaId,
          media_type: media.type,
          status: status,
          progress: progress,
          score: entryScore > 0 ? entryScore : null,
        }, {
          onConflict: 'user_id,media_id'
        })

      if (upsertError) {
        throw upsertError
      }

      setSaved(true)
      setPopoverOpen(false)
      const statusLabels = {
        watching: "Watching",
        completed: "Completed",
        plan_to_watch: "Plan to Watch",
        on_hold: "On Hold",
        dropped: "Dropped",
        rewatching: "Rewatching",
      }
      toast.success(`Saved to ${statusLabels[status] || "your list"}`)
      if (!hasEntry) {
        awardXp(user, XP_ACTIONS.list_add, "list_add")
        setHasEntry(true)
        addNotification(user.id, {
          title: "Added to your list",
          message: `${media?.title?.english || media?.title?.romaji || "This title"} is now in your list.`,
          type: "list",
        })
      } else if (progress > existingProgress) {
        const delta = progress - existingProgress
        const points = Math.min(delta * XP_ACTIONS.progress_update, XP_ACTIONS.progress_update * 5)
        awardXp(user, points, "progress_update")
        addNotification(user.id, {
          title: "Progress updated",
          message: `${media?.title?.english || media?.title?.romaji || "This title"} is now at ${progress}.`,
          type: "list",
        })
      }
      void logListActivity({
        user,
        media,
        mediaId,
        mediaType: media.type,
        status,
        progress,
      })
      setExistingProgress(progress)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Error saving to list:', err)
      setError(err.message || 'Failed to save to list')
    } finally {
      setSaving(false)
    }
  }

  // Inline rating: persists the score immediately. If the title isn't on the
  // user's list yet, rating adds it (default status "completed").
  const handleRate = async (nextScore) => {
    if (!user) {
      toast.error('Sign in to rate this title.')
      return
    }
    if (!Number.isFinite(mediaId) || !media) return

    const previousScore = entryScore
    setEntryScore(nextScore)
    const nextStatus = status || 'completed'

    const { error: rateError } = await client
      .from('list_entries')
      .upsert(
        {
          user_id: user.id,
          media_id: mediaId,
          media_type: media.type,
          status: nextStatus,
          progress: progress,
          score: nextScore > 0 ? nextScore : null,
        },
        { onConflict: 'user_id,media_id' },
      )

    if (rateError) {
      console.error('Error saving rating:', rateError)
      setEntryScore(previousScore)
      toast.error("Couldn't save your rating. Please try again.")
      return
    }

    if (!status) setStatus(nextStatus)
    if (!hasEntry) setHasEntry(true)
    toast.success(nextScore > 0 ? `Rated ${nextScore}/10` : 'Rating cleared')
  }

  if (loading) return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <MediaPageSkeleton />
    </div>
  )
  if (!media) return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <MediaNotFoundState />
    </div>
  )

  const title = media.title.english || media.title.romaji || media.title.native || "Untitled"
  const originalTitle =
    media.title.romaji && media.title.romaji !== title
      ? media.title.romaji
      : media.title.native && media.title.native !== title
        ? media.title.native
        : null
  const isOngoing = media.status === "RELEASING"
  const nextAiringEpisode = media.nextAiringEpisode?.episode
  const currentEpisodeCount =
    media.type === "ANIME"
      ? (media.episodes ?? (nextAiringEpisode ? Math.max(nextAiringEpisode - 1, 0) : null))
      : null
  const currentChapterCount =
    media.type === "MANGA" ? (media.chapters ?? mangaDexChapterCount ?? null) : null
  const countValue = media.type === "ANIME" ? currentEpisodeCount : currentChapterCount
  const countLabel =
    countValue !== null && countValue !== undefined
      ? countValue.toString()
      : isOngoing
        ? "Ongoing"
        : "Unknown"
  const type = media.type === "ANIME" ? `${countLabel} Episodes` : `${countLabel} Chapters`
  const studio = media.studios?.nodes?.[0]?.name || 'Unknown'
  const startDate = media.startDate?.year
    ? new Date(media.startDate.year, (media.startDate.month || 1) - 1, media.startDate.day || 1).toLocaleDateString(
        "en-US",
        { month: "short", year: "numeric" },
      )
    : null
  const endDate = media.endDate?.year
    ? new Date(media.endDate.year, (media.endDate.month || 1) - 1, media.endDate.day || 1).toLocaleDateString(
        "en-US",
        { month: "short", year: "numeric" },
      )
    : null
  const aired = startDate ? (endDate ? `${startDate} - ${endDate}` : startDate) : "Unknown"
  const duration = media.duration ? `${media.duration} min` : 'Unknown'
  const mediaStatus = formatEnumLabel(media.status) || 'Unknown'
  const rating = media.averageScore ? (media.averageScore / 10).toFixed(1) : null
  const themes = media.tags?.slice(0, 3).map(t => t.name) || []
  const synopsis = stripHtml(media.description) || "No synopsis available yet."
  const seasonLabel =
    media.season && media.seasonYear
      ? `${formatEnumLabel(media.season)} ${media.seasonYear}`
      : media.season
        ? formatEnumLabel(media.season)
        : media.seasonYear
          ? String(media.seasonYear)
          : aired
  const sourceLabel = formatEnumLabel(media.source) || "Unknown"
  const posterImage = media.coverImage?.extraLarge || media.coverImage?.large || "/placeholder.svg"
  const bannerImage = media.bannerImage || posterImage
  const popularityRank =
    media.rankings?.find((rank) => rank.type === "POPULAR" && rank.allTime) ||
    media.rankings?.find((rank) => rank.type === "POPULAR") ||
    null
  const quickFacts = [
    { label: "Studio", value: studio, icon: Users },
    { label: "Season", value: seasonLabel, icon: Calendar },
    { label: "Source", value: sourceLabel, icon: Bookmark },
    { label: "Duration", value: duration, icon: Clock },
  ]
  const myAnimeListLink = media.idMal ? `https://myanimelist.net/${media.type === "MANGA" ? "manga" : "anime"}/${media.idMal}` : null

  const isManga = media.type === "MANGA"
  const listOptions = [
    { value: "watching", label: isManga ? "Currently Reading" : "Currently Watching", icon: Play, color: "text-blue-400" },
    { value: "completed", label: "Completed", icon: Check, color: "text-green-400" },
    { value: "on_hold", label: "On Hold", icon: Pause, color: "text-yellow-400" },
    { value: "dropped", label: "Dropped", icon: Trash2, color: "text-red-400" },
    { value: "plan_to_watch", label: isManga ? "Plan to Read" : "Plan to Watch", icon: BookmarkPlus, color: "text-purple-400" },
    { value: "rewatching", label: isManga ? "Rereading" : "Rewatching", icon: History, color: "text-amber-400" },
  ]

  const currentListOption = listOptions.find((option) => option.value === status)

  const trailerUrl = getTrailerUrl(media.trailer)
  const trailerEmbedUrl = getTrailerEmbedUrl(media.trailer)
  const trailers = trailerUrl
    ? [
        {
          id: media.trailer?.id || "trailer",
          title: media.trailer?.site ? `${media.trailer.site} Trailer` : "Official Trailer",
          url: trailerUrl,
          thumbnail: getTrailerThumbnail(media.trailer),
          embedUrl: trailerEmbedUrl,
        },
      ]
    : []

  const parseEpisodeNumber = (title) => {
    const labelled = String(title || "").match(/episode\s*(\d+)/i)
    if (labelled) return Number(labelled[1])
    const firstNumber = String(title || "").match(/\d+/)
    return firstNumber ? Number(firstNumber[0]) : Number.POSITIVE_INFINITY
  }

  const streamingEpisodes = (media.streamingEpisodes || [])
    .filter((episode) => episode?.title && episode?.url)
    .slice()
    .sort((a, b) => parseEpisodeNumber(a.title) - parseEpisodeNumber(b.title))
    .map((episode, index) => ({
      id: `${episode.site || "stream"}-${index}`,
      title: episode.title,
      url: toSecureExternalUrl(episode.url),
      site: episode.site || "Stream",
      thumbnail: episode.thumbnail || null,
    }))

  const watchProviders = (() => {
    const providerMap = new Map()
    const addProvider = (site, url) => {
      if (!site || !url) return
      const key = site.toLowerCase().trim()
      if (!providerMap.has(key)) {
        providerMap.set(key, { id: key, label: site, url: toSecureExternalUrl(url) })
      }
    }

    ;(media.externalLinks || [])
      .filter((link) => link?.type === "STREAMING")
      .forEach((link) => addProvider(link?.site, link?.url))

    ;(media.streamingEpisodes || [])
      .filter((episode) => episode?.site && episode?.url)
      .forEach((episode) => addProvider(episode.site, episode.url))

    return Array.from(providerMap.values())
  })()

  const providerColors = {
    crunchyroll: "bg-orange-500",
    netflix: "bg-red-600",
    hulu: "bg-green-500",
    "prime video": "bg-blue-500",
    "amazon prime": "bg-blue-500",
    "amazon prime video": "bg-blue-500",
    "disney+": "bg-blue-400",
    "hidive": "bg-indigo-500",
    bilibili: "bg-blue-400",
    youtube: "bg-red-500",
    funimation: "bg-purple-500",
    "apple tv": "bg-gray-400",
    max: "bg-indigo-600",
    "hbo max": "bg-indigo-600",
  }

  const getProviderColor = (label) => {
    if (!label) return "bg-muted-foreground/40"
    return providerColors[label.toLowerCase()] || "bg-muted-foreground/40"
  }
  const providerSectionLabel = media.type === "MANGA" ? "Where to read" : "Where to watch"

  const nextAiring = media.nextAiringEpisode
  const nextAiringLabel = nextAiring
    ? `Ep ${nextAiring.episode} in ${formatTimeUntil(nextAiring.timeUntilAiring)}`
    : null

  const formattedReviews = reviews.map((review) => ({
    id: review.id,
    userId: review.user_id,
    userDisplayName: review.user_display_name,
    userHandle: review.user_handle || null,
    user: review.user_display_name || "User",
    avatar: review.user_avatar_url,
    rating: review.rating,
    text: review.review_text,
    date: review.created_at ? new Date(review.created_at).toLocaleDateString() : "",
  }))

  const similar = (media.recommendations?.nodes || [])
    .map((node) => node?.mediaRecommendation)
    .filter(Boolean)
    .map((rec) => ({
      id: rec.id,
      title: rec.title?.english || rec.title?.romaji || rec.title?.native || "Untitled",
      image: rec.coverImage?.large || "/placeholder.svg",
      episodes: rec.episodes ?? 0,
      rating: rec.averageScore ? rec.averageScore / 10 : null,
    }))

  const favoriteActive = Number.isFinite(mediaId) && favoriteIds.includes(mediaId)
  const characterEntries = (media.characters?.edges || [])
    .filter((edge) => edge?.node)
    .map((edge, index) => {
      const characterName = edge.node?.name?.full || edge.node?.name?.native || "Unknown character"
      const nativeName =
        edge.node?.name?.native && edge.node.name.native !== characterName ? edge.node.name.native : null
      const voiceActor = edge.voiceActors?.[0]
      return {
        id: edge.node?.id || `${characterName}-${index}`,
        name: characterName,
        nativeName,
        image: edge.node?.image?.large || edge.node?.image?.medium || "/placeholder.svg",
        role: formatEnumLabel(edge.role) || "Character",
        voiceActorName: voiceActor?.name?.full || null,
        voiceActorImage: voiceActor?.image?.large || voiceActor?.image?.medium || null,
      }
    })
    .slice(0, 12)
  const primaryReferenceLinks = [
    { label: "AniList", url: `https://anilist.co/${media.type?.toLowerCase() || "anime"}/${media.id}` },
    ...(media.externalLinks || [])
      .filter((link) => link?.url && ["myanimelist", "official site"].includes(String(link.site || "").toLowerCase()))
      .slice(0, 2)
      .map((link) => ({ label: link.site, url: link.url })),
  ]

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="pb-20 pt-16 md:pb-8 md:pt-0">
        <div className="relative h-[50vh] overflow-hidden">
          <img
            src={bannerImage}
            alt={title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
        </div>

        <div
          className="relative z-10 mx-auto -mt-64 max-w-7xl animate-fade-in px-4"
          style={{ animationDuration: "220ms" }}
        >
          <div>
            <div className="flex flex-col gap-8 lg:flex-row">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.34, ease: "easeOut" }}
                className="flex-shrink-0"
              >
                <div className="relative">
                  <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-primary/40 via-accent/40 to-primary/40 blur-xl opacity-60" />
                  <div className="relative w-56 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
                    <img
                      src={posterImage}
                      alt={title}
                      className="aspect-[3/4] w-full object-cover"
                    />
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {user ? (
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          className="h-12 w-full bg-gradient-to-r from-primary to-accent text-white font-semibold shadow-lg shadow-primary/25 hover:opacity-90"
                        >
                          {currentListOption ? (
                            <>
                              <currentListOption.icon className={cn("mr-2 h-4 w-4", currentListOption.color)} />
                              {currentListOption.label}
                            </>
                          ) : (
                            <>
                              <Plus className="mr-2 h-5 w-5" />
                              Add to List
                            </>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="bottom"
                        align="start"
                        sideOffset={8}
                        avoidCollisions={false}
                        className="max-h-[70vh] w-80 overflow-y-auto p-0"
                      >
                        <div className="overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl">
                          <div className="border-b border-border/50 p-4">
                            <h4 className="font-medium">Add to List</h4>
                            <p className="text-xs text-muted-foreground">Choose a status and update progress</p>
                          </div>
                          <div className="space-y-1.5 p-3">
                            {listOptions.map((option) => {
                              const isActive = status === option.value
                              return (
                                <button
                                  key={option.value}
                                  onClick={() => setStatus(option.value)}
                                  className={cn(
                                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-200",
                                    isActive
                                      ? "bg-primary/10 text-foreground"
                                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                                  )}
                                >
                                  <option.icon className={cn("h-4 w-4", option.color)} />
                                  <span>{option.label}</span>
                                  {isActive ? <Check className="ml-auto h-4 w-4 text-primary" /> : null}
                                </button>
                              )
                            })}
                          </div>
                          <div className="space-y-3 px-4 pb-4">
                            <div className="space-y-2">
                              <Label htmlFor="progress">Progress</Label>
                              <Input
                                id="progress"
                                type="number"
                                value={progress}
                                onChange={(e) => setProgress(Number(e.target.value) || 0)}
                                disabled={saving}
                                min="0"
                                placeholder="0"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="score">Your Score</Label>
                              <Input
                                id="score"
                                type="number"
                                value={entryScore || ""}
                                onChange={(e) => {
                                  const nextValue = Number(e.target.value)
                                  if (!Number.isFinite(nextValue)) {
                                    setEntryScore(0)
                                    return
                                  }
                                  setEntryScore(Math.max(0, Math.min(10, Math.round(nextValue))))
                                }}
                                disabled={saving}
                                min="0"
                                max="10"
                                step="1"
                                placeholder="Optional"
                              />
                              <p className="text-xs text-muted-foreground">
                                Save a personal rating from 1 to 10. Leave it blank if you have not rated this yet.
                              </p>
                            </div>
                            <Button onClick={handleSaveToList} disabled={saving} className="w-full">
                              {saving ? 'Saving...' : 'Save'}
                            </Button>
                            {saved ? <div className="text-center text-sm text-green-600">Saved</div> : null}
                            {error ? <div className="text-center text-sm text-red-600">{error}</div> : null}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Button
                      className="h-12 w-full bg-gradient-to-r from-primary to-accent text-white font-semibold shadow-lg shadow-primary/25"
                      onClick={() => requestLoginForAction("list")}
                    >
                      <Plus className="mr-2 h-5 w-5" />
                      Add to List
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className={cn(
                      "h-12 w-full",
                      favoriteActive && "border-red-500/50 bg-red-500/10 text-red-400",
                    )}
                    onClick={handleToggleFavorite}
                    disabled={favoriteSaving}
                  >
                    <Heart className={cn("mr-2 h-5 w-5", favoriteActive && "fill-current")} />
                    {favoriteActive ? "Favorited" : "Add to Favorites"}
                  </Button>

                  <AddToCollection user={user} mediaId={mediaId} mediaType={media?.type} />

                </div>

                {user ? (
                  <div className="mt-4 rounded-2xl border border-border/60 bg-secondary/30 p-4">
                    <p className="mb-2 text-sm font-medium text-foreground">Your rating</p>
                    <StarRating value={entryScore} onChange={handleRate} />
                  </div>
                ) : null}

                <div className="mt-6 space-y-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Popularity</span>
                    <span className="font-medium text-foreground">
                      {popularityRank?.rank ? `#${popularityRank.rank.toLocaleString()}` : media.popularity ? `#${media.popularity.toLocaleString()}` : "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Favorites</span>
                    <span className="font-medium text-foreground">
                      {media.favourites ? media.favourites.toLocaleString() : "Unknown"}
                    </span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.34, delay: 0.08, ease: "easeOut" }}
                className="flex-1 space-y-6"
              >
                <div>
                  <h1 className="mb-2 text-4xl font-black text-foreground md:text-5xl">
                    {title}
                  </h1>
                  {originalTitle ? (
                    <p className="text-lg text-muted-foreground">{originalTitle}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  {rating ? (
                    <Badge className="rounded-full border border-amber-400/30 bg-amber-500/20 px-3 py-1.5 text-amber-200">
                      <Star className="mr-1.5 h-4 w-4 fill-current" />
                      {rating} / 10
                    </Badge>
                  ) : null}
                  <Badge
                    className={cn(
                      "rounded-full px-3 py-1.5",
                      isOngoing
                        ? "border border-emerald-400/30 bg-emerald-500/20 text-emerald-200"
                        : "border border-cyan-400/25 bg-cyan-500/15 text-cyan-100",
                    )}
                  >
                    {mediaStatus}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-white/10 bg-[#08121d]/70 px-3 py-1.5 text-white/80">
                    <Play className="mr-1.5 h-4 w-4" />
                    {type}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-white/10 bg-[#08121d]/70 px-3 py-1.5 text-white/80">
                    <Clock className="mr-1.5 h-4 w-4" />
                    {duration}
                  </Badge>
                  {nextAiringLabel ? (
                    <Badge variant="outline" className="rounded-full border-white/10 bg-[#08121d]/70 px-3 py-1.5 text-white/80">
                      <Calendar className="mr-1.5 h-4 w-4" />
                      Next {nextAiringLabel}
                    </Badge>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {(media.genres || []).map((genre) => (
                    <Badge
                      key={genre}
                      variant="outline"
                      className="rounded-full border-white/10 bg-[#08121d]/65 px-4 py-2 text-sm text-white/85"
                    >
                      {genre}
                    </Badge>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {quickFacts.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[22px] border border-white/10 bg-[#08121d]/75 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl"
                    >
                      <div className="mb-2 flex items-center gap-2 text-white/45">
                        <item.icon className="h-4 w-4" />
                        <span className="text-xs uppercase tracking-[0.18em]">{item.label}</span>
                      </div>
                      <p className="text-lg font-semibold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>

                {watchProviders.length > 0 ? (
                  <div
                    className="animate-fade-in rounded-[24px] border border-white/10 bg-[#08121d]/72 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl"
                    style={{ animationDuration: "260ms", animationDelay: "40ms" }}
                  >
                    <div className="mb-3 flex items-center gap-2 text-white/45">
                      {media.type === "MANGA" ? (
                        <Bookmark className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      <span className="text-xs uppercase tracking-[0.18em]">{providerSectionLabel}</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {watchProviders.map((provider) => (
                        <a
                          key={provider.id}
                          href={provider.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0c1724]/90 px-4 py-2.5 text-sm font-medium text-white/78 transition-all duration-200 hover:border-primary/35 hover:bg-white/[0.06] hover:text-white"
                        >
                          <span className={cn("h-2.5 w-2.5 rounded-full", getProviderColor(provider.label))} />
                          <span>{provider.label}</span>
                          <ExternalLink className="h-3.5 w-3.5 text-white/38 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/70" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </motion.div>
            </div>

            <Tabs defaultValue="overview" className="mt-8">
              <TabsList className="h-auto rounded-2xl border border-white/10 bg-[#08121d]/75 p-1.5 backdrop-blur-xl">
                <TabsTrigger
                  value="overview"
                  className="rounded-xl px-4 py-2 text-sm font-medium text-white/60 transition-all data-[state=active]:bg-white/10 data-[state=active]:text-white"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="episodes"
                  className="rounded-xl px-4 py-2 text-sm font-medium text-white/60 transition-all data-[state=active]:bg-white/10 data-[state=active]:text-white"
                >
                  {media.type === "ANIME" ? "Episodes" : "Chapters"}
                </TabsTrigger>
                <TabsTrigger
                  value="characters"
                  className="rounded-xl px-4 py-2 text-sm font-medium text-white/60 transition-all data-[state=active]:bg-white/10 data-[state=active]:text-white"
                >
                  Characters
                </TabsTrigger>
                <TabsTrigger
                  value="reviews"
                  className="rounded-xl px-4 py-2 text-sm font-medium text-white/60 transition-all data-[state=active]:bg-white/10 data-[state=active]:text-white"
                >
                  Reviews
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <div className="grid gap-8 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-6">
                    <Card className="rounded-[28px] border-white/10 bg-[#08121d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                      <CardHeader>
                        <CardTitle className="text-white">Synopsis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="selectable whitespace-pre-line leading-8 text-white/68">{synopsis}</p>
                      </CardContent>
                    </Card>

                    <Card className="rounded-[28px] border-white/10 bg-[#08121d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                      <CardHeader>
                        <CardTitle className="text-white">Trailers & Videos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {trailers.length > 0 ? (
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {trailers.map((trailer) => (
                              <button
                                key={trailer.id}
                                onClick={() => trailer.embedUrl && setTrailerPlaying(trailer.embedUrl)}
                                className="group text-left"
                                disabled={!trailer.embedUrl}
                              >
                                <div className="relative aspect-video overflow-hidden rounded-lg">
                                  <img
                                    src={trailer.thumbnail || "/placeholder.svg"}
                                    alt={trailer.title}
                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                    <Play className="h-12 w-12 text-white" />
                                  </div>
                                </div>
                                <p className="mt-2 text-sm font-medium text-white">{trailer.title}</p>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-white/55">No trailers found.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card className="rounded-[28px] border-white/10 bg-[#08121d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                      <CardHeader>
                        <CardTitle className="text-white">Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-xs text-white/45">Studio</p>
                          <p className="text-sm font-medium text-white">{studio}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/45">Status</p>
                          <p className="text-sm font-medium text-white">{mediaStatus}</p>
                        </div>
                        {nextAiringLabel && (
                          <div>
                            <p className="text-xs text-white/45">Next Airing</p>
                            <p className="text-sm font-medium text-white">{nextAiringLabel}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-white/45">Aired</p>
                          <p className="text-sm font-medium text-white">{aired}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/45">{media.type === 'ANIME' ? 'Episodes' : 'Chapters'}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white">{countLabel}</p>
                            {isOngoing && countValue !== null && countValue !== undefined && (
                              <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">Ongoing</Badge>
                            )}
                          </div>
                        </div>
                        {media.duration && (
                          <div>
                            <p className="text-xs text-white/45">Duration</p>
                            <p className="text-sm font-medium text-white">{duration}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="rounded-[28px] border-white/10 bg-[#08121d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                      <CardHeader>
                        <CardTitle className="text-white">Genres</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-2">
                        {media.genres && media.genres.length > 0 ? (
                          media.genres.map((genre) => (
                            <Badge key={genre} variant="secondary" className="border border-white/10 bg-white/[0.05] text-white/75">
                              {genre}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-white/55">No genres listed</p>
                        )}
                      </CardContent>
                    </Card>

                    {themes.length > 0 && (
                      <Card className="rounded-[28px] border-white/10 bg-[#08121d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                        <CardHeader>
                          <CardTitle className="text-white">Themes</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                          {themes.map((theme) => (
                            <Badge key={theme} variant="outline" className="border-white/10 bg-white/[0.03] text-white/75">
                              {theme}
                            </Badge>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="episodes" className="mt-6">
                <Card className="rounded-[28px] border-white/10 bg-[#08121d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                  <CardContent className="divide-y divide-white/10 p-0">
                    {streamingEpisodes.length > 0 ? (
                      streamingEpisodes.map((episode) => (
                        <div
                          key={episode.id}
                          className="flex items-center gap-4 p-4 transition-colors hover:bg-white/[0.04]"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-sm font-bold text-white">
                            <Play className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="truncate font-medium text-white">{episode.title}</h4>
                            <p className="text-sm text-white/50">{episode.site}</p>
                          </div>
                          <a
                            href={episode.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition-colors hover:bg-white/[0.08]"
                          >
                            Watch
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-white/55">
                        {media.type === "ANIME"
                          ? "Episode list is not available. Use the streaming links above."
                          : "Episode list is only available for anime."}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews" className="mt-6">
                <div className="space-y-6">
                  {user ? (
                    <Card className="rounded-[28px] border-white/10 bg-[#08121d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                      <CardHeader>
                        <CardTitle className="text-white">Write a Review</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white/55">Your Rating:</span>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 10 }, (_, i) => (
                              <button
                                key={i}
                                type="button"
                                onMouseEnter={() => setReviewHover(i + 1)}
                                onMouseLeave={() => setReviewHover(0)}
                                onClick={() => setReviewRating(i + 1)}
                                className="p-0.5"
                                aria-label={`Rate ${i + 1}`}
                              >
                                <Star
                                  className={cn(
                                    "h-5 w-5 transition-colors",
                                    (reviewHover || reviewRating) > i
                                      ? "fill-cyan-300 text-cyan-300"
                                      : "text-white/25",
                                  )}
                                />
                              </button>
                            ))}
                          </div>
                          {(reviewHover || reviewRating) > 0 && (
                            <span className="text-sm text-white/55">{reviewHover || reviewRating}/10</span>
                          )}
                        </div>
                        <Textarea
                          placeholder="Share your thoughts about this anime..."
                          className="min-h-24 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          disabled={submittingReview}
                        />
                        {reviewsError && <p className="text-sm text-rose-300">{reviewsError}</p>}
                        <div className="flex items-center justify-end">
                          <Button onClick={handleSubmitReview} disabled={submittingReview} className="rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 text-white">
                            {submittingReview ? "Saving..." : "Submit Review"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="rounded-[28px] border-white/10 bg-[#08121d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                      <CardContent className="py-8 text-center text-white/55">
                        Log in to leave a review.
                      </CardContent>
                    </Card>
                  )}

                  {reviewsLoading ? (
                    <Card className="rounded-[28px] border-white/10 bg-[#08121d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                      <CardContent className="py-8 text-center text-white/55">
                        Loading reviews...
                      </CardContent>
                    </Card>
                  ) : formattedReviews.length === 0 ? (
                    <Card className="rounded-[28px] border-white/10 bg-[#08121d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                      <CardContent className="py-8 text-center text-white/55">
                        No reviews yet. Be the first to review.
                      </CardContent>
                    </Card>
                  ) : (
                    formattedReviews.map((review) => (
                      <Card key={review.id} className="rounded-[28px] border-white/10 bg-[#08121d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <img
                              src={review.avatar || "/placeholder.svg"}
                              alt={review.user}
                              className="h-10 w-10 rounded-full"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <FoundingName handle={review.userHandle} className="text-white">{review.user}</FoundingName>
                                  <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 fill-cyan-300 text-cyan-300" />
                                    <span className="text-sm text-white">{review.rating}</span>
                                  </div>
                                  {review.date && <span className="text-xs text-white/40">{review.date}</span>}
                                </div>
                                {user && review.userId !== user.id && (
                                  <button
                                    onClick={() => handleReportReview(review)}
                                    disabled={reportingReviewId === review.id}
                                    className="flex items-center gap-1 text-xs text-white/45 hover:text-white"
                                  >
                                    <Flag className="h-3.5 w-3.5" />
                                    Report
                                  </button>
                                )}
                              </div>
                              <p className="mt-2 text-sm leading-7 text-white/62">{review.text}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="characters" className="mt-6">
                {characterEntries.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {characterEntries.map((character) => (
                      <Card
                        key={character.id}
                        className="overflow-hidden rounded-[28px] border-white/10 bg-[#08121d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl"
                      >
                        <CardContent className="p-0">
                          <div className="flex items-stretch">
                            <div className="relative w-24 shrink-0 overflow-hidden bg-white/[0.04] sm:w-28">
                              <img
                                src={character.image}
                                alt={character.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
                              <div>
                                <div className="mb-2 flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="border-white/10 bg-white/[0.03] text-white/70"
                                  >
                                    {character.role}
                                  </Badge>
                                </div>
                                <h3 className="line-clamp-2 text-lg font-semibold text-white">
                                  {character.name}
                                </h3>
                                {character.nativeName ? (
                                  <p className="mt-1 line-clamp-1 text-sm text-white/45">{character.nativeName}</p>
                                ) : null}
                              </div>

                              {character.voiceActorName ? (
                                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                                  {character.voiceActorImage ? (
                                    <img
                                      src={character.voiceActorImage}
                                      alt={character.voiceActorName}
                                      className="h-9 w-9 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-9 w-9 rounded-full bg-white/[0.08]" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">Voice Actor</p>
                                    <p className="truncate text-sm text-white/75">{character.voiceActorName}</p>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="rounded-[28px] border-white/10 bg-[#08121d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                    <CardContent className="py-10 text-center text-white/55">
                      No character details are available for this title yet.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            {primaryReferenceLinks.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {primaryReferenceLinks.map((link) => (
                  <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-xl border-white/10 bg-[#08121d]/70 text-white hover:bg-white/5"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {link.label}
                    </Button>
                  </a>
                ))}
              </div>
            ) : null}

            <div className="mt-8">
              <SectionHeader title={media.type === "ANIME" ? "Similar Anime" : "Related Titles"} />
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {similar.length > 0 ? (
                  similar.map((anime) => <AnimeCard key={anime.id} {...anime} />)
                ) : (
                  <Card className="col-span-full rounded-[28px] border-white/10 bg-[#08121d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                    <CardContent className="py-8 text-center text-white/55">
                      No related recommendations yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {trailerPlaying && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setTrailerPlaying(null)}
        >
          <div
            className="relative w-full max-w-4xl mx-4 aspect-video bg-card rounded-2xl overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={trailerPlaying}
              title="Trailer"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close trailer"
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70"
              onClick={() => setTrailerPlaying(null)}
            >
              <span className="text-2xl text-white">&times;</span>
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
