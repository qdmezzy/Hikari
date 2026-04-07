"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Navigation } from "@/components/Navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, RefreshCw, ThumbsUp, ThumbsDown, Plus, Bot, Send, Sparkles, MessageSquare } from "lucide-react"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { cn } from "@/lib/utils"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { buildAiRecommendations, fetchTrendingCards } from "@/lib/ai-recommendations"
import {
  addUserNotInterestedMedia,
  fetchUserNotInterestedMedia,
  fetchUserTasteProfile,
  upsertUserTasteProfile,
} from "@/lib/recommendation-profile-store"

const clampWeight = (value, min = -25, max = 25) => Math.max(min, Math.min(max, value))

const normalizeToken = (value = "") =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")

const toLabel = (value = "") =>
  String(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const AI_RECS_TASTE_PREFIX = "hikari:ai-recs:taste:v1"
const AI_RECS_NOT_INTERESTED_PREFIX = "hikari:ai-recs:not-interested:v1"
const AI_RECS_SEED_PREFIX = "hikari:ai-recs:seed:v1"
const AI_CHAT_HISTORY_PREFIX = "hikari:ai-chat:history:v1"

const getTasteKey = (userId) => `${AI_RECS_TASTE_PREFIX}:${userId}`
const getNotInterestedKey = (userId) => `${AI_RECS_NOT_INTERESTED_PREFIX}:${userId}`
const getSeedKey = (userId) => `${AI_RECS_SEED_PREFIX}:${userId || "anon"}`
const getChatHistoryKey = (userId) => `${AI_CHAT_HISTORY_PREFIX}:${userId || "anon"}`

const chatPrompts = [
  "Like JJK but darker, no romance, short",
  "Chill slice of life, no gore",
  "Dark fantasy with strong fights",
]

const initialChatMessages = [
  {
    role: "assistant",
    content: "I can chat naturally and find anime for you. Tell me your mood, constraints, or what show vibe you want.",
  },
]

const defaultTaste = () => ({
  genreWeights: {},
  tagWeights: {},
  vibeWeights: {},
  formatWeights: {},
  updatedAt: Date.now(),
})

const readTaste = (userId) => {
  if (typeof window === "undefined" || !userId) return defaultTaste()
  const raw = window.localStorage.getItem(getTasteKey(userId))
  if (!raw) return defaultTaste()
  try {
    const parsed = JSON.parse(raw)
    return {
      ...defaultTaste(),
      ...parsed,
      genreWeights: parsed?.genreWeights && typeof parsed.genreWeights === "object" ? parsed.genreWeights : {},
      tagWeights: parsed?.tagWeights && typeof parsed.tagWeights === "object" ? parsed.tagWeights : {},
      vibeWeights: parsed?.vibeWeights && typeof parsed.vibeWeights === "object" ? parsed.vibeWeights : {},
      formatWeights: parsed?.formatWeights && typeof parsed.formatWeights === "object" ? parsed.formatWeights : {},
      updatedAt: typeof parsed?.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    }
  } catch {
    return defaultTaste()
  }
}

const writeTaste = (userId, profile) => {
  if (typeof window === "undefined" || !userId) return
  try {
    window.localStorage.setItem(getTasteKey(userId), JSON.stringify(profile))
  } catch {
    // ignore
  }
}

const readNotInterested = (userId) => {
  if (typeof window === "undefined" || !userId) return {}
  const raw = window.localStorage.getItem(getNotInterestedKey(userId))
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

const writeNotInterested = (userId, map) => {
  if (typeof window === "undefined" || !userId) return
  try {
    window.localStorage.setItem(getNotInterestedKey(userId), JSON.stringify(map))
  } catch {
    // ignore
  }
}

const getSessionSeed = (userId) => {
  if (typeof window === "undefined") return "server"
  const key = getSeedKey(userId)
  const existing = window.sessionStorage.getItem(key)
  if (existing) return existing
  const next = String(Date.now())
  window.sessionStorage.setItem(key, next)
  return next
}

export default function AIRecommendationsPage() {
  const { user } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [feedback, setFeedback] = useState({})
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [subtitle, setSubtitle] = useState("Trending right now")
  const [error, setError] = useState("")
  const [tasteProfile, setTasteProfile] = useState(null)
  const [notInterested, setNotInterested] = useState({})
  const [sessionSeed, setSessionSeed] = useState("init")
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState("")
  const [chatMessages, setChatMessages] = useState(initialChatMessages)
  const [chatResults, setChatResults] = useState([])
  const [listStatusSummary, setListStatusSummary] = useState({
    total_titles: 0,
    completed: 0,
    watching: 0,
    plan_to_watch: 0,
    dropped: 0,
    on_hold: 0,
  })
  const tasteSyncTimerRef = useRef(null)
  const tasteProfileRef = useRef(null)
  const excludeSetRef = useRef(new Set())
  const sessionSeedRef = useRef("init")
  const chatFeedRef = useRef(null)

  useEffect(() => {
    return () => {
      if (tasteSyncTimerRef.current) clearTimeout(tasteSyncTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setTasteProfile(null)
      setNotInterested({})
      setSessionSeed(getSessionSeed(null))
      return
    }

    let active = true
    const cachedTaste = readTaste(user.id)
    const cachedHidden = readNotInterested(user.id)
    setTasteProfile(cachedTaste)
    setNotInterested(cachedHidden)
    setSessionSeed(getSessionSeed(user.id))

    const loadRemote = async () => {
      const [tasteResult, remoteHidden] = await Promise.all([
        fetchUserTasteProfile(client, user.id),
        fetchUserNotInterestedMedia(client, user.id),
      ])
      if (!active) return

      const remoteTaste = tasteResult?.found ? tasteResult.profile : null
      const nextTaste = remoteTaste && remoteTaste.updatedAt >= cachedTaste?.updatedAt ? remoteTaste : cachedTaste
      setTasteProfile(nextTaste)
      writeTaste(user.id, nextTaste)

      const nextHidden = { ...(cachedHidden || {}) }
      ;(remoteHidden || []).forEach((mediaId) => {
        nextHidden[String(mediaId)] = true
      })
      setNotInterested(nextHidden)
      writeNotInterested(user.id, nextHidden)

      if (!tasteResult?.found) {
        await upsertUserTasteProfile(client, user.id, nextTaste)
      }
    }

    loadRemote()

    return () => {
      active = false
    }
  }, [user?.id])

  const excludeSet = useMemo(() => {
    const set = new Set()
    Object.keys(notInterested || {}).forEach((id) => {
      const parsed = Number(id)
      if (Number.isFinite(parsed)) set.add(parsed)
    })
    return set
  }, [notInterested])

  const tasteHighlights = useMemo(() => {
    const profile = tasteProfile || {}
    const topGenres = Object.entries(profile.genreWeights || {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 3)
      .map(([key]) => toLabel(normalizeToken(key)))
    const topTags = Object.entries(profile.tagWeights || {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 2)
      .map(([key]) => key)
    return [...topGenres, ...topTags].filter(Boolean).slice(0, 5)
  }, [tasteProfile])

  const chatContext = useMemo(
    () => ({
      top_genres: Object.entries(tasteProfile?.genreWeights || {})
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 5)
        .map(([key]) => toLabel(normalizeToken(key))),
      top_tags: Object.entries(tasteProfile?.tagWeights || {})
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 5)
        .map(([key]) => key),
      list_summary: listStatusSummary,
      not_interested_count: Object.keys(notInterested || {}).length,
      last_results: (chatResults || []).slice(0, 10).map((item) => ({
        title: item?.title || "",
        genres: Array.isArray(item?.genres) ? item.genres : [],
        tags: Array.isArray(item?.tags)
          ? item.tags.map((tag) => (typeof tag === "string" ? tag : tag?.name)).filter(Boolean)
          : [],
      })),
    }),
    [tasteProfile, listStatusSummary, notInterested, chatResults],
  )

  useEffect(() => {
    tasteProfileRef.current = tasteProfile
  }, [tasteProfile])

  useEffect(() => {
    excludeSetRef.current = excludeSet
  }, [excludeSet])

  useEffect(() => {
    sessionSeedRef.current = sessionSeed
  }, [sessionSeed])

  useEffect(() => {
    if (!chatFeedRef.current) return
    chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight
  }, [chatMessages.length])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(getChatHistoryKey(user?.id || null))
      if (!raw) {
        setChatMessages(initialChatMessages)
        return
      }
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const cleaned = parsed
        .filter((turn) => turn && typeof turn.content === "string")
        .map((turn) => ({
          role: turn.role === "assistant" ? "assistant" : "user",
          content: String(turn.content || "").trim(),
        }))
        .filter((turn) => turn.content.length > 0)
        .slice(-40)
      setChatMessages(cleaned.length ? cleaned : initialChatMessages)
    } catch {
      setChatMessages(initialChatMessages)
    }
  }, [user?.id])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const safe = (chatMessages || []).slice(-40)
      window.localStorage.setItem(getChatHistoryKey(user?.id || null), JSON.stringify(safe))
    } catch {
      // ignore
    }
  }, [chatMessages, user?.id])

  const scoreLocal = useCallback((item, profile) => {
    if (!item || !profile) return 0
    let score = 0
    ;(item.genres || []).forEach((genre) => {
      const key = normalizeToken(genre)
      score += (profile.genreWeights?.[key] || 0) * 1.0
    })
    ;(item.tags || []).forEach((tag) => {
      const name = tag?.name
      if (!name) return
      const rankFactor = (tag.rank || 50) / 100
      score += (profile.tagWeights?.[name] || 0) * 0.85 * rankFactor
    })
    if (item.format) {
      score += (profile.formatWeights?.[item.format] || 0) * 0.45
    }
    return score
  }, [])

  const applyTasteDelta = useCallback(
    (kind, item) => {
      if (!user?.id || !item) return
      const weight = {
        up: 1.4,
        down: -3.2,
        plan: 2.4,
      }[kind]
      if (!weight) return

      setTasteProfile((prev) => {
        const base = prev || readTaste(user.id)
        const next = {
          ...base,
          genreWeights: { ...(base.genreWeights || {}) },
          tagWeights: { ...(base.tagWeights || {}) },
          vibeWeights: { ...(base.vibeWeights || {}) },
          formatWeights: { ...(base.formatWeights || {}) },
          updatedAt: Date.now(),
        }

        ;(item.genres || []).forEach((genre) => {
          const key = normalizeToken(genre)
          if (!key) return
          next.genreWeights[key] = clampWeight((next.genreWeights[key] || 0) + weight * 0.85)
        })

        ;(item.tags || []).forEach((tag) => {
          const name = tag?.name
          if (!name) return
          const rankFactor = (tag.rank || 50) / 100
          next.tagWeights[name] = clampWeight((next.tagWeights[name] || 0) + weight * 0.65 * rankFactor)
        })

        if (item.format) {
          next.formatWeights[item.format] = clampWeight((next.formatWeights[item.format] || 0) + weight * 0.35)
        }

        writeTaste(user.id, next)

        if (tasteSyncTimerRef.current) clearTimeout(tasteSyncTimerRef.current)
        tasteSyncTimerRef.current = setTimeout(() => {
          upsertUserTasteProfile(client, user.id, next)
        }, 900)

        // Rerank current cards locally so feedback feels instant without extra AniList calls.
        setRecommendations((prev) => {
          if (!Array.isArray(prev) || prev.length < 2) return prev
          const ranked = [...prev].sort((a, b) => scoreLocal(b, next) - scoreLocal(a, next))
          return ranked
        })

        return next
      })
    },
    [user?.id, scoreLocal],
  )

  const handleFeedback = useCallback(
    async (item, type) => {
      if (!item) return

      setFeedback((prev) => ({
        ...prev,
        [item.id]: prev[item.id] === type ? null : type,
      }))

      if (!user?.id) return

      if (type === "up") {
        applyTasteDelta("up", item)
        return
      }

      if (type === "down") {
        applyTasteDelta("down", item)
        addUserNotInterestedMedia(client, user.id, item.id)
        setRecommendations((prev) => (Array.isArray(prev) ? prev.filter((row) => row?.id !== item.id) : prev))
        setNotInterested((prev) => {
          const next = { ...(prev || {}) }
          next[String(item.id)] = true
          writeNotInterested(user.id, next)
          return next
        })
        return
      }
    },
    [applyTasteDelta, user?.id],
  )

  const handlePlanToWatch = useCallback(
    async (item) => {
      if (!user?.id || !item?.id) return
      const { error } = await client.from("list_entries").upsert(
        {
          user_id: user.id,
          media_id: item.id,
          media_type: "ANIME",
          status: "plan_to_watch",
          progress: 0,
        },
        { onConflict: "user_id,media_id" },
      )

      if (error) {
        console.warn("Failed to add to plan:", error?.message || error)
        return
      }

      applyTasteDelta("plan", item)
      addUserNotInterestedMedia(client, user.id, item.id)
      setNotInterested((prev) => {
        // Exclude it from future AI picks too (since it's now on their list).
        const next = { ...(prev || {}) }
        next[String(item.id)] = true
        writeNotInterested(user.id, next)
        return next
      })
    },
    [applyTasteDelta, user?.id],
  )

  const sendChatPrompt = useCallback(
    async (promptText) => {
      const prompt = String(promptText || "").trim()
      if (!prompt) return

      setChatError("")
      setChatLoading(true)
      const historyForRequest = chatMessages.slice(-10).map((turn) => ({
        role: turn.role === "assistant" ? "assistant" : "user",
        content: String(turn.content || ""),
      }))
      setChatMessages((prev) => [...prev, { role: "user", content: prompt }])
      try {
        const { data: sessionData } = await client.auth.getSession()
        const accessToken = sessionData?.session?.access_token || null
        const res = await fetch("/api/ai/anime-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: prompt,
            history: historyForRequest,
            userId: user?.id || null,
            accessToken,
            context: chatContext,
          }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(json?.error || "AI search failed.")
        }

        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: json?.reply || "Here are some picks." },
        ])
        setChatResults(Array.isArray(json?.results) ? json.results : [])
      } catch (err) {
        setChatError(err?.message || "Could not fetch AI chat results.")
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I hit an error while fetching suggestions. Try again in a moment.",
          },
        ])
      } finally {
        setChatLoading(false)
      }
    },
    [chatMessages, chatContext, user?.id],
  )

  const handleChatSubmit = async (event) => {
    event.preventDefault()
    const text = chatInput
    setChatInput("")
    await sendChatPrompt(text)
  }

  const handleChatNotInterested = useCallback(
    async (item) => {
      if (!item?.id || !user?.id) return
      await addUserNotInterestedMedia(client, user.id, item.id)
      setNotInterested((prev) => {
        const next = { ...(prev || {}) }
        next[String(item.id)] = true
        writeNotInterested(user.id, next)
        return next
      })
      setChatResults((prev) => (Array.isArray(prev) ? prev.filter((row) => row?.id !== item.id) : prev))
    },
    [user?.id],
  )

  const loadRecommendations = useCallback(async ({ seedOverride = null, extraExcludeIds = [] } = {}) => {
    setLoading(true)
    setError("")

    try {
      if (!user) {
        const trending = await fetchTrendingCards({ limit: 12 })
        setRecommendations(trending)
        setSubtitle("Trending right now")
        return
      }

      const localExcludeSet = excludeSetRef.current || new Set()
      const localTaste = tasteProfileRef.current
      const localSeed = seedOverride || sessionSeedRef.current || "default"

      const { data, error } = await client
        .from("list_entries")
        .select("media_id, status, progress, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(2000)

      const listData = Array.isArray(data) ? data : []
      setListStatusSummary({
        total_titles: listData.length,
        completed: listData.filter((entry) => entry?.status === "completed").length,
        watching: listData.filter((entry) => entry?.status === "watching" || entry?.status === "rewatching").length,
        plan_to_watch: listData.filter((entry) => entry?.status === "plan_to_watch").length,
        dropped: listData.filter((entry) => entry?.status === "dropped").length,
        on_hold: listData.filter((entry) => entry?.status === "on_hold").length,
      })

      if (error || !data?.length) {
        const trending = await fetchTrendingCards({ excludeIds: localExcludeSet, limit: 12 })
        setRecommendations(trending)
        setSubtitle("Trending right now")
        return
      }

      const watchedIds = new Set(
        data.map((entry) => Number(entry.media_id)).filter(Number.isFinite),
      )

      localExcludeSet.forEach((id) => watchedIds.add(id))
      ;(extraExcludeIds || []).forEach((id) => {
        const parsed = Number(id)
        if (Number.isFinite(parsed)) watchedIds.add(parsed)
      })

      const aiResult = await buildAiRecommendations({
        listEntries: data,
        excludeIds: watchedIds,
        limit: 12,
        sessionSeed: localSeed,
        extraProfile: localTaste,
      })

      if (aiResult.items.length === 0) {
        const trending = await fetchTrendingCards({ excludeIds: watchedIds, limit: 12 })
        setRecommendations(trending)
        setSubtitle("Trending right now")
        return
      }

      setRecommendations(aiResult.items)
      setSubtitle(aiResult.subtitle)
    } catch (err) {
      setError(err.message || "Could not load recommendations.")
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setFeedback({})
    if (typeof window !== "undefined") {
      const nextSeed = String(Date.now())
      try {
        window.sessionStorage.setItem(getSeedKey(user?.id || null), nextSeed)
      } catch {
        // ignore
      }
      setSessionSeed(nextSeed)
      // Force the refresh to actually change by excluding the current cards.
      const currentIds = (recommendations || []).map((row) => row?.id).filter(Boolean)
      await loadRecommendations({ seedOverride: nextSeed, extraExcludeIds: currentIds })
    } else {
      await loadRecommendations({ seedOverride: String(Date.now()) })
    }
    setIsRefreshing(false)
  }

  useEffect(() => {
    if (!user?.id) return
    loadRecommendations()
  }, [user?.id])

  return (
    <div className="relative min-h-screen bg-background">
      <Navigation />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-120px] top-[80px] h-[280px] w-[280px] rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute right-[-140px] top-[220px] h-[320px] w-[320px] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <main className="pb-24 pt-20 md:pb-8">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Card className="overflow-hidden border-border/60 bg-card/55 backdrop-blur-xl">
            <CardContent className="relative p-6 md:p-8">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-violet-500/10 via-transparent to-cyan-500/5" />
              <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-2xl bg-violet-500/60 blur-lg" />
                      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600">
                        <Brain className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div>
                      <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
                        AI Picks
                        <Badge className="border-violet-500/30 bg-violet-500/20 text-violet-300">Beta</Badge>
                      </h1>
                      <p className="text-sm text-muted-foreground">{subtitle}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="gap-1 border-border/60 bg-secondary/40">
                      <Sparkles className="h-3.5 w-3.5" />
                      {recommendations.length} picks loaded
                    </Badge>
                    <Badge variant="secondary" className="gap-1 border-border/60 bg-secondary/40">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {chatResults.length} chat results
                    </Badge>
                    {tasteHighlights.map((item) => (
                      <Badge key={item} variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    className="gap-2 rounded-xl border-border/70 bg-background/40 hover:bg-background/60"
                    onClick={handleRefresh}
                  >
                    <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                    Refresh Picks
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-lg font-semibold text-foreground">For You Right Now</h2>
                <p className="text-xs text-muted-foreground">Thumbs up/down trains your next batch</p>
              </div>
              {loading ? (
                <Card className="border-border/60 bg-card/45">
                  <CardContent className="py-16 text-center text-muted-foreground">Loading recommendations...</CardContent>
                </Card>
              ) : error ? (
                <Card className="border-border/60 bg-card/45">
                  <CardContent className="py-16 text-center text-rose-300">{error}</CardContent>
                </Card>
              ) : recommendations.length === 0 ? (
                <Card className="border-border/60 bg-card/45">
                  <CardContent className="py-16 text-center text-muted-foreground">No recommendations yet.</CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {recommendations.map((item) => (
                    <Card
                      key={item.id}
                      className="group overflow-hidden border-border/60 bg-gradient-to-b from-card to-card/30 transition-all hover:-translate-y-0.5 hover:border-violet-400/40"
                    >
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <Link href={`/media/${item.id}`} className="relative shrink-0 overflow-hidden rounded-xl">
                            <img
                              src={item.image || "/placeholder.svg"}
                              alt={item.title}
                              className="h-28 w-20 object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            {item.score ? (
                              <Badge className="absolute right-1 top-1 border-emerald-500/40 bg-emerald-500/80 text-white">
                                {item.score.toFixed(1)}
                              </Badge>
                            ) : null}
                          </Link>
                          <div className="min-w-0 flex-1">
                            <Link href={`/media/${item.id}`}>
                              <h3 className="truncate font-semibold text-foreground group-hover:text-violet-200">{item.title}</h3>
                            </Link>
                            <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{item.reason}</p>

                            {(item.matchedGenres?.length || item.matchedTags?.length) && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {(item.matchedGenres || []).slice(0, 2).map((tag) => (
                                  <Badge key={tag} variant="secondary" className="border-border/60 bg-secondary/40 text-[10px]">
                                    {tag}
                                  </Badge>
                                ))}
                                {(item.matchedTags || []).slice(0, 2).map((tag) => (
                                  <Badge key={tag} variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-200">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 flex items-center gap-1.5">
                              <Link href={`/media/${item.id}`}>
                                <Button size="sm" variant="secondary" className="h-8 rounded-lg px-2.5">
                                  Open
                                </Button>
                              </Link>
                              {user ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-lg"
                                  onClick={() => handlePlanToWatch(item)}
                                  title="Add to plan to watch"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              ) : null}
                              <Button
                                size="icon"
                                variant="ghost"
                                className={cn("h-8 w-8 rounded-lg", feedback[item.id] === "up" && "bg-emerald-500/15 text-emerald-300")}
                                onClick={() => handleFeedback(item, "up")}
                                title="Like this pick"
                              >
                                <ThumbsUp className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className={cn("h-8 w-8 rounded-lg", feedback[item.id] === "down" && "bg-rose-500/15 text-rose-300")}
                                onClick={() => handleFeedback(item, "down")}
                                title="Not for me"
                              >
                                <ThumbsDown className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <aside className="lg:sticky lg:top-24 lg:h-fit">
              <Card className="border-violet-500/30 bg-slate-900/85 backdrop-blur-xl shadow-[0_0_40px_-20px_rgba(139,92,246,0.6)]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      AI Chat
                      <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300">Beta</Badge>
                    </CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 rounded-lg px-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
                      onClick={() => {
                        setChatMessages(initialChatMessages)
                        setChatResults([])
                        setChatError("")
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {chatPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        className="rounded-full border border-violet-400/35 bg-violet-500/15 px-3 py-1.5 text-xs text-violet-100 transition-colors hover:bg-violet-500/25"
                        onClick={() => sendChatPrompt(prompt)}
                        disabled={chatLoading}
                        type="button"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleChatSubmit} className="flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Describe what you want to watch..."
                      className="rounded-xl border-violet-500/30 bg-slate-950/70 text-slate-100 placeholder:text-slate-400"
                      disabled={chatLoading}
                    />
                    <Button
                      type="submit"
                      className="gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white hover:opacity-90"
                      disabled={chatLoading}
                    >
                      <Send className={cn("h-4 w-4", chatLoading && "animate-pulse")} />
                      Ask
                    </Button>
                  </form>

                  <div
                    ref={chatFeedRef}
                    className="max-h-60 space-y-2 overflow-y-auto rounded-xl border border-violet-500/25 bg-slate-950/70 p-3"
                  >
                    {chatMessages.map((turn, idx) => (
                      <div
                        key={`${turn.role}-${idx}`}
                        className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                            turn.role === "user"
                              ? "bg-violet-500/25 text-violet-50 border border-violet-400/30"
                              : "bg-white/10 text-slate-100 border border-white/15",
                          )}
                        >
                          {turn.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading ? (
                      <div className="text-xs text-slate-300/80">Thinking...</div>
                    ) : null}
                  </div>

                  {chatError ? <p className="text-sm text-rose-300">{chatError}</p> : null}

                  {chatResults.length > 0 ? (
                    <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                      {chatResults.map((item) => (
                        <Card key={item.id} className="border-violet-500/20 bg-slate-900/70 transition-colors hover:border-violet-400/40">
                          <CardContent className="flex gap-3 p-3">
                            <Link href={`/media/${item.id}`}>
                              <img
                                src={item.image || "/placeholder.svg"}
                                alt={item.title}
                                className="h-20 w-14 rounded-lg object-cover"
                              />
                            </Link>
                            <div className="min-w-0 flex-1">
                              <Link href={`/media/${item.id}`}>
                                <p className="truncate text-sm font-semibold text-slate-100">{item.title}</p>
                              </Link>
                              {item.reason ? (
                                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{item.reason}</p>
                              ) : null}
                              <div className="mt-2 flex items-center gap-1.5">
                                <Link href={`/media/${item.id}`}>
                                  <Button size="sm" variant="secondary" className="h-7 rounded-lg px-2.5">
                                    Open
                                  </Button>
                                </Link>
                                {user ? (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 rounded-lg"
                                      onClick={() => handlePlanToWatch(item)}
                                      title="Add to plan to watch"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 rounded-lg text-rose-300"
                                      onClick={() => handleChatNotInterested(item)}
                                      title="Not interested"
                                    >
                                      <ThumbsDown className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-violet-500/25 bg-slate-950/70 px-4 py-6 text-center text-sm text-slate-300">
                      Ask for a vibe and AI Chat will return picks here.
                    </div>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
