import { useCallback, useEffect, useState } from "react"
import {
  fetchAniList,
  HOME_TRENDING_QUERY,
  HOME_SEASONAL_QUERY,
  getCurrentSeason,
  getMediaTitle,
  getEpisodeCount,
  getPrimaryStudio,
  formatAniListStatus,
  getPreferredStreamingLink,
  sanitizeDescription,
  type AniListMedia,
} from "@/lib/anilist"
import type { AnimeCardItem } from "@/components/media/AnimeCard"
import { formatRelativeTime } from "@/lib/utils"

export interface FeaturedAnime extends AnimeCardItem {
  banner?: string
  description?: string
  heroDescription?: string
  heroTitle?: string
  genres?: string[]
  watchUrl?: string
  watchLabel?: string
}

export interface ContinueWatchingItem extends AnimeCardItem {
  progress: number
  currentEp: number
  totalEp: number | null
  nextEpIn?: string
}

export interface SeasonalItem extends AnimeCardItem {
  day: string
  time: string
  isToday: boolean
  airingEpisode: number
}

const HERO_TITLE_MAX_LENGTH = 34

function truncateAtWord(value: string, maxLength: number): string {
  const text = String(value || "").replace(/\s+/g, " ").trim()
  if (!text) return ""
  if (text.length <= maxLength) return text
  const slice = text.slice(0, maxLength + 1)
  const boundary = slice.lastIndexOf(" ")
  const trimmed = (
    boundary > maxLength * 0.6 ? slice.slice(0, boundary) : slice.slice(0, maxLength)
  ).trim()
  return `${trimmed.replace(/[,:;.-]+$/, "")}...`
}

function getHeroTitle(media: AniListMedia): string {
  const candidates = [media?.title?.english, media?.title?.romaji]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
  if (!candidates.length) return getMediaTitle(media)
  const alreadyShort = candidates.find((t) => t.length <= HERO_TITLE_MAX_LENGTH)
  if (alreadyShort) return alreadyShort
  return truncateAtWord(
    candidates.sort((a, b) => a.length - b.length)[0],
    HERO_TITLE_MAX_LENGTH,
  )
}

function getHeroDescription(value: string | null | undefined): string {
  const cleaned = sanitizeDescription(value)
    .replace(/\(source:[^)]+\)$/i, "")
    .replace(/\bsource:\s*[^.?!]+[.?!]?/i, "")
    .trim()
  if (!cleaned) return ""
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  let teaser = ""
  for (const sentence of sentences) {
    const next = teaser ? `${teaser} ${sentence}` : sentence
    if (next.length > 180) break
    teaser = next
    if (teaser.length >= 120 && teaser.match(/[.!?]/g)?.length) break
  }
  return teaser || truncateAtWord(cleaned, 180)
}

function toCardItem(media: AniListMedia, rank?: number): AnimeCardItem {
  const watch = getPreferredStreamingLink(media)
  return {
    id: media.id,
    title: getMediaTitle(media),
    cover: media?.coverImage?.extraLarge || media?.coverImage?.large || "",
    rating: media?.averageScore ? Number((media.averageScore / 10).toFixed(1)) : null,
    episodes: getEpisodeCount(media),
    status: formatAniListStatus(media?.status),
    year: media?.startDate?.year ?? null,
    studio: getPrimaryStudio(media),
    watchLabel: watch?.site ? `Watch on ${watch.site}` : undefined,
    popularity: media?.popularity ?? null,
  }
}

function toFeatured(media: AniListMedia, rank?: number): FeaturedAnime {
  const watch = getPreferredStreamingLink(media)
  return {
    ...toCardItem(media, rank),
    banner: media?.bannerImage || media?.coverImage?.extraLarge || media?.coverImage?.large || "",
    description: sanitizeDescription(media?.description),
    heroDescription: getHeroDescription(media?.description),
    heroTitle: getHeroTitle(media),
    genres: media?.genres ?? [],
    watchUrl: watch?.url,
    watchLabel: watch?.site ? `Watch on ${watch.site}` : undefined,
  }
}

function getAiringMeta(airingAt?: number | null) {
  if (!airingAt) return { day: "TBA", time: "", isToday: false }
  const date = new Date(airingAt * 1000)
  const now = new Date()
  return {
    day: date.toLocaleDateString("en-US", { weekday: "short" }),
    time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    isToday: date.toDateString() === now.toDateString(),
  }
}

export function useHomeData() {
  const [featured, setFeatured] = useState<FeaturedAnime[]>([])
  const [trending, setTrending] = useState<AnimeCardItem[]>([])
  const [seasonal, setSeasonal] = useState<SeasonalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const { season, year } = getCurrentSeason()
      const [trendingData, seasonalData] = await Promise.all([
        fetchAniList<{ Page: { media: AniListMedia[] } }>(HOME_TRENDING_QUERY, {
          page: 1,
          perPage: 12,
        }),
        fetchAniList<{ Page: { media: AniListMedia[] } }>(HOME_SEASONAL_QUERY, {
          season,
          seasonYear: year,
          page: 1,
          perPage: 12,
        }),
      ])

      const trendingMedia = trendingData?.Page?.media ?? []
      const nextFeatured = trendingMedia.slice(0, 5).map((m, i) => toFeatured(m, i + 1))
      const nextTrending = trendingMedia.slice(0, 10).map((m, i) => toCardItem(m, i + 1))
      const nextSeasonal = (seasonalData?.Page?.media ?? [])
        .filter((m) => m?.nextAiringEpisode?.airingAt)
        .slice(0, 8)
        .map((m) => ({
          ...toCardItem(m),
          ...getAiringMeta(m?.nextAiringEpisode?.airingAt),
          airingEpisode: m?.nextAiringEpisode?.episode ?? 0,
        }))

      setFeatured(nextFeatured)
      setTrending(nextTrending)
      setSeasonal(nextSeasonal)
    } catch (e: any) {
      console.error("Failed to load home data:", e)
      setError(e?.message || "Could not load anime right now.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { featured, trending, seasonal, loading, error, reload: load }
}
