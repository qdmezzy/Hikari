"use client"
import { readAllRows } from "@/lib/read-all-rows.mjs"

import { useState, useRef, useEffect, useCallback } from "react"
import { DiscoverScreen } from "@/components/discover/DiscoverScreen"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Heart, Bookmark, Share2, Play, Plus, ChevronUp, ChevronDown, 
  Flame, Sparkles, Zap, Wind, Moon, Check, Volume2, VolumeX,
  Star, Info, HeartIcon, Eye, EyeOff
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageLoader } from "@/components/ui/page-loader"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Navigation } from "@/components/layout/Navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getMediaHref, fetchAniListMediaByIds } from "@/lib/anilist"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"

// Vibe filters
const vibeFilters = [
  { id: "all", label: "For You", icon: Sparkles, color: "from-primary to-accent" },
  { id: "hype", label: "Hype", icon: Flame, color: "from-orange-500 to-red-500" },
  { id: "action", label: "Action", icon: Zap, color: "from-blue-500 to-cyan-500" },
  { id: "chill", label: "Chill", icon: Wind, color: "from-teal-500 to-emerald-500" },
  { id: "dark", label: "Dark", icon: Moon, color: "from-slate-600 to-slate-800" },
  { id: "romance", label: "Romance", icon: HeartIcon, color: "from-pink-500 to-rose-500" },
]

type DiscoverItem = {
  id: number
  title: string
  cover: string
  banner: string
  rating: number
  episodes: number
  description: string
  genres: string[]
  vibes: string[]
  popularity: number
  likes: number
  trailerId: string | null
}

// One fixed sort for everyone: identical queries let the proxy's shared cache
// absorb repeat loads instead of each visitor being a fresh AniList cache-miss.
// Per-session variety comes from shuffleDiscoverItems.
const DISCOVER_SORT = ["TRENDING_DESC", "POPULARITY_DESC"]

