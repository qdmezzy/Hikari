"use client"

import { useEffect, useMemo, useState } from "react"
import { useMotionPreference } from "@/hooks/useMotionPreference"
import { useRouter } from "next/navigation"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { toast } from "sonner"
import { getFeaturedRotationDelay } from "@/lib/featured-rotation.mjs"
import { fetchAniList, fetchAniListMediaByIds, formatAniListStatus, formatRelativeTime, getEpisodeCount, getMediaTitle, getPrimaryStudio, sanitizeDescription, getPreferredStreamingLink } from "@/lib/anilist"

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
      format
      duration
      nextAiringEpisode { episode airingAt }
      description(asHtml: false)
      genres
      popularity
      status
      studios(isMain: true) { nodes { name } }
      externalLinks { site url type }
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
      format
      duration
      nextAiringEpisode { episode airingAt }
      status
      description(asHtml: false)
      genres
      studios(isMain: true) { nodes { name } }
      externalLinks { site url type }
    }
  }
}
`

const HERO_TITLE_MAX_LENGTH = 56

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
  nativeTitle: media?.title?.native || "",
  heroTitle: getHeroTitle(media),
  cover: media?.coverImage?.extraLarge || media?.coverImage?.large || "/placeholder.svg",
  banner: media?.bannerImage || media?.coverImage?.extraLarge || media?.coverImage?.large || "/placeholder.svg",
  rating: media?.averageScore ? Number((media.averageScore / 10).toFixed(1)) : undefined,
  episodes: getEpisodeCount(media) || undefined,
  format: media?.format,
  duration: media?.duration,
  description: sanitizeDescription(media?.description),
  heroDescription: getHeroDescription(media?.description),
  genres: Array.isArray(media?.genres) ? media.genres : [],
  studio: getPrimaryStudio(media),
  popularity: Number(media?.popularity || 0),
  status: formatAniListStatus(media?.status),
  watchUrl: getPreferredStreamingLink(media)?.url || "",
  watchLabel: getPreferredStreamingLink(media)?.site ? `Watch on ${getPreferredStreamingLink(media).site}` : "",
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

export type AnimeItem = {
  id: number
  title: string
  nativeTitle?: string
  heroTitle?: string
  cover: string
  rating?: number
  episodes?: number
  format?: string
  duration?: number
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
  airingAt?: number
  nextEpisode?: number
  isToday?: boolean
  watchUrl?: string
  watchLabel?: string
}

export function useHomeData() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const reducedMotion = useMotionPreference()
  const [carouselPaused, setCarouselPaused] = useState(false)
  const [carouselFocused, setCarouselFocused] = useState(false)
  const [currentFeatured, setCurrentFeatured] = useState(0)
  const [featuredAnime, setFeaturedAnime] = useState<AnimeItem[]>([])
  const [trendingAnime, setTrendingAnime] = useState<AnimeItem[]>([])
  const [continueWatching, setContinueWatching] = useState<AnimeItem[]>([])
  const [seasonalAnime, setSeasonalAnime] = useState<AnimeItem[]>([])
  const [homeLoading, setHomeLoading] = useState(true)
  const [continueLoading, setContinueLoading] = useState(true)
  const [homeError, setHomeError] = useState("")
  const [seasonalError, setSeasonalError] = useState("")
  const [homeReloadKey, setHomeReloadKey] = useState(0)
  const [continueError, setContinueError] = useState("")

  useEffect(() => {
    let active = true

    const loadHomeData = async () => {
      setHomeLoading(true)
      setHomeError("")
      setSeasonalError("")

      try {
        const { season, year } = getCurrentSeason()
        const [trendingResult, seasonalResult] = await Promise.allSettled([
          fetchAniList(HOME_TRENDING_QUERY, { page: 1, perPage: 12 }),
          fetchAniList(HOME_SEASONAL_QUERY, { season, seasonYear: year, page: 1, perPage: 12 }),
        ])

        if (!active) return

        const trendingData = trendingResult.status === "fulfilled" ? trendingResult.value : null
        const seasonalData = seasonalResult.status === "fulfilled" ? seasonalResult.value : null
        if (trendingResult.status === "rejected") setHomeError("Featured anime could not load. Please try again.")
        if (seasonalResult.status === "rejected") setSeasonalError("The seasonal schedule could not load. Please try again.")

        const trendingMedia = trendingData?.Page?.media || []
        const nextFeatured = trendingMedia.slice(0, 3).map((media: any, index: number) => mapMediaToHomeAnime(media, index + 1))
        const nextTrending = trendingMedia.slice(0, 6).map((media: any, index: number) => mapMediaToHomeAnime(media, index + 1))
        const nextSeasonal = (seasonalData?.Page?.media || [])
          .filter((media: any) => media?.nextAiringEpisode?.airingAt)
          .slice(0, 8)
          .map((media: any) => ({
            ...mapMediaToHomeAnime(media),
            ...getAiringMeta(media?.nextAiringEpisode?.airingAt),
            airingAt: media.nextAiringEpisode.airingAt,
            nextEpisode: media.nextAiringEpisode.episode,
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
  }, [homeReloadKey])

  useEffect(() => {
    const delay = getFeaturedRotationDelay({ itemCount: featuredAnime.length, paused: carouselPaused, focused: carouselFocused, reducedMotion })
    if (delay === null) return

    const interval = setInterval(() => {
      setCurrentFeatured((prev) => (prev + 1) % featuredAnime.length)
    }, delay)

    return () => clearInterval(interval)
  }, [featuredAnime.length, currentFeatured, carouselPaused, carouselFocused, reducedMotion])

  useEffect(() => {
    if (!featuredAnime.length || currentFeatured < featuredAnime.length) return
    setCurrentFeatured(0)
  }, [currentFeatured, featuredAnime.length])

  useEffect(() => {
    let active = true

    const loadContinueWatching = async () => {
      if (authLoading) {
        return
      }

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
        .select("id, media_id, status, progress, media_type, updated_at")
        .eq("user_id", user.id)
        .eq("media_type", "ANIME")
        .in("status", ["watching", "rewatching"])
        .gt("progress", 0)
        .order("updated_at", { ascending: false })
        .limit(3)

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
          data.map((entry: any) => {
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
  }, [authLoading, user])

  const featured = useMemo(() => featuredAnime[currentFeatured] || null, [currentFeatured, featuredAnime])
  const [addingFeatured, setAddingFeatured] = useState(false)

  const handleAddFeatured = async () => {
    if (!featured || addingFeatured) return
    if (!user) {
      router.push("/login?next=%2F")
      return
    }
    setAddingFeatured(true)
    const { error } = await client.from("list_entries").upsert(
      { user_id: user.id, media_id: featured.id, media_type: "ANIME", status: "plan_to_watch", progress: 0 },
      { onConflict: "user_id,media_id", ignoreDuplicates: true },
    )
    setAddingFeatured(false)
    if (error) {
      toast.error("Couldn't add that to your list. Please try again.")
      return
    }
    toast.success(`${featured.title} is in your list`)
  }

  return { user, authLoading, featuredAnime, trendingAnime, seasonalAnime, seasonalError, continueWatching, continueLoading, continueError, homeLoading, homeError, currentFeatured, setCurrentFeatured, carouselPaused, setCarouselPaused, carouselRunning: !carouselPaused && !carouselFocused && !reducedMotion, setCarouselFocused, addingFeatured, handleAddFeatured, retry: () => setHomeReloadKey(key => key + 1) }
}
