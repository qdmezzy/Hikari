"use client";

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import useAuth from '@/hooks/useAuth'
import client from '@/lib/client'
import { Navigation } from '@/components/Navigation'
import { AnimeCard } from '@/components/AnimeCard'
import { SectionHeader } from '@/components/SectionHeader'
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
  Eye,
  Check,
  Pause,
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

const MEDIA_BY_ID = `
query ($id: Int) {
  Media(id: $id) {
    id
    type
    title { romaji english native }
    coverImage { extraLarge large }
    bannerImage
    trailer { id site thumbnail }
    description
    episodes
    chapters
    averageScore
    rankings { rank type allTime year season }
    genres
    tags { name }
    studios { nodes { name } }
    externalLinks { site url type language }
    streamingEpisodes { title thumbnail url site }
    nextAiringEpisode { airingAt timeUntilAiring episode }
    startDate { year month day }
    endDate { year month day }
    duration
    format
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
  }
}
`;

async function getMedia(id) {
  try {
    const res = await fetch("/api/anilist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: MEDIA_BY_ID, variables: { id } }),
    });

    const json = await res.json();

    if (!res.ok) return null;
    if (json?.errors) return null;

    return json?.data?.Media ?? null;
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

export default function MediaPage() {
  const { id: rawId } = useParams()
  const id = Number(rawId)
  const [media, setMedia] = useState(null)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  
  // Add to list state
  const [status, setStatus] = useState(null)
  const [progress, setProgress] = useState(0)
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

  const loadReviews = async () => {
    if (!Number.isFinite(id)) return
    setReviewsLoading(true)
    setReviewsError(null)

    const { data, error: reviewsFetchError } = await client
      .from("reviews")
      .select("id, user_id, media_id, rating, review_text, user_display_name, user_avatar_url, created_at")
      .eq("media_id", id)
      .eq("is_removed", false)
      .order("created_at", { ascending: false })

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
    if (!Number.isFinite(id)) return
    
    getMedia(id).then(data => {
      setMedia(data)
      setLoading(false)
    })
  }, [id])

  // Load existing list entry if user is logged in
  useEffect(() => {
    if (!user || !id || !media) return

    const loadExistingEntry = async () => {
      try {
        setHasEntry(false)
        setExistingProgress(0)
        setStatus(null)
        setProgress(0)
        const { data, error } = await client
          .from('list_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('media_id', id)
          .single()

        if (!error && data) {
          setStatus(data.status)
          setProgress(data.progress || 0)
          setHasEntry(true)
          setExistingProgress(data.progress || 0)
        }
      } catch (err) {
        // Entry doesn't exist yet, that's fine
        console.log('No existing entry found')
      }
    }

    loadExistingEntry()
  }, [user, id, media])

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

  const handleToggleFavorite = async () => {
    if (!user || !Number.isFinite(id)) return
    const previous = favoriteIds
    const isFavorite = favoriteIds.includes(id)
    const next = isFavorite ? favoriteIds.filter((value) => value !== id) : [...favoriteIds, id]
    const normalizedNext = Array.from(new Set(next.map((value) => Number(value)).filter(Number.isFinite)))
    setFavoriteSaving(true)
    setFavoriteIds(normalizedNext)
    const { error: updateError } = await client.auth.updateUser({
      data: { favorite_media_ids: normalizedNext },
    })
    if (updateError) {
      console.error("Failed to update favorites:", updateError)
      setFavoriteIds(previous)
    } else {
      addNotification(user.id, {
        title: isFavorite ? "Removed from favorites" : "Added to favorites",
        message: `${media?.title?.english || media?.title?.romaji || "This title"} ${isFavorite ? "was removed from" : "was added to"} your favorites.`,
        type: "favorite",
      })
    }
    setFavoriteSaving(false)
  }

  const handleShare = async () => {
    if (typeof window === "undefined") return
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 1500)
    } catch (error) {
      window.prompt("Copy this link:", url)
    }
  }

  useEffect(() => {
    if (!id) return
    loadReviews()
  }, [id, user])

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

    const { error: reviewError } = await client
      .from("reviews")
      .upsert(
        {
          user_id: user.id,
          media_id: id,
          rating: reviewRating,
          review_text: reviewText.trim(),
          user_display_name: displayName,
          user_avatar_url: avatarUrl,
        },
        { onConflict: "user_id,media_id" },
      )

    if (reviewError) {
      console.error("Failed to save review:", reviewError)
      setReviewsError(reviewError.message || "Failed to save review.")
      setSubmittingReview(false)
      return
    }

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
        targetUrl: `/media/${id}`,
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
          media_id: id,
          media_type: media.type,
          status: status,
          progress: progress,
        }, {
          onConflict: 'user_id,media_id'
        })

      if (upsertError) {
        throw upsertError
      }

      setSaved(true)
      setPopoverOpen(false)
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
      setExistingProgress(progress)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Error saving to list:', err)
      setError(err.message || 'Failed to save to list')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex items-center justify-center min-h-screen">Loading...</div>
    </div>
  )
  if (!media) return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex items-center justify-center min-h-screen">Not found</div>
    </div>
  )

  const title = media.title.english || media.title.romaji;
  const originalTitle = media.title.romaji || media.title.native;
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
  const type = media.type === "ANIME" ? `${countLabel} Episodes` : `${countLabel} Chapters`;
  const studio = media.studios?.nodes?.[0]?.name || 'Unknown';
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
  const duration = media.duration ? `${media.duration} min per ep` : 'Unknown';
  const mediaStatus = media.status || 'Unknown';
  const rating = media.averageScore ? (media.averageScore / 10).toFixed(1) : null;
  const themes = media.tags?.slice(0, 3).map(t => t.name) || [];

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

  const streamingEpisodes = (media.streamingEpisodes || [])
    .filter((episode) => episode?.title && episode?.url)
    .map((episode, index) => ({
      id: `${episode.site || "stream"}-${index}`,
      title: episode.title,
      url: episode.url,
      site: episode.site || "Stream",
      thumbnail: episode.thumbnail || null,
    }))

  const watchProviders = (() => {
    const providerMap = new Map()
    const addProvider = (site, url) => {
      if (!site || !url) return
      const key = site.toLowerCase().trim()
      if (!providerMap.has(key)) {
        providerMap.set(key, { id: key, label: site, url })
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

  const nextAiring = media.nextAiringEpisode
  const nextAiringLabel = nextAiring
    ? `Ep ${nextAiring.episode} in ${formatTimeUntil(nextAiring.timeUntilAiring)}`
    : null

  const formattedReviews = reviews.map((review) => ({
    id: review.id,
    userId: review.user_id,
    userDisplayName: review.user_display_name,
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="pb-20 pt-16 md:pb-8 md:pt-0">
        {/* Banner */}
        <div className="relative h-64 md:h-80">
          <img
            src={media.bannerImage || media.coverImage.extraLarge || "/placeholder.svg"}
            alt={title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        </div>

        <div className="px-4 md:px-8">
          <div className="mx-auto max-w-6xl">
            {/* Main Info */}
            <div className="relative -mt-32 flex flex-col gap-6 md:flex-row md:items-end">
              {/* Poster */}
              <div className="mx-auto w-48 flex-shrink-0 md:mx-0 md:w-56">
                <img
                  src={media.coverImage.extraLarge || "/placeholder.svg"}
                  alt={title}
                  className="w-full rounded-lg shadow-2xl"
                />
              </div>

              {/* Info */}
              <div className="flex-1 pb-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground">{mediaStatus}</Badge>
                  {rating && (
                    (() => {
                      const popularRank =
                        media.rankings?.find((rank) => rank.type === "POPULAR" && rank.allTime) ||
                        media.rankings?.find((rank) => rank.type === "POPULAR")
                      return popularRank ? (
                        <Badge variant="outline">#{popularRank.rank} Popular</Badge>
                      ) : null
                    })()
                  )}
                </div>
                <h1 className="mb-1 text-2xl font-bold text-foreground md:text-4xl">{title}</h1>
                {originalTitle && originalTitle !== title && (
                  <p className="mb-4 text-muted-foreground">{originalTitle}</p>
                )}

                <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
                  {rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-5 w-5 fill-primary text-primary" />
                      <span className="font-bold text-foreground">{rating}</span>
                      <span className="text-muted-foreground">/10</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {aired}
                  </div>
                  {media.duration && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {duration}
                    </div>
                  )}
                  {nextAiringLabel && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Next {nextAiringLabel}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {type}
                    {isOngoing && countValue !== null && countValue !== undefined && (
                      <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">Ongoing</Badge>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  {user ? (
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          className={cn(
                            "gap-2 rounded-xl min-w-[180px] transition-all duration-300",
                            currentListOption ? "bg-secondary hover:bg-secondary/80" : "bg-primary hover:bg-primary/90",
                          )}
                        >
                          {currentListOption ? (
                            <>
                              <currentListOption.icon className={cn("h-4 w-4", currentListOption.color)} />
                              {currentListOption.label}
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4" />
                              Add to List
                            </>
                          )}
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 ml-auto transition-transform duration-300",
                              popoverOpen && "rotate-180",
                            )}
                          />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0">
                        <div className="bg-card/95 backdrop-blur-xl rounded-xl border border-border/50 shadow-2xl overflow-hidden">
                          <div className="p-4 border-b border-border/50">
                            <h4 className="font-medium">Add to List</h4>
                            <p className="text-xs text-muted-foreground">Choose a status and update progress</p>
                          </div>
                          <div className="p-3 space-y-1.5">
                            {listOptions.map((option) => {
                              const isActive = status === option.value
                              return (
                                <button
                                  key={option.value}
                                  onClick={() => setStatus(option.value)}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                                    isActive
                                      ? "bg-primary/10 text-foreground"
                                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                                  )}
                                >
                                  <option.icon className={cn("h-4 w-4", option.color)} />
                                  <span>{option.label}</span>
                                  {isActive && <Check className="h-4 w-4 ml-auto text-primary" />}
                                </button>
                              )
                            })}
                          </div>
                          <div className="px-4 pb-4 space-y-3">
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
                            <Button onClick={handleSaveToList} disabled={saving} className="w-full">
                              {saving ? 'Saving...' : 'Save'}
                            </Button>
                            {saved && <div className="text-sm text-green-600 text-center">Saved</div>}
                            {error && <div className="text-sm text-red-600 text-center">{error}</div>}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Button className="gap-2 rounded-xl" disabled>
                      <Plus className="h-4 w-4" />
                      Add to List
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className="gap-2"
                    disabled={!trailerEmbedUrl}
                    onClick={() => trailerEmbedUrl && setTrailerPlaying(trailerEmbedUrl)}
                  >
                    <Play className="h-4 w-4" />
                    Watch Trailer
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleToggleFavorite}
                    disabled={!user || favoriteSaving}
                    className={cn(
                      favoriteIds.includes(id) && "text-pink-500 border-pink-500/40",
                    )}
                  >
                    <Heart className={cn("h-4 w-4", favoriteIds.includes(id) && "fill-current")} />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleShare}>
                    {shareCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Where to Watch Section */}
            <div className="mt-8">
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Play className="h-5 w-5 text-primary" />
                    Where to Watch
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {watchProviders.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {watchProviders.map((link) => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 bg-secondary/50 border-border/50 hover:bg-secondary hover:border-primary/50 hover:scale-105"
                        >
                          <span className={cn("h-3 w-3 rounded-full", getProviderColor(link.label))} />
                          <span className="text-sm font-medium">{link.label}</span>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No links found.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tabs Content */}
            <Tabs defaultValue="overview" className="mt-8">
              <TabsList className="rounded-full border border-white/10 bg-black/40 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <TabsTrigger
                  value="overview"
                  className="flex-none rounded-full px-4 py-2 text-xs sm:text-sm font-semibold tracking-tight text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:text-foreground hover:bg-white/5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-white/15 data-[state=active]:to-white/5 data-[state=active]:text-foreground data-[state=active]:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.4)]"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="episodes"
                  className="flex-none rounded-full px-4 py-2 text-xs sm:text-sm font-semibold tracking-tight text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:text-foreground hover:bg-white/5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-white/15 data-[state=active]:to-white/5 data-[state=active]:text-foreground data-[state=active]:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.4)]"
                >
                  Episodes
                </TabsTrigger>
                <TabsTrigger
                  value="reviews"
                  className="flex-none rounded-full px-4 py-2 text-xs sm:text-sm font-semibold tracking-tight text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:text-foreground hover:bg-white/5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-white/15 data-[state=active]:to-white/5 data-[state=active]:text-foreground data-[state=active]:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.4)]"
                >
                  Reviews
                </TabsTrigger>
                <TabsTrigger
                  value="related"
                  className="flex-none rounded-full px-4 py-2 text-xs sm:text-sm font-semibold tracking-tight text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:text-foreground hover:bg-white/5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-white/15 data-[state=active]:to-white/5 data-[state=active]:text-foreground data-[state=active]:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.4)]"
                >
                  Related
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <div className="grid gap-8 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-6">
                    {/* Description */}
                    <Card className="bg-card">
                      <CardHeader>
                        <CardTitle>Synopsis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: media.description || 'No description available.' }} />
                      </CardContent>
                    </Card>

                    {/* Trailers */}
                    <Card className="bg-card">
                      <CardHeader>
                        <CardTitle>Trailers & Videos</CardTitle>
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
                                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 transition-opacity group-hover:opacity-100">
                                    <Play className="h-12 w-12 text-foreground" />
                                  </div>
                                </div>
                                <p className="mt-2 text-sm font-medium text-foreground">{trailer.title}</p>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No trailers found.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Sidebar Info */}
                  <div className="space-y-6">
                    <Card className="bg-card">
                      <CardHeader>
                        <CardTitle>Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Studio</p>
                          <p className="text-sm font-medium text-foreground">{studio}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <p className="text-sm font-medium text-foreground">{mediaStatus}</p>
                        </div>
                        {nextAiringLabel && (
                          <div>
                            <p className="text-xs text-muted-foreground">Next Airing</p>
                            <p className="text-sm font-medium text-foreground">{nextAiringLabel}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground">Aired</p>
                          <p className="text-sm font-medium text-foreground">{aired}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{media.type === 'ANIME' ? 'Episodes' : 'Chapters'}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{countLabel}</p>
                            {isOngoing && countValue !== null && countValue !== undefined && (
                              <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">Ongoing</Badge>
                            )}
                          </div>
                        </div>
                        {media.duration && (
                          <div>
                            <p className="text-xs text-muted-foreground">Duration</p>
                            <p className="text-sm font-medium text-foreground">{duration}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-card">
                      <CardHeader>
                        <CardTitle>Genres</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-2">
                        {media.genres && media.genres.length > 0 ? (
                          media.genres.map((genre) => (
                            <Badge key={genre} variant="secondary">
                              {genre}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No genres listed</p>
                        )}
                      </CardContent>
                    </Card>

                    {themes.length > 0 && (
                      <Card className="bg-card">
                        <CardHeader>
                          <CardTitle>Themes</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                          {themes.map((theme) => (
                            <Badge key={theme} variant="outline">
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
                <Card className="bg-card">
                  <CardContent className="divide-y divide-border p-0">
                    {streamingEpisodes.length > 0 ? (
                      streamingEpisodes.map((episode) => (
                        <div
                          key={episode.id}
                          className="flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-sm font-bold text-foreground">
                            <Play className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground truncate">{episode.title}</h4>
                            <p className="text-sm text-muted-foreground">{episode.site}</p>
                          </div>
                          <a
                            href={episode.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                          >
                            Watch
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-muted-foreground">
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
                  {/* Write Review */}
                  {user ? (
                    <Card className="bg-card">
                      <CardHeader>
                        <CardTitle>Write a Review</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Your Rating:</span>
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
                                      ? "fill-primary text-primary"
                                      : "text-muted-foreground",
                                  )}
                                />
                              </button>
                            ))}
                          </div>
                          {(reviewHover || reviewRating) > 0 && (
                            <span className="text-sm text-muted-foreground">{reviewHover || reviewRating}/10</span>
                          )}
                        </div>
                        <Textarea
                          placeholder="Share your thoughts about this anime..."
                          className="min-h-24"
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          disabled={submittingReview}
                        />
                        {reviewsError && <p className="text-sm text-destructive">{reviewsError}</p>}
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <input type="checkbox" className="rounded" disabled />
                            Contains spoilers (soon)
                          </label>
                          <Button onClick={handleSubmitReview} disabled={submittingReview}>
                            {submittingReview ? "Saving..." : "Submit Review"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="bg-card">
                      <CardContent className="py-8 text-center text-muted-foreground">
                        Log in to leave a review.
                      </CardContent>
                    </Card>
                  )}

                  {/* Reviews List */}
                  {reviewsLoading ? (
                    <Card className="bg-card">
                      <CardContent className="py-8 text-center text-muted-foreground">
                        Loading reviews...
                      </CardContent>
                    </Card>
                  ) : formattedReviews.length === 0 ? (
                    <Card className="bg-card">
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No reviews yet. Be the first to review.
                      </CardContent>
                    </Card>
                  ) : (
                    formattedReviews.map((review) => (
                      <Card key={review.id} className="bg-card">
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
                                  <span className="font-medium text-foreground">{review.user}</span>
                                  <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 fill-primary text-primary" />
                                    <span className="text-sm text-foreground">{review.rating}</span>
                                  </div>
                                  {review.date && <span className="text-xs text-muted-foreground">{review.date}</span>}
                                </div>
                                {user && review.userId !== user.id && (
                                  <button
                                    onClick={() => handleReportReview(review)}
                                    disabled={reportingReviewId === review.id}
                                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                  >
                                    <Flag className="h-3.5 w-3.5" />
                                    Report
                                  </button>
                                )}
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">{review.text}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="related" className="mt-6">
                <SectionHeader title="Similar Anime" />
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {similar.length > 0 ? (
                    similar.map((anime) => <AnimeCard key={anime.id} {...anime} />)
                  ) : (
                    <Card className="col-span-full bg-card">
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No related recommendations yet.
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
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