const DISCOVER_QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $genreIn: [String], $idNotIn: [Int]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { currentPage hasNextPage lastPage }
    media(type: ANIME, sort: $sort, isAdult: false, genre_in: $genreIn, id_not_in: $idNotIn) {
      id
      title { romaji english }
      coverImage { extraLarge large }
      bannerImage
      trailer { id site thumbnail }
      averageScore
      episodes
      description(asHtml: false)
      genres
      tags { name }
      popularity
      favourites
    }
  }
}
`

const getVibes = (genres: Array<string | null> = [], tags: Array<{ name?: string | null }> = []) => {
  const vibeSet = new Set<string>()
  const lowerGenres = (Array.isArray(genres) ? genres : [])
    .filter(Boolean)
    .map((genre) => String(genre).toLowerCase())
  const tagNames = (Array.isArray(tags) ? tags : []).map((tag) => String(tag?.name || "").toLowerCase())

  if (lowerGenres.some((genre) => ["action", "adventure", "shounen"].includes(genre))) vibeSet.add("hype")
  if (lowerGenres.includes("action")) vibeSet.add("action")
  if (lowerGenres.some((genre) => ["slice of life", "iyashikei", "fantasy"].includes(genre))) vibeSet.add("chill")
  if (lowerGenres.some((genre) => ["psychological", "horror", "thriller"].includes(genre))) vibeSet.add("dark")
  if (lowerGenres.includes("romance")) vibeSet.add("romance")
  if (lowerGenres.includes("drama") || tagNames.includes("slow burn")) vibeSet.add("dark")

  return Array.from(vibeSet)
}

const getYouTubeId = (trailer: { id?: string | null; site?: string | null } | null | undefined) => {
  if (!trailer?.id || trailer?.site?.toLowerCase() !== "youtube") return null
  return trailer.id
}

const mapMediaToDiscoverItem = (media: any): DiscoverItem | null => {
  const trailerId = getYouTubeId(media?.trailer)
  if (!trailerId) return null

  return {
    id: media.id,
    title: media?.title?.english || media?.title?.romaji || "Untitled",
    cover:
      media?.coverImage?.extraLarge ||
      media?.coverImage?.large ||
      media?.bannerImage ||
      "/placeholder.svg",
    banner:
      media?.bannerImage ||
      media?.trailer?.thumbnail ||
      media?.coverImage?.extraLarge ||
      media?.coverImage?.large ||
      "/placeholder.svg",
    rating: typeof media?.averageScore === "number" ? Number((media.averageScore / 10).toFixed(1)) : 0,
    episodes: media?.episodes || 0,
    description: String(media?.description || "").replace(/<[^>]+>/g, ""),
    genres: Array.isArray(media?.genres) ? media.genres : [],
    vibes: getVibes(media?.genres || [], media?.tags || []),
    popularity: media?.popularity || 0,
    likes: media?.favourites || media?.popularity || 0,
    trailerId,
  }
}

const DISCOVER_PAGE_SIZE = 50
// Kept low to respect AniList's rate limit (~30 req/min, shared across all users
// via one server IP). Fewer pages per load + a shallow, cache-shareable start
// range keeps Discover under budget instead of triggering upstream 500s.
const DISCOVER_MIN_BUFFER = 8
const DISCOVER_MAX_PAGE_HOPS = 2

const shuffleDiscoverItems = <T,>(items: T[]) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
  return `${num}`
}

export default function DiscoverPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [discoverFeed, setDiscoverFeed] = useState<DiscoverItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [activeVibe, setActiveVibe] = useState("all")
  const [liked, setLiked] = useState<Record<number, boolean>>({})
  const [saved, setSaved] = useState<Record<number, boolean>>({})
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [spoilerSafe, setSpoilerSafe] = useState(false)
  const [isTrailerLoaded, setIsTrailerLoaded] = useState(false)
  const [showTrailerFrame, setShowTrailerFrame] = useState(false)
  const [isTrailerPlayerOpen, setIsTrailerPlayerOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const loadMoreInFlightRef = useRef(false)
  // ?focus=<mediaId> (e.g. from the Discord bot's Trailer button) puts that
  // title at the top of the feed so its trailer plays first.
  const focusIdRef = useRef<number | null>(null)
  // Personalization: top genres from the user's list + ids to exclude (already tracked).
  const activeVibeRef = useRef("all")
  const personalGenresRef = useRef<string[]>([])
  const personalExcludeRef = useRef<number[]>([])
  // Load the feed exactly once, after we know whether/how to personalize it,
  // so personalization never reloads (and cuts off) a trailer that's playing.
  const [tasteResolved, setTasteResolved] = useState(false)
  const feedLoadedRef = useRef(false)
  // Which media are already on the user's list (id -> status), to reflect the save button.
  const [savedStatus, setSavedStatus] = useState<Record<number, string>>({})
  const savingRef = useRef<Set<number>>(new Set())
  const [hiddenTitles, setHiddenTitles] = useState<Array<{id:number;title:string}>>([])
  const [hiddenReady, setHiddenReady] = useState("")
  const [pendingSaveId, setPendingSaveId] = useState<number | null>(null)
  useEffect(() => {
    if (authLoading) return
    const key = `hikari-hidden-discover-${user?.id || "guest"}`
    let active=true
    setHiddenReady("");setHiddenTitles([])
    if(user?.id){
      readAllRows(() => client.from("discover_hidden_titles").select("media_id,title").eq("user_id",user.id), { key: "media_id", isActive: () => active }).then(({data,error})=>{
        if(!active)return
        if(error){toast.error("Hidden titles couldn’t sync. Account hiding needs the latest database migration.");return}
        setHiddenTitles((data||[]).map(item=>({id:Number(item.media_id),title:item.title})));setHiddenReady(key)
      })
    }else{
      try { const values = JSON.parse(localStorage.getItem(key) || "[]"); setHiddenTitles(Array.isArray(values) ? values.filter(item => Number.isSafeInteger(item?.id) && typeof item?.title === "string") : []) } catch { setHiddenTitles([]) }
      setHiddenReady(key)
    }
    const query = new URLSearchParams(window.location.search)
    const id = Number(query.get("focus"))
    if (user && query.get("intent") === "save" && Number.isSafeInteger(id) && id > 0) setPendingSaveId(id)
    return()=>{active=false}
  }, [authLoading, user?.id])
  useEffect(() => {
    if (user || hiddenReady !== "hikari-hidden-discover-guest") return
    try { localStorage.setItem(hiddenReady, JSON.stringify(hiddenTitles)) } catch { toast.error("Hidden titles could not be remembered in this browser.") }
  }, [hiddenTitles, hiddenReady, user?.id])
  const restoreTitle = async (id:number) => {
    if(!hiddenReady){toast.error("Hidden titles aren’t ready. Reload after setup.");return}
    if(user){const {error}=await client.from("discover_hidden_titles").delete().eq("user_id",user.id).eq("media_id",id);if(error){toast.error("Couldn’t restore this title. Please retry.");return}}
    setHiddenTitles(items => items.filter(item => item.id !== id))
  }
  const hideTitle = async (title:DiscoverItem) => {
    if(!hiddenReady){toast.error("Hidden titles aren’t ready. Reload after setup.");return}
    if(user){const {error}=await client.from("discover_hidden_titles").upsert({user_id:user.id,media_id:title.id,title:title.title.slice(0,300)});if(error){toast.error("This title wasn’t hidden. Please retry.");return}}
    setHiddenTitles(items => [...items.filter(item => item.id !== title.id), {id:title.id,title:title.title}])
    toast(user?"Hidden from your account’s feed":"Hidden from this browser’s feed", {action:{label:"Undo",onClick:()=>restoreTitle(title.id)}})
  }
  const hideRelatedTitles = async (titles:{id:number,title:string}[]) => {
    if(!hiddenReady)return false
    const additions=titles.filter(title=>!hiddenTitles.some(hidden=>hidden.id===title.id))
    if(!additions.length)return true
    if(user){const {error}=await client.from("discover_hidden_titles").upsert(additions.map(title=>({user_id:user.id,media_id:title.id,title:title.title.slice(0,300)})));if(error)return false}
    setHiddenTitles(current=>[...current,...additions.filter(title=>!current.some(hidden=>hidden.id===title.id))])
    toast(`${additions.length} titles hidden`,{action:{label:"Undo",onClick:async()=>{
      const ids=additions.map(title=>title.id)
      if(user){const {error}=await client.from("discover_hidden_titles").delete().eq("user_id",user.id).in("media_id",ids);if(error){toast.error("Couldn’t undo. Restore titles from the hidden list.");return}}
      setHiddenTitles(current=>current.filter(title=>!ids.includes(title.id)))
    }}})
    return true
  }

  useEffect(() => {
    activeVibeRef.current = activeVibe
  }, [activeVibe])

  const filteredFeed = discoverFeed.filter(item => !hiddenTitles.some(hidden => hidden.id === item.id) && (activeVibe === "all" || item.vibes.includes(activeVibe)))

  const currentAnime = filteredFeed[currentIndex] || filteredFeed[0]
  const isDiscoverPending = !currentAnime && (loadingMore || discoverFeed.length === 0)

  const redirectToLogin = useCallback(() => {
    if (typeof window === "undefined") return
    const next = `${window.location.pathname}${window.location.search}`
    router.push(`/login?next=${encodeURIComponent(next)}`)
  }, [router])

  const ensureSignedIn = useCallback(() => {
    if (authLoading) return false
    if (user) return true
    redirectToLogin()
    return false
  }, [authLoading, redirectToLogin, user])

  const goToNext = useCallback(() => {
    if (isTransitioning || currentIndex >= filteredFeed.length - 1) return
    setIsTransitioning(true)
    setCurrentIndex(prev => prev + 1)
    setTimeout(() => setIsTransitioning(false), 500)
  }, [isTransitioning, currentIndex, filteredFeed.length])

  const goToPrev = useCallback(() => {
    if (isTransitioning || currentIndex <= 0) return
    setIsTransitioning(true)
    setCurrentIndex(prev => prev - 1)
    setTimeout(() => setIsTransitioning(false), 500)
  }, [isTransitioning, currentIndex])

  const toggleLike = (id: number) => {
    if (!ensureSignedIn()) return
    setLiked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const STATUS_LABELS: Record<string, string> = {
    watching: "Watching",
    completed: "Completed",
    plan_to_watch: "Plan to Watch",
    on_hold: "On Hold",
    dropped: "Dropped",
    rewatching: "Rewatching",
  }

  const toggleSave = async (id: number) => {
    if (authLoading) return
    if (!user) {
      router.push(`/login?next=${encodeURIComponent("/discover?focus=" + id + "&intent=save")}`)
      return
    }
    if (savingRef.current.has(id)) return
    if (saved[id]) { toast.info(`Already in ${STATUS_LABELS[savedStatus[id]] || "your list"}`); return }
    savingRef.current.add(id)
    try {
      const { data, error } = await client.from("list_entries").upsert(
        { user_id:user.id,media_id:id,media_type:"ANIME",status:"plan_to_watch",progress:0 },
        {onConflict:"user_id,media_id",ignoreDuplicates:true},
      ).select("id,updated_at")
      if (error) throw error
      const inserted = data?.[0]
      setSaved(previous => ({...previous,[id]:true}))
      setSavedStatus(previous => ({...previous,[id]:"plan_to_watch"}))
      setPendingSaveId(null)
      if (!inserted) { toast.info("This title is already in your list."); return }
      toast.success("Saved to Plan to Watch", { action: { label:"Undo", onClick:async()=>{
        try {
          let query = client.from("list_entries").delete().eq("user_id",user.id).eq("id",inserted.id).eq("status","plan_to_watch").eq("progress",0)
          if (inserted.updated_at) query = query.eq("updated_at",inserted.updated_at)
          const {data:removed,error:undoError} = await query.select("id")
          if (undoError) throw undoError
          if (!removed?.length) { toast.info("That entry has changed. Manage it in My List."); return }
          setSaved(previous => ({...previous,[id]:false}))
          toast("Save undone")
        } catch { toast.error("Could not undo. Your saved title is unchanged.") }
      }}})
    } catch { toast.error("Couldn't save this title. Please try again.") }
    finally { savingRef.current.delete(id) }
  }

  const toggleMute = () => {
    setIsMuted((prev) => !prev)
  }

  const toggleSpoilerSafe = () => {
    setSpoilerSafe((prev) => !prev)
  }

  const handleShare = async () => {
    if (!currentAnime || typeof window === "undefined") return
    const url = `${window.location.origin}${getMediaHref(currentAnime.id, currentAnime.title)}`
    try {
      if (navigator.share) {
        await navigator.share({ title: currentAnime.title, text: `Check out ${currentAnime.title} on Hikari`, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success("Link copied")
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        toast.error("Couldn’t share this title. Please try again.")
      }
    }
  }

  const [feedError, setFeedError] = useState(false)
  const failuresRef = useRef(0)

  const loadFeedPage = useCallback(async (nextPage: number, append = false) => {
    if (loadMoreInFlightRef.current) return
    loadMoreInFlightRef.current = true
    setLoadingMore(true)

    try {
      const requestPage = async (pageNumber: number) => {
        const usePersonal = activeVibeRef.current === "all" && personalGenresRef.current.length > 0
        // AniList 500s on filter variables passed as explicit null, so only
        // include genreIn/idNotIn when they carry real values.
        const variables: Record<string, unknown> = {
          page: pageNumber,
          perPage: DISCOVER_PAGE_SIZE,
          sort: DISCOVER_SORT,
        }
        if (usePersonal) {
          variables.genreIn = personalGenresRef.current
          const excludeIds = personalExcludeRef.current.slice(0, 100)
          if (excludeIds.length) variables.idNotIn = excludeIds
        }
        const response = await fetch("/api/anilist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: DISCOVER_QUERY, variables }),
        })

        const json = await response.json()
        if (!response.ok || json?.errors) {
          throw new Error(json?.errors?.[0]?.message || "Failed to load discovery feed.")
        }

        return {
          json,
          items: shuffleDiscoverItems(
            ((json?.data?.Page?.media || [])
              .map((media: any) => {
                try {
                  return mapMediaToDiscoverItem(media)
                } catch {
                  return null // one malformed item must never break the whole feed
                }
              })
              .filter(Boolean) as DiscoverItem[])
          ),
          pageInfo: json?.data?.Page?.pageInfo,
        }
      }

      let resolved = await requestPage(nextPage)
      let hops = 0

      while (!resolved.items.length && resolved.pageInfo?.hasNextPage && hops < DISCOVER_MAX_PAGE_HOPS) {
        hops += 1
        resolved = await requestPage(Number(resolved.pageInfo?.currentPage || nextPage) + 1)
      }

      if (!resolved.items.length && !append && Number(resolved.pageInfo?.currentPage || nextPage) !== 1) {
        resolved = await requestPage(1)
      }

      // Got a response — clear any error/backoff state.
      failuresRef.current = 0
      setFeedError(false)

      if (!append && focusIdRef.current) {
        const focusId = focusIdRef.current
        focusIdRef.current = null
        try {
          const mediaById = await fetchAniListMediaByIds([focusId])
          const focusItem = mapMediaToDiscoverItem(mediaById.get(focusId))
          if (focusItem) {
            resolved.items = [focusItem, ...resolved.items.filter((item) => item.id !== focusItem.id)]
          }
        } catch {
          /* focus is best-effort — feed still loads */
        }
      }

      if (resolved.items.length) {
        setDiscoverFeed((prev) => {
          if (!append) return resolved.items
          const seen = new Set(prev.map((item) => item.id))
          const merged = [...prev]
          resolved.items.forEach((item) => {
            if (seen.has(item.id)) return
            seen.add(item.id)
            merged.push(item)
          })
          return merged
        })
      } else if (!append) {
        setDiscoverFeed([])
      }

      setPage(Number(resolved.pageInfo?.currentPage || nextPage))
      setHasMore(Boolean(resolved.pageInfo?.hasNextPage))
    } catch (error) {
      // Circuit breaker: after repeated failures, stop auto-retrying so we don't
      // hammer the API (which is what causes the upstream 500s in the first place).
      failuresRef.current += 1
      setFeedError(true)
    } finally {
      loadMoreInFlightRef.current = false
      setLoadingMore(false)
    }
  }, [])

  const retryFeed = useCallback(() => {
    failuresRef.current = 0
    setFeedError(false)
    loadFeedPage(discoverFeed.length ? page + 1 : 1, discoverFeed.length > 0)
  }, [loadFeedPage, discoverFeed.length, page])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTrailerPlayerOpen || e.ctrlKey || e.metaKey || e.altKey || (e.target instanceof HTMLElement && e.target.closest("input,textarea,select,button,a,[contenteditable], [role=dialog]"))) return
      if (["ArrowDown","ArrowUp","j","k"].includes(e.key)) e.preventDefault()
      if (e.key === "ArrowDown" || e.key === "j") {
        if (currentIndex >= filteredFeed.length - 1) {
          if (hasMore && !loadingMore) {
            loadFeedPage(page + 1, true)
          }
        } else {
          goToNext()
        }
      }
      if (e.key === "ArrowUp" || e.key === "k") goToPrev()
      if (e.key === "l") currentAnime && toggleLike(currentAnime.id)
      if (e.key === "s") currentAnime && toggleSave(currentAnime.id)
      if (e.key === "m") toggleMute()
      if (e.key === "x") toggleSpoilerSafe()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentAnime, currentIndex, filteredFeed.length, goToNext, goToPrev, hasMore, loadFeedPage, loadingMore, page, toggleLike, toggleSave, isTrailerPlayerOpen])

  // Scroll/swipe handling
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let touchStartY = 0
    let lastScrollTime = 0

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const now = Date.now()
      if (now - lastScrollTime < 500) return
      lastScrollTime = now

      if (e.deltaY > 50) goToNext()
      else if (e.deltaY < -50) goToPrev()
    }

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndY = e.changedTouches[0].clientY
      const diff = touchStartY - touchEndY

      if (Math.abs(diff) > 50) {
        if (diff > 0) goToNext()
        else goToPrev()
      }
    }

    container.addEventListener("wheel", handleWheel, { passive: false })
    container.addEventListener("touchstart", handleTouchStart)
    container.addEventListener("touchend", handleTouchEnd)

    return () => {
      container.removeEventListener("wheel", handleWheel)
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchend", handleTouchEnd)
    }
  }, [goToNext, goToPrev])

  // Initial load — runs once, only after personalization is resolved, so the
  // first feed is already personalized and nothing reloads mid-trailer.
  useEffect(() => {
    if (!tasteResolved || feedLoadedRef.current) return
    feedLoadedRef.current = true
    loadFeedPage(1)
  }, [tasteResolved, loadFeedPage])

  // Safety net: never let Discover hang on the loader. If auth/taste hasn't
  // resolved within a few seconds, fall back to the generic feed.
  useEffect(() => {
    const timer = setTimeout(() => setTasteResolved(true), 4000)
    return () => clearTimeout(timer)
  }, [])

  // Build a taste profile from the user's list: top genres (to bias the feed)
  // and the ids they already track (to exclude). Then refresh "For You".
  useEffect(() => {
    let active = true
    if (authLoading) return // wait for auth to resolve before deciding
    if (!user) {
      personalGenresRef.current = []
      personalExcludeRef.current = []
      setSavedStatus({})
      setSaved({})
      setTasteResolved(true) // signed out → load the generic feed
      return
    }

    const loadTaste = async () => {
      // The whole thing is wrapped so the feed ALWAYS loads (tasteResolved)
      // even if a query/fetch throws — otherwise Discover gets stuck loading.
      try {
        const { data, error } = await client
          .from("list_entries")
          .select("media_id, status, score, media_type, updated_at")
          .eq("user_id", user.id)
        if (!active) return
        if (error || !data?.length) return

        // Reflect which titles are already tracked on the save buttons.
        const statusMap: Record<number, string> = {}
        const savedMap: Record<number, boolean> = {}
        data.forEach((entry: any) => {
          statusMap[entry.media_id] = entry.status
          savedMap[entry.media_id] = true
        })
        if (active) {
          setSavedStatus(statusMap)
          setSaved(savedMap)
        }

        // Build a rating-aware taste profile: weight each title's genres by how
        // the user engaged with it (status), how recently, and how they rated it.
        const animeEntries = data.filter((e: any) => (e.media_type || "ANIME") === "ANIME")
        personalExcludeRef.current = Array.from(new Set(data.map((e: any) => e.media_id)))

        const mediaById = await fetchAniListMediaByIds(animeEntries.map((e: any) => e.media_id).slice(0, 120))
        const STATUS_WEIGHT: Record<string, number> = {
          completed: 1.2,
          watching: 1,
          rewatching: 1.1,
          plan_to_watch: 0.4,
          on_hold: 0.3,
          dropped: 0.1,
        }
        const genreWeights = new Map<string, number>()
        animeEntries.forEach((entry: any) => {
          const media = mediaById.get(entry.media_id)
          if (!media?.genres?.length) return
          const sw = STATUS_WEIGHT[entry.status] ?? 0.6
          const days = entry.updated_at ? (Date.now() - new Date(entry.updated_at).getTime()) / 86400000 : 999
          const recency = Math.max(0.4, 1 - days / 180)
          const score = Number(entry.score) || 0
          const rating = score > 0 ? Math.max(-0.2, 1 + (score - 7) * 0.18) : 1
          const weight = sw * recency * rating
          media.genres.forEach((g: string) => genreWeights.set(g, (genreWeights.get(g) || 0) + weight))
        })
        const topGenres = Array.from(genreWeights.entries())
          .filter(([, w]) => w > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name)
        if (!active) return
        personalGenresRef.current = topGenres
      } catch {
        /* ignore — fall back to the generic feed */
      } finally {
        if (active) setTasteResolved(true) // now load the (personalized) feed
      }
    }

    loadTaste()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  useEffect(() => {
    if (feedError || !hasMore || loadingMore) return
    if (discoverFeed.length >= DISCOVER_MIN_BUFFER) return
    if (!discoverFeed.length && page !== 1) return
    loadFeedPage(page + 1, true)
  }, [discoverFeed.length, hasMore, loadingMore, page, loadFeedPage, feedError])

  useEffect(() => {
    if (feedError || !filteredFeed.length || !hasMore || loadingMore) return
    if (currentIndex >= filteredFeed.length - 6) {
      loadFeedPage(page + 1, true)
    }
  }, [currentIndex, filteredFeed.length, hasMore, loadingMore, page, loadFeedPage, feedError])

  useEffect(() => {
    if (!filteredFeed.length) return
    if (currentIndex >= filteredFeed.length) {
      setCurrentIndex(Math.max(filteredFeed.length - 1, 0))
    }
  }, [currentIndex, filteredFeed.length])

  useEffect(() => {
    setIsTrailerLoaded(false)
    setShowTrailerFrame(false)
    setIsTrailerPlayerOpen(false)
  }, [currentAnime?.id])

  useEffect(() => {
    if (spoilerSafe) return
    if (!isTrailerLoaded || !currentAnime?.trailerId) return
    const timeout = window.setTimeout(() => {
      setShowTrailerFrame(true)
    }, 700)
    return () => window.clearTimeout(timeout)
  }, [isTrailerLoaded, currentAnime?.trailerId, spoilerSafe])

  useEffect(() => {
    if (typeof window === "undefined") return
    const focusParam = Number(new URLSearchParams(window.location.search).get("focus"))
    if (Number.isFinite(focusParam) && focusParam > 0) {
      focusIdRef.current = focusParam
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const savedPreference = window.localStorage.getItem("hikari-discover-spoiler-safe")
    if (savedPreference === "1") {
      setSpoilerSafe(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("hikari-discover-spoiler-safe", spoilerSafe ? "1" : "0")
  }, [spoilerSafe])

  // YouTube embed URL with parameters
  const getYouTubeUrl = (trailerId: string) => {
    const params = new URLSearchParams({
      autoplay: "1",
      mute: isMuted ? "1" : "0",
      controls: "0",
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      loop: "1",
      playlist: trailerId,
      disablekb: "1",
      fs: "0",
      iv_load_policy: "3",
      cc_load_policy: "0",
    })
    return `https://www.youtube-nocookie.com/embed/${trailerId}?${params.toString()}`
  }

  const getControllableYouTubeUrl = (trailerId: string) => {
    const params = new URLSearchParams({
      autoplay: "1",
      mute: spoilerSafe ? "1" : isMuted ? "1" : "0",
      controls: "1",
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      disablekb: "0",
      fs: "1",
      iv_load_policy: "3",
      cc_load_policy: "0",
    })
    return `https://www.youtube-nocookie.com/embed/${trailerId}?${params.toString()}`
  }

  return <DiscoverScreen model={{user,hideRelatedTitles,hiddenTitles,hideTitle,restoreTitle,pendingSaveId,loadingMore,currentAnime,containerRef,spoilerSafe,showTrailerFrame,isMuted,getYouTubeUrl,setIsTrailerLoaded,activeVibe,setActiveVibe,setCurrentIndex,vibeFilters,saved,liked,ensureSignedIn,toggleSave,toggleLike,handleShare,setIsTrailerPlayerOpen,isTrailerPlayerOpen,toggleMute,toggleSpoilerSafe,currentIndex,filteredFeed,hasMore,goToPrev,goToNext,loadFeedPage,page,feedError,retryFeed,getControllableYouTubeUrl}} />
}
