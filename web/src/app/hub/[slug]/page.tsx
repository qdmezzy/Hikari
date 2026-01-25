"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Navigation } from "@/components/Navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Play,
  Pause,
  Plus,
  Heart,
  Share2,
  Eye,
  EyeOff,
  Sparkles,
  Flame,
  Zap,
  Wind,
  Moon,
  HeartIcon,
  MessageCircle,
  Bookmark,
  Check,
  BookmarkPlus,
  Trash2,
  ExternalLink,
  Star,
  Film,
  Users,
  TrendingUp,
  Clock,
  ArrowUpDown,
  Link2,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"

// Types
type SortOption = "trending" | "top" | "new"
type TabOption = "clips" | "fandom" | "about"

const vibeFilters = [
  { id: "hype", label: "Hype", icon: Flame, color: "from-orange-500 to-red-500" },
  { id: "funny", label: "Funny", icon: Sparkles, color: "from-yellow-500 to-amber-500" },
  { id: "action", label: "Action", icon: Zap, color: "from-blue-500 to-cyan-500" },
  { id: "chill", label: "Chill", icon: Wind, color: "from-teal-500 to-emerald-500" },
  { id: "dark", label: "Dark", icon: Moon, color: "from-slate-600 to-slate-800" },
  { id: "romance", label: "Romance", icon: HeartIcon, color: "from-pink-500 to-rose-500" },
  { id: "slow-burn", label: "Slow Burn", icon: Play, color: "from-slate-500 to-slate-700" },
]

const sortOptions = [
  { id: "trending" as SortOption, label: "Trending", icon: TrendingUp },
  { id: "top" as SortOption, label: "Top", icon: Star },
  { id: "new" as SortOption, label: "New", icon: Clock },
]

const HUB_PREFS_KEY = "hikari.hub.prefs"

const listOptions = [
  { id: "watching", label: "Watching", icon: Play, color: "text-blue-400" },
  { id: "completed", label: "Completed", icon: Check, color: "text-green-400" },
  { id: "plan_to_watch", label: "Plan to Watch", icon: BookmarkPlus, color: "text-amber-400" },
  { id: "on_hold", label: "On Hold", icon: Pause, color: "text-yellow-400" },
  { id: "dropped", label: "Dropped", icon: Trash2, color: "text-red-400" },
]

// AniList query for single anime
const ANIME_QUERY = `
query ($search: String) {
  Media(search: $search, type: ANIME) {
    id
    title { romaji english native }
    coverImage { extraLarge large color }
    bannerImage
    description(asHtml: false)
    genres
    tags { name rank isMediaSpoiler }
    averageScore
    popularity
    favourites
    episodes
    duration
    season
    seasonYear
    status
    studios(isMain: true) { nodes { name } }
    trailer { id site thumbnail }
    externalLinks { site url }
  }
}
`

const getSpoilerLevel = (tags: { isMediaSpoiler?: boolean; name: string }[] = []) => {
  if (tags.some((tag) => tag.isMediaSpoiler)) return "Heavy"
  if (tags.some((tag) => /death|tragic|gore|spoiler/i.test(tag.name))) return "Mild"
  return "None"
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return `${num}`
}

const parseVideoUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.replace("www.", "")

    if (host === "youtu.be") {
      const id = url.pathname.slice(1)
      if (!id) return null
      return { site: "youtube", id, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
    }

    if (host.includes("youtube.com")) {
      if (url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.replace("/shorts/", "").split("/")[0]
        if (!id) return null
        return { site: "youtube", id, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
      }
      const id = url.searchParams.get("v")
      if (!id) return null
      return { site: "youtube", id, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
    }

    return null
  } catch {
    return null
  }
}

const getTrailerUrl = (trailer: { id?: string; site?: string } | null) => {
  if (!trailer?.id || !trailer?.site) return null
  const site = trailer.site.toLowerCase()
  if (site === "youtube") return `https://www.youtube.com/watch?v=${trailer.id}`
  if (site === "dailymotion") return `https://www.dailymotion.com/video/${trailer.id}`
  return null
}

const getTrailerEmbedUrl = (trailer: { id?: string; site?: string } | null) => {
  if (!trailer?.id || !trailer?.site) return null
  const site = trailer.site.toLowerCase()
  if (site === "youtube") return `https://www.youtube.com/embed/${trailer.id}`
  if (site === "dailymotion") return `https://www.dailymotion.com/embed/video/${trailer.id}`
  return null
}

const getTrailerThumbnail = (
  trailer: { id?: string; site?: string; thumbnail?: string } | null,
  fallback?: string | null,
) => {
  if (!trailer?.id) return fallback || "/placeholder.svg"
  if (trailer.thumbnail) return trailer.thumbnail
  const site = trailer.site?.toLowerCase()
  if (site === "youtube") return `https://img.youtube.com/vi/${trailer.id}/hqdefault.jpg`
  if (site === "dailymotion") return `https://www.dailymotion.com/thumbnail/video/${trailer.id}`
  return fallback || "/placeholder.svg"
}

const getVibes = (genres: string[] = [], tags: { name: string }[] = []) => {
  const vibeSet = new Set<string>()
  const lowerGenres = genres.map((genre) => genre.toLowerCase())
  const tagNames = tags.map((tag) => tag.name.toLowerCase())

  if (lowerGenres.some((genre) => ["comedy", "parody"].includes(genre))) vibeSet.add("funny")
  if (lowerGenres.some((genre) => ["action", "adventure", "shounen"].includes(genre))) vibeSet.add("hype")
  if (lowerGenres.some((genre) => ["slice of life", "iyashikei"].includes(genre))) vibeSet.add("chill")
  if (lowerGenres.some((genre) => ["psychological", "horror", "thriller"].includes(genre))) vibeSet.add("dark")
  if (lowerGenres.includes("romance")) vibeSet.add("romance")
  if (lowerGenres.includes("drama") || tagNames.includes("slow burn")) vibeSet.add("slow-burn")
  if (lowerGenres.includes("action")) vibeSet.add("action")

  return Array.from(vibeSet)
}

interface AnimeData {
  id: number
  title: { romaji: string; english: string | null; native: string }
  coverImage: { extraLarge: string; large: string; color: string | null }
  bannerImage: string | null
  description: string
  genres: string[]
  tags: { name: string; rank: number; isMediaSpoiler: boolean }[]
  averageScore: number | null
  popularity: number
  favourites: number
  episodes: number | null
  duration: number | null
  season: string | null
  seasonYear: number | null
  status: string
  studios: { nodes: { name: string }[] }
  trailer: { id: string; site: string; thumbnail: string } | null
  externalLinks: { site: string; url: string }[]
}

interface Clip {
  id: string
  animeTitle: string
  animeId: number
  clipTitle: string
  thumbnail: string
  type: string
  spoilerLevel: string
  episode: number | null
  tags: string[]
  likes: number
  comments: number
  shares: number
  description: string
  trailerId: string
  videoUrl?: string | null
  videoSite?: string | null
  creator?: {
    username: string
    displayName: string
    avatar: string | null
  }
  fandomTag?: string
  createdAt?: Date
}

export default function HubPage() {
  const params = useParams()
  const slugParam = params.slug
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam
  const searchTerm = slug ? decodeURIComponent(slug).replace(/-/g, " ") : ""
  const { user } = useAuth()

  const [anime, setAnime] = useState<AnimeData | null>(null)
  const [fandomClips, setFandomClips] = useState<Clip[]>([])
  const [loading, setLoading] = useState(true)
  const [fandomLoading, setFandomLoading] = useState(false)
  const [error, setError] = useState("")
  const [mounted, setMounted] = useState(false)

  const [activeTab, setActiveTab] = useState<TabOption>("clips")
  const [sortBy, setSortBy] = useState<SortOption>("trending")
  const [activeVibes, setActiveVibes] = useState<string[]>([])
  const [spoilersOff, setSpoilersOff] = useState(true)
  const [trailerPlaying, setTrailerPlaying] = useState<string | null>(null)
  const [watchOpen, setWatchOpen] = useState(false)
  const [prefsReady, setPrefsReady] = useState(false)

  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})

  const [addToListOpen, setAddToListOpen] = useState(false)
  const [selectedList, setSelectedList] = useState<string | null>(null)
  const [listPending, setListPending] = useState(false)

  // Submit dialog state
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [submitLink, setSubmitLink] = useState("")
  const [submitTags, setSubmitTags] = useState<string[]>([])
  const [submitHasSpoilers, setSubmitHasSpoilers] = useState(false)
  const [submitSpoilerEpisode, setSubmitSpoilerEpisode] = useState("")
  const [submitPending, setSubmitPending] = useState(false)
  const [submitError, setSubmitError] = useState("")

  // Mount animation trigger
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HUB_PREFS_KEY)
      if (raw) {
        const prefs = JSON.parse(raw)
        if (prefs?.activeTab && ["clips", "fandom", "about"].includes(prefs.activeTab)) {
          setActiveTab(prefs.activeTab as TabOption)
        }
        if (prefs?.sortBy && ["trending", "top", "new"].includes(prefs.sortBy)) {
          setSortBy(prefs.sortBy as SortOption)
        }
        if (typeof prefs?.spoilersOff === "boolean") {
          setSpoilersOff(prefs.spoilersOff)
        }
        if (Array.isArray(prefs?.activeVibes)) {
          const valid = new Set(vibeFilters.map((vibe) => vibe.id))
          setActiveVibes(prefs.activeVibes.filter((vibe: string) => valid.has(vibe)))
        }
      }
    } catch (error) {
      console.warn("Failed to load hub preferences", error)
    } finally {
      setPrefsReady(true)
    }
  }, [])

  useEffect(() => {
    if (!prefsReady) return
    const prefs = {
      activeTab,
      sortBy,
      spoilersOff,
      activeVibes,
    }
    try {
      localStorage.setItem(HUB_PREFS_KEY, JSON.stringify(prefs))
    } catch (error) {
      console.warn("Failed to save hub preferences", error)
    }
  }, [activeTab, sortBy, spoilersOff, activeVibes, prefsReady])

  // Fetch anime data
  useEffect(() => {
    if (!searchTerm) return

    const fetchAnime = async () => {
      setLoading(true)
      setError("")
      try {
        const res = await fetch("/api/anilist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: ANIME_QUERY, variables: { search: searchTerm } }),
        })
        const json = await res.json()
        if (!res.ok || json?.errors) {
          throw new Error(json?.errors?.[0]?.message || "Failed to load anime data.")
        }
        setAnime(json?.data?.Media)
      } catch (err: any) {
        setError(err.message || "Could not load anime.")
      } finally {
        setLoading(false)
      }
    }

    fetchAnime()
  }, [searchTerm])

  useEffect(() => {
    if (!user || !anime) {
      setSelectedList(null)
      return
    }

    const loadListStatus = async () => {
      const { data, error: listError } = await client
        .from("list_entries")
        .select("status")
        .eq("user_id", user.id)
        .eq("media_id", anime.id)
        .maybeSingle()

      if (listError) {
        console.error("Failed to load list status:", listError)
        return
      }

      setSelectedList(data?.status || null)
    }

    loadListStatus()
  }, [user, anime])

  const fetchFandomClips = useCallback(async () => {
    if (!anime) return
    setFandomLoading(true)
    const { data, error: fandomError } = await client
      .from("fandom_clips")
      .select(
        "id, media_id, media_title, clip_title, video_url, video_site, video_id, thumbnail_url, tags, spoiler_level, spoiler_episode, user_display_name, user_handle, user_avatar_url, created_at",
      )
      .eq("media_id", anime.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false })

    if (fandomError) {
      console.error("Failed to load fandom clips:", fandomError)
      setFandomClips([])
      setFandomLoading(false)
      return
    }

    const mapped = (data || []).map((row) => ({
      id: row.id,
      animeTitle: row.media_title,
      animeId: row.media_id,
      clipTitle: row.clip_title || "Fandom Clip",
      thumbnail: row.thumbnail_url || "/placeholder.svg",
      type: "Fandom",
      spoilerLevel: row.spoiler_level || "None",
      episode: row.spoiler_episode || null,
      tags: row.tags || [],
      likes: 0,
      comments: 0,
      shares: 0,
      description: row.clip_title || "Fandom submission.",
      trailerId: row.video_id,
      videoUrl: row.video_url || null,
      videoSite: row.video_site || null,
      creator: {
        username: row.user_handle || "fan",
        displayName: row.user_display_name || row.user_handle || "Hikari Fan",
        avatar: row.user_avatar_url || null,
      },
      fandomTag: row.media_title,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
    }))

    setFandomClips(mapped)
    setFandomLoading(false)
  }, [anime])

  useEffect(() => {
    if (!anime) return
    fetchFandomClips()
  }, [anime, fetchFandomClips])

  // Generate clips
  const officialClips = useMemo<Clip[]>(() => {
    if (!anime?.trailer?.id) return []
    const cleanDescription = anime.description ? anime.description.replace(/<[^>]+>/g, "").slice(0, 150) : ""
    const trailerThumbnail = getTrailerThumbnail(
      anime.trailer,
      anime.bannerImage || anime.coverImage.extraLarge,
    )
    return [
      {
        id: `official-${anime.id}`,
        animeTitle: anime.title.english || anime.title.romaji,
        animeId: anime.id,
        clipTitle: "Official Trailer",
        thumbnail: trailerThumbnail,
        type: "Official",
        spoilerLevel: getSpoilerLevel(anime.tags),
        episode: null,
        tags: getVibes(anime.genres, anime.tags),
        likes: anime.popularity,
        comments: Math.round(anime.popularity / 40),
        shares: Math.round(anime.popularity / 150),
        description: cleanDescription ? `${cleanDescription}...` : "Official trailer.",
        trailerId: anime.trailer.id,
      },
    ]
  }, [anime])

  const currentClips = activeTab === "clips" ? officialClips : fandomClips

  const filteredClips = useMemo(() => {
    let clips = [...currentClips]

    if (activeVibes.length > 0) {
      clips = clips.filter((clip) => clip.tags.some((tag) => activeVibes.includes(tag)))
    }

    if (spoilersOff) {
      clips = clips.filter((clip) => clip.type === "Official" || clip.spoilerLevel === "None")
    }

    switch (sortBy) {
      case "top":
        clips.sort((a, b) => b.likes - a.likes)
        break
      case "new":
        clips.sort((a, b) => {
          const aTime = (a as any).createdAt?.getTime() || 0
          const bTime = (b as any).createdAt?.getTime() || 0
          return bTime - aTime
        })
        break
      case "trending":
      default:
        clips.sort((a, b) => {
          const aScore = a.likes + a.comments * 10 + a.shares * 5
          const bScore = b.likes + b.comments * 10 + b.shares * 5
          return bScore - aScore
        })
    }

    return clips
  }, [currentClips, activeVibes, spoilersOff, sortBy])

  const toggleVibe = (vibe: string) => {
    setActiveVibes((prev) => (prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe]))
  }

  const handleLike = (clipId: string) => {
    setLiked((prev) => ({ ...prev, [clipId]: !prev[clipId] }))
    setLikeCounts((prev) => ({
      ...prev,
      [clipId]: (prev[clipId] || 0) + (liked[clipId] ? -1 : 1),
    }))
  }

  const handleSave = (clipId: string) => {
    setSaved((prev) => ({ ...prev, [clipId]: !prev[clipId] }))
  }

  const trailerEmbedUrl = getTrailerEmbedUrl(anime?.trailer ?? null)
  const trailerUrl = getTrailerUrl(anime?.trailer ?? null)
  const getClipEmbedUrl = (clip: Clip) => {
    if (clip.type === "Official") {
      return trailerEmbedUrl
    }

    const site = clip.videoSite?.toLowerCase()
    if (site === "youtube" && clip.trailerId) {
      return `https://www.youtube.com/embed/${clip.trailerId}`
    }

    const parsed = clip.videoUrl ? parseVideoUrl(clip.videoUrl) : null
    if (parsed?.site === "youtube") {
      return `https://www.youtube.com/embed/${parsed.id}`
    }

    return null
  }

  const handleClipPlay = useCallback(
    (clip: Clip) => {
      if (clip.type === "Official") {
        if (trailerEmbedUrl) {
          setTrailerPlaying(trailerEmbedUrl)
          return
        }
        if (trailerUrl) window.open(trailerUrl, "_blank")
        return
      }

      const site = clip.videoSite?.toLowerCase()
      if (site === "youtube" && clip.trailerId) {
        setTrailerPlaying(`https://www.youtube.com/embed/${clip.trailerId}`)
        return
      }

      const parsed = clip.videoUrl ? parseVideoUrl(clip.videoUrl) : null
      if (parsed?.site === "youtube") {
        setTrailerPlaying(`https://www.youtube.com/embed/${parsed.id}`)
        return
      }

      if (clip.videoUrl) window.open(clip.videoUrl, "_blank")
    },
    [trailerEmbedUrl, trailerUrl],
  )

  const handleAddToList = async (listId: string) => {
    if (!user || !anime) return
    setListPending(true)
    const { error } = await client
      .from("list_entries")
      .upsert(
        {
          user_id: user.id,
          media_id: anime.id,
          media_type: "ANIME",
          status: listId,
          progress: 0,
        },
        { onConflict: "user_id,media_id" },
      )

    if (!error) {
      setSelectedList(listId)
    }
    setListPending(false)
    setAddToListOpen(false)
  }

  const handleRemoveFromList = async () => {
    if (!user || !anime) return
    setListPending(true)
    const { error } = await client.from("list_entries").delete().eq("user_id", user.id).eq("media_id", anime.id)
    if (!error) {
      setSelectedList(null)
    }
    setListPending(false)
    setAddToListOpen(false)
  }

  const handleSubmit = async () => {
    if (!user || !anime) {
      setSubmitError("Sign in to submit a clip.")
      return
    }
    if (!submitLink.trim()) {
      setSubmitError("Add a link to submit.")
      return
    }
    const parsed = parseVideoUrl(submitLink.trim())
    if (!parsed) {
      setSubmitError("Only YouTube links are supported right now.")
      return
    }

    setSubmitPending(true)
    setSubmitError("")

    const displayName =
      user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || "User"
    const handle = user?.user_metadata?.username || user?.user_metadata?.handle || null
    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || null
    const episodeValue =
      submitHasSpoilers && submitSpoilerEpisode ? Number(submitSpoilerEpisode) : null
    const spoilerEpisode = Number.isFinite(episodeValue ?? Number.NaN) ? episodeValue : null

    const { error } = await client.from("fandom_clips").insert({
      user_id: user.id,
      media_id: anime.id,
      media_title: anime.title.english || anime.title.romaji,
      clip_title: null,
      video_url: submitLink.trim(),
      video_site: parsed.site,
      video_id: parsed.id,
      thumbnail_url: parsed.thumbnail,
      tags: submitTags,
      spoiler_level: submitHasSpoilers ? "Mild" : "None",
      spoiler_episode: spoilerEpisode,
      status: "pending",
      user_display_name: displayName,
      user_handle: handle,
      user_avatar_url: avatarUrl,
    })

    if (error) {
      setSubmitError(error.message || "Submit failed.")
      setSubmitPending(false)
      return
    }

    setSubmitDialogOpen(false)
    setSubmitLink("")
    setSubmitTags([])
    setSubmitHasSpoilers(false)
    setSubmitSpoilerEpisode("")
    setSubmitPending(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <p className="text-white/50 text-sm">Loading hub...</p>
        </div>
      </div>
    )
  }

  if (error || !anime) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Anime not found"}</p>
          <Link href="/discover">
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 bg-transparent">
              Back to Discover
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const title = anime.title.english || anime.title.romaji
  const streamingLinks = anime.externalLinks?.filter((link) =>
    ["Crunchyroll", "Netflix", "Hulu", "Funimation", "Amazon Prime Video", "Disney Plus"].includes(link.site)
  )

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      <div className="pt-24 md:pt-20">
        {/* Banner Background */}
        {anime.bannerImage && (
          <div
            className={cn(
              "fixed top-0 left-0 right-0 h-96 overflow-hidden transition-all duration-1000 ease-out",
              mounted ? "opacity-100 scale-100" : "opacity-0 scale-105",
            )}
          >
            <Image
              src={anime.bannerImage || "/placeholder.svg"}
              alt=""
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50" />
          </div>
        )}

        {/* Back Button */}
        <div className="relative z-10 p-4">
          <Link href="/discover">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-2 text-white/60 hover:text-white hover:bg-white/10 transition-all duration-500",
                mounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4",
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>

      {/* Hero Header */}
      <header className="relative z-10 px-4 pb-8 md:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 md:flex-row md:gap-8 lg:gap-12">
            {/* Cover Image */}
            <div 
              className={cn(
                "shrink-0 mx-auto md:mx-0 transition-all duration-700 ease-out",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              )}
              style={{ transitionDelay: "100ms" }}
            >
              <div className="relative h-64 w-44 md:h-80 md:w-56 overflow-hidden rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10">
                <Image
                  src={anime.coverImage.extraLarge || anime.coverImage.large}
                  alt={title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>

            {/* Info */}
            <div 
              className={cn(
                "flex flex-1 flex-col justify-end text-center md:text-left transition-all duration-700 ease-out",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              )}
              style={{ transitionDelay: "200ms" }}
            >
              <div className="mb-2 flex items-center justify-center gap-2 md:justify-start">
                <Badge className="bg-white/10 text-white/80 border-0 backdrop-blur-sm">
                  {anime.status === "FINISHED" ? "Completed" : anime.status === "RELEASING" ? "Airing" : anime.status}
                </Badge>
                {anime.seasonYear && (
                  <Badge className="bg-white/5 text-white/60 border-white/10">
                    {anime.season} {anime.seasonYear}
                  </Badge>
                )}
              </div>

              <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl text-white">
                {title}
              </h1>

              {anime.studios?.nodes?.[0] && (
                <p className="mb-3 text-white/50">
                  {anime.studios.nodes[0].name}
                </p>
              )}

              <p className="mb-4 line-clamp-3 text-sm text-white/60 md:text-base leading-relaxed">
                {anime.description?.replace(/<[^>]+>/g, "").slice(0, 200)}...
              </p>

              {/* Genre Tags */}
              <div className="mb-4 flex flex-wrap justify-center gap-2 md:justify-start">
                {anime.genres?.slice(0, 5).map((genre) => (
                  <Badge
                    key={genre}
                    className="bg-white/5 text-white/70 border-white/10 hover:bg-white/10 transition-colors"
                  >
                    {genre}
                  </Badge>
                ))}
              </div>

              {/* Stats */}
              <div className="mb-6 flex flex-wrap items-center justify-center gap-4 text-sm md:justify-start md:gap-6">
                {anime.averageScore && (
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-medium text-white">{anime.averageScore}%</span>
                  </div>
                )}
                {anime.episodes && (
                  <div className="flex items-center gap-1.5 text-white/50">
                    <Film className="h-4 w-4" />
                    <span>{anime.episodes} episodes</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-white/50">
                  <Users className="h-4 w-4" />
                  <span>{formatNumber(anime.popularity)} fans</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/50">
                  <Heart className="h-4 w-4" />
                  <span>{formatNumber(anime.favourites)} favorites</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div 
                className={cn(
                  "flex flex-wrap items-center justify-center gap-3 md:justify-start transition-all duration-700 ease-out",
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}
                style={{ transitionDelay: "300ms" }}
              >
                {(trailerEmbedUrl || trailerUrl) && (
                  <Button
                    className="gap-2 bg-white text-black hover:bg-white/90 rounded-full px-6"
                    onClick={() => {
                      if (trailerEmbedUrl) {
                        setTrailerPlaying(trailerEmbedUrl)
                        return
                      }
                      if (trailerUrl) window.open(trailerUrl, "_blank")
                    }}
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Watch Trailer
                  </Button>
                )}

                {streamingLinks && streamingLinks.length > 0 && (
                  <Dialog open={watchOpen} onOpenChange={setWatchOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="gap-2 bg-transparent border-white/20 text-white hover:bg-white/10 rounded-full"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Where to Watch
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-zinc-900 border-white/10 text-white">
                      <DialogHeader>
                        <DialogTitle className="text-white">Where to Watch</DialogTitle>
                      </DialogHeader>
                      <div className="flex flex-wrap gap-3">
                        {streamingLinks.map((link) => (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                          >
                            <span className="text-sm font-medium">{link.site}</span>
                            <ExternalLink className="h-3.5 w-3.5 text-white/60" />
                          </a>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                <Dialog open={addToListOpen} onOpenChange={setAddToListOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={!user || listPending}
                      className="gap-2 bg-transparent border-white/20 text-white hover:bg-white/10 rounded-full disabled:opacity-60"
                    >
                      {selectedList ? (
                        <>
                          <Check className="h-4 w-4" />
                          {listOptions.find((l) => l.id === selectedList)?.label}
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Add to List
                        </>
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-zinc-900 border-white/10 text-white">
                    <DialogHeader>
                      <DialogTitle className="text-white">Add to List</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-2 py-4">
                      {listOptions.map((option) => (
                        <Button
                          key={option.id}
                          variant={selectedList === option.id ? "secondary" : "ghost"}
                          className={cn(
                            "justify-start gap-3",
                            selectedList === option.id ? "bg-white/10" : "hover:bg-white/5"
                          )}
                          onClick={() => handleAddToList(option.id)}
                          disabled={!user || listPending}
                        >
                          <option.icon className={cn("h-4 w-4", option.color)} />
                          {option.label}
                          {selectedList === option.id && (
                            <Check className="ml-auto h-4 w-4 text-white" />
                          )}
                        </Button>
                      ))}
                      {selectedList && (
                        <>
                          <div className="border-t border-white/10 my-1" />
                          <Button
                            variant="ghost"
                            className="justify-start gap-3 text-red-300 hover:text-red-200 hover:bg-red-500/10"
                            onClick={handleRemoveFromList}
                            disabled={!user || listPending}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove from List
                          </Button>
                        </>
                      )}
                      {!user && <p className="text-xs text-white/40 pt-1">Sign in to manage your list.</p>}
                    </div>
                  </DialogContent>
                </Dialog>

                <Button variant="ghost" size="icon" className="shrink-0 text-white/60 hover:text-white hover:bg-white/10 rounded-full">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Section */}
      <section 
        className={cn(
          "relative z-10 border-t border-white/10 bg-black/80 backdrop-blur-xl transition-all duration-700 ease-out",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}
        style={{ transitionDelay: "400ms" }}
      >
        <div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-12">
          <Tabs
            defaultValue="clips"
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabOption)}
            className="w-full"
          >
            <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <TabsList className="bg-transparent p-0">
                <TabsTrigger
                  value="clips"
                  className="gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-black text-white/60 hover:text-white"
                >
                  <Film className="h-4 w-4" />
                  Clips
                </TabsTrigger>
                <TabsTrigger
                  value="fandom"
                  className="gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-black text-white/60 hover:text-white"
                >
                  <Users className="h-4 w-4" />
                  Fandom
                </TabsTrigger>
                <TabsTrigger
                  value="about"
                  className="gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-black text-white/60 hover:text-white"
                >
                  <AlertTriangle className="h-4 w-4" />
                  About
                </TabsTrigger>
              </TabsList>

              {activeTab === "fandom" && (
                <Dialog
                  open={submitDialogOpen}
                  onOpenChange={(open) => {
                    setSubmitDialogOpen(open)
                    if (!open) {
                      setSubmitError("")
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white border-0 rounded-full">
                      <Plus className="h-4 w-4" />
                      Submit to {title}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md bg-zinc-950/95 border-white/10 text-white">
                    <DialogHeader>
                      <DialogTitle className="text-white">Submit to {title}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="link" className="text-white/70">Video Link</Label>
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-white/40" />
                          <Input
                            id="link"
                            placeholder="https://youtube.com/watch?v=..."
                            value={submitLink}
                            onChange={(e) => setSubmitLink(e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-white/70">Vibe Tags</Label>
                        <div className="flex flex-wrap gap-2">
                          {vibeFilters.map((vibe) => (
                            <Badge
                              key={vibe.id}
                              variant={submitTags.includes(vibe.id) ? "default" : "outline"}
                              className={cn(
                                "cursor-pointer transition-all duration-200",
                                submitTags.includes(vibe.id)
                                  ? `bg-gradient-to-r ${vibe.color} border-0 text-white`
                                  : "border-white/20 text-white/60 hover:border-white/40"
                              )}
                              onClick={() =>
                                setSubmitTags((prev) =>
                                  prev.includes(vibe.id)
                                    ? prev.filter((t) => t !== vibe.id)
                                    : [...prev, vibe.id]
                                )
                              }
                            >
                              <vibe.icon className="mr-1 h-3 w-3" />
                              {vibe.label}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="spoilers"
                          checked={submitHasSpoilers}
                          onCheckedChange={(checked) => setSubmitHasSpoilers(checked as boolean)}
                          className="border-white/20 data-[state=checked]:bg-rose-500"
                        />
                        <Label htmlFor="spoilers" className="cursor-pointer text-white/70">
                          Contains spoilers
                        </Label>
                      </div>

                      {submitHasSpoilers && (
                        <div className="grid gap-2">
                          <Label htmlFor="episode" className="text-white/70">Spoilers up to episode</Label>
                          <Input
                            id="episode"
                            type="number"
                            placeholder="e.g. 12"
                            value={submitSpoilerEpisode}
                            onChange={(e) => setSubmitSpoilerEpisode(e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                          />
                        </div>
                      )}

                      {submitError && <p className="text-xs text-red-400">{submitError}</p>}
                      <Button
                        onClick={handleSubmit}
                        disabled={!submitLink.trim() || submitPending}
                        className="bg-white text-black hover:bg-white/90"
                      >
                        {submitPending ? "Submitting..." : "Submit for Review"}
                      </Button>
                      {!user && <p className="text-xs text-white/40">Sign in to submit a fandom clip.</p>}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Filters Bar */}
            {(activeTab === "clips" || activeTab === "fandom") && (
              <div className="flex flex-wrap items-center gap-3 border-t border-white/10 py-4">
                {/* Sort */}
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-auto gap-2 bg-white/5 border-white/10 text-white/70 hover:bg-white/10">
                    <ArrowUpDown className="h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10">
                    {sortOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id} className="text-white hover:bg-white/10">
                        <div className="flex items-center gap-2">
                          <option.icon className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Vibe Filters */}
                <div className="flex flex-wrap gap-2">
                  {vibeFilters.map((vibe) => (
                    <Badge
                      key={vibe.id}
                      variant={activeVibes.includes(vibe.id) ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer transition-all duration-200",
                        activeVibes.includes(vibe.id)
                          ? `bg-gradient-to-r ${vibe.color} border-0 text-white shadow-lg`
                          : "border-white/20 text-white/60 hover:border-white/40"
                      )}
                      onClick={() => toggleVibe(vibe.id)}
                    >
                      <vibe.icon className="mr-1 h-3 w-3" />
                      {vibe.label}
                    </Badge>
                  ))}
                </div>

                {/* Spoiler Shield */}
                <div className="ml-auto flex items-center gap-2">
                  {spoilersOff ? (
                    <EyeOff className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-white/40" />
                  )}
                  <span className="text-sm text-white/50">Spoiler Shield</span>
                  <Switch
                    checked={spoilersOff}
                    onCheckedChange={setSpoilersOff}
                    className="data-[state=checked]:bg-amber-500"
                  />
                </div>
              </div>
            )}

            {/* Clips Tab Content */}
            <TabsContent value="clips" className="mt-0">
              <div className="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredClips.length === 0 ? (
                  <div className="col-span-full py-12 text-center">
                    <Film className="mx-auto mb-4 h-12 w-12 text-white/20" />
                    <p className="text-white/50">No official clips available</p>
                  </div>
                ) : (
                  filteredClips.map((clip, i) => (
                    <ClipCard
                      key={clip.id}
                      clip={clip}
                      liked={liked[clip.id]}
                      saved={saved[clip.id]}
                      likeCount={likeCounts[clip.id]}
                      onLike={() => handleLike(clip.id)}
                      onSave={() => handleSave(clip.id)}
                      onPlay={() => handleClipPlay(clip)}
                      index={i}
                    />
                  ))
                )}
              </div>
            </TabsContent>

            {/* Fandom Tab Content */}
            <TabsContent value="fandom" className="mt-0">
              {fandomLoading ? (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  <p className="text-white/50">Loading fandom clips...</p>
                </div>
              ) : filteredClips.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="mx-auto mb-4 h-12 w-12 text-white/20" />
                  <p className="mb-4 text-white/50">No fandom posts yet</p>
                  <Button onClick={() => setSubmitDialogOpen(true)} className="gap-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-full">
                    <Plus className="h-4 w-4" />
                    Be the first to submit
                  </Button>
                </div>
              ) : (
                <div className="py-6">
                  <div className="mx-auto flex max-w-4xl flex-col gap-6 max-h-[72vh] overflow-y-auto snap-y snap-mandatory pr-2">
                    {filteredClips.map((clip) => {
                      const embedUrl = getClipEmbedUrl(clip)
                      return (
                        <div
                          key={clip.id}
                          className="relative h-[70vh] snap-start overflow-hidden rounded-3xl border border-white/10 bg-black/60 shadow-2xl"
                        >
                          {embedUrl ? (
                            <iframe
                              src={embedUrl}
                              title={clip.clipTitle}
                              className="h-full w-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-zinc-900">
                              <div className="text-center">
                                <p className="mb-4 text-white/60">Preview unavailable</p>
                                {clip.videoUrl && (
                                  <Button
                                    onClick={() => window.open(clip.videoUrl as string, "_blank")}
                                    className="gap-2 bg-white text-black hover:bg-white/90 rounded-full px-6"
                                  >
                                    <Play className="h-4 w-4 fill-current" />
                                    Open Clip
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-white/70 text-xs uppercase tracking-wide">Fandom Clip</p>
                              <h3 className="text-white text-lg font-semibold truncate">{clip.clipTitle}</h3>
                              {clip.creator && (
                                <p className="text-white/50 text-sm truncate">
                                  {clip.creator.displayName} {clip.creator.username ? `@${clip.creator.username}` : ""}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleLike(clip.id)}
                                className="pointer-events-auto flex items-center gap-1.5 text-sm text-white/70 hover:text-rose-400 transition-all"
                              >
                                <Heart className={cn("h-4 w-4", liked[clip.id] && "fill-rose-500 text-rose-500")} />
                                <span>{formatNumber((likeCounts[clip.id] || 0) + clip.likes)}</span>
                              </button>
                              <button
                                onClick={() => handleSave(clip.id)}
                                className="pointer-events-auto text-white/70 hover:text-white transition-all"
                              >
                                <Bookmark className={cn("h-4 w-4", saved[clip.id] && "fill-white text-white")} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* About Tab Content */}
            <TabsContent value="about" className="mt-0">
              <div className="max-w-3xl py-6">
                <h2 className="mb-4 text-xl font-semibold text-white">About {title}</h2>
                <p className="mb-6 text-white/60 leading-relaxed">
                  {anime.description?.replace(/<[^>]+>/g, "")}
                </p>

                {anime.tags && anime.tags.length > 0 && (
                  <>
                    <h3 className="mb-3 text-lg font-medium text-white">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {anime.tags
                        .filter((tag) => !tag.isMediaSpoiler)
                        .slice(0, 15)
                        .map((tag) => (
                          <Badge key={tag.name} className="bg-white/5 text-white/60 border-white/10">
                            {tag.name}
                          </Badge>
                        ))}
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {trailerPlaying && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setTrailerPlaying(null)}
        >
          <div
            className="relative w-full max-w-4xl mx-4 aspect-video bg-black rounded-2xl overflow-hidden animate-scale-in"
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
  </div>
  )
}

// Clip Card Component
function ClipCard({
  clip,
  liked,
  saved,
  likeCount,
  onLike,
  onSave,
  onPlay,
  showCreator = false,
  index = 0,
}: {
  clip: Clip
  liked?: boolean
  saved?: boolean
  likeCount?: number
  onLike: () => void
  onSave: () => void
  onPlay?: () => void
  showCreator?: boolean
  index?: number
}) {
  const [visible, setVisible] = useState(false)
  const displayLikes = (likeCount ?? 0) + clip.likes

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), index * 100)
    return () => clearTimeout(timer)
  }, [index])

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-zinc-900/80 border border-white/10 transition-all duration-500 ease-out hover:border-white/20 hover:bg-zinc-900",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
    >
      {/* Thumbnail */}
      <div
        className={cn("relative aspect-video overflow-hidden", onPlay && "cursor-pointer")}
        onClick={onPlay}
      >
        <Image
          src={clip.thumbnail || "/placeholder.svg"}
          alt={clip.clipTitle}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Play Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
          <button
            type="button"
            className="rounded-full bg-white p-4 shadow-2xl transition-transform duration-300 group-hover:scale-110"
            onClick={(event) => {
              event.stopPropagation()
              onPlay?.()
            }}
          >
            <Play className="h-6 w-6 fill-black text-black" />
          </button>
        </div>

        {/* Type Badge */}
        <Badge
          className={cn(
            "absolute left-3 top-3 border-0",
            clip.type === "Official"
              ? "bg-white/20 text-white backdrop-blur-sm"
              : "bg-gradient-to-r from-rose-500 to-pink-500 text-white"
          )}
        >
          {clip.type}
        </Badge>

        {/* Spoiler Badge */}
        {clip.spoilerLevel !== "None" && (
          <Badge className="absolute right-3 top-3 border-0 bg-amber-500/90 text-black font-medium">
            {clip.spoilerLevel} Spoilers
            {clip.episode && ` (Ep ${clip.episode})`}
          </Badge>
        )}

        {/* Vibe Tags */}
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
          {clip.tags.slice(0, 2).map((tag) => {
            const vibe = vibeFilters.find((v) => v.id === tag)
            if (!vibe) return null
            return (
              <Badge
                key={tag}
                className={cn(
                  "border-0 bg-gradient-to-r text-white text-xs shadow-sm",
                  vibe.color
                )}
              >
                <vibe.icon className="mr-1 h-3 w-3" />
                {vibe.label}
              </Badge>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="mb-1 font-medium line-clamp-1 text-white">{clip.clipTitle}</h3>
        <p className="mb-3 text-sm text-white/50 line-clamp-2">{clip.description}</p>

        {/* Creator Info (for fandom posts) */}
        {showCreator && clip.creator && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-pink-500 overflow-hidden">
              {clip.creator.avatar ? (
                <img src={clip.creator.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-white">
                  {clip.creator.displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{clip.creator.displayName}</p>
              <p className="truncate text-xs text-white/40">
                {clip.creator.username ? `@${clip.creator.username}` : "Community"}
              </p>
              <p className="truncate text-xs text-white/40">Posted to {clip.fandomTag}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onLike}
              className="flex items-center gap-1.5 text-sm text-white/50 transition-all duration-200 hover:text-rose-400 group/like"
            >
              <Heart className={cn(
                "h-4 w-4 transition-all duration-200",
                liked ? "fill-rose-500 text-rose-500 scale-110" : "group-hover/like:scale-110"
              )} />
              <span className={cn(liked && "text-rose-400")}>{formatNumber(displayLikes)}</span>
            </button>
            <span className="flex items-center gap-1.5 text-sm text-white/50">
              <MessageCircle className="h-4 w-4" />
              <span>{formatNumber(clip.comments)}</span>
            </span>
            <span className="flex items-center gap-1.5 text-sm text-white/50">
              <Share2 className="h-4 w-4" />
              <span>{formatNumber(clip.shares)}</span>
            </span>
          </div>
          <button
            onClick={onSave}
            className="text-white/50 transition-all duration-200 hover:text-white"
          >
            <Bookmark className={cn("h-4 w-4 transition-all duration-200", saved && "fill-white text-white scale-110")} />
          </button>
        </div>
      </div>
    </div>
  )
}
