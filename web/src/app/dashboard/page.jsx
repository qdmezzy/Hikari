"use client"

import { useEffect, useMemo, useState } from "react"
import { Navigation } from "@/components/Navigation"
import RequireAuth from "@/components/RequireAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Clock,
  Trophy,
  Flame,
  TrendingUp,
  Plus,
  Play,
  BookOpen,
  Brain,
  Calendar,
  Star,
  ChevronRight,
  Sparkles,
  Zap,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"

const MEDIA_BY_IDS = `
query ($ids: [Int], $perPage: Int) {
  Page(perPage: $perPage) {
    media(id_in: $ids, sort: POPULARITY_DESC) {
      id
      type
      title { romaji english }
      coverImage { large }
      episodes
      nextAiringEpisode { episode }
      chapters
      averageScore
      status
      genres
    }
  }
}
`

const chunkIds = (ids, size) => {
  const batches = []
  for (let i = 0; i < ids.length; i += size) {
    batches.push(ids.slice(i, i + size))
  }
  return batches
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("watching")
  const [entries, setEntries] = useState([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [entriesError, setEntriesError] = useState(null)
  const [pendingId, setPendingId] = useState(null)
  const { user } = useAuth()
  const displayName = user?.user_metadata?.display_name || user?.email || 'User'

  useEffect(() => {
    let isActive = true

    const loadEntries = async () => {
      if (!user) {
        setEntries([])
        setLoadingEntries(false)
        return
      }

      setLoadingEntries(true)
      setEntriesError(null)

      const { data, error } = await client
        .from("list_entries")
        .select("id, media_id, status, progress, media_type, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (!isActive) return

      if (error) {
        console.error("Failed to load list entries:", error)
        setEntriesError("Could not load your list yet.")
        setEntries([])
        setLoadingEntries(false)
        return
      }

      if (!data || data.length === 0) {
        setEntries([])
        setLoadingEntries(false)
        return
      }

      const mediaIds = Array.from(new Set(data.map((entry) => entry.media_id).filter(Boolean)))

      try {
        const mediaById = new Map()
        const batches = chunkIds(mediaIds, 50)

        for (const batch of batches) {
          const res = await fetch("/api/anilist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: MEDIA_BY_IDS,
              variables: { ids: batch, perPage: batch.length },
            }),
          })

          const json = await res.json()

          if (!res.ok || json?.errors) {
            throw new Error(json?.errors?.[0]?.message || "Failed to load AniList data")
          }

          const mediaList = json?.data?.Page?.media ?? []
          mediaList.forEach((media) => {
            mediaById.set(media.id, media)
          })
        }

        const enriched = data.map((entry) => ({
          ...entry,
          media: mediaById.get(entry.media_id),
        }))

        if (isActive) {
          setEntries(enriched)
          setLoadingEntries(false)
        }
      } catch (err) {
        console.error("Failed to hydrate media details:", err)
        if (isActive) {
          setEntries(data.map((entry) => ({ ...entry, media: null })))
          setEntriesError("Some details could not load.")
          setLoadingEntries(false)
        }
      }
    }

    loadEntries()

    return () => {
      isActive = false
    }
  }, [user])

  const updateEntry = async (entry, updates) => {
    if (!entry) return
    const previous = entry
    const updatedAt = new Date().toISOString()
    const optimisticUpdates = { ...updates, updated_at: updatedAt }
    setPendingId(entry.id)
    setEntries((prev) =>
      prev.map((item) => (item.id === entry.id ? { ...item, ...optimisticUpdates } : item)),
    )

    const { error } = await client
      .from("list_entries")
      .update(updates)
      .eq("id", entry.id)

    if (error) {
      console.error("Failed to update entry:", error)
      setEntries((prev) => prev.map((item) => (item.id === entry.id ? previous : item)))
    }

    setPendingId(null)
  }

  const handleIncrement = async (entry) => {
    const episodes = entry?.media?.episodes ?? null
    const currentProgress = entry?.progress ?? 0
    const nextProgress = episodes ? Math.min(currentProgress + 1, episodes) : currentProgress + 1
    const nextStatus = episodes && nextProgress >= episodes ? "completed" : entry.status

    await updateEntry(entry, { progress: nextProgress, status: nextStatus })
  }

  const handleMoveToWatching = async (entry) => {
    await updateEntry(entry, { status: "watching", progress: entry.progress ?? 0 })
  }

  const handleRewatch = async (entry) => {
    await updateEntry(entry, { status: "rewatching", progress: 0 })
  }

  const statusLabels = {
    watching: "Watching",
    completed: "Completed",
    rewatching: "Rewatching",
    on_hold: "On Hold",
    dropped: "Dropped",
    plan_to_watch: "Planned",
  }

  const streakDays = useMemo(() => {
    const dateKeys = new Set()
    entries.forEach((entry) => {
      if (!entry?.updated_at) return
      const date = new Date(entry.updated_at)
      if (Number.isNaN(date.getTime())) return
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")}`
      dateKeys.add(key)
    })

    let streak = 0
    let cursor = new Date()
    while (true) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(
        cursor.getDate(),
      ).padStart(2, "0")}`
      if (!dateKeys.has(key)) break
      streak += 1
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1)
    }

    return streak
  }, [entries])

  const topGenres = useMemo(() => {
    const counts = new Map()
    entries.forEach((entry) => {
      const genres = entry?.media?.genres || []
      genres.forEach((genre) => {
        counts.set(genre, (counts.get(genre) || 0) + 1)
      })
    })
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [entries])

  const sortedEntries = useMemo(() => {
    return [...entries].sort(
      (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime(),
    )
  }, [entries])

  const watchingEntries = useMemo(
    () => sortedEntries.filter((entry) => ["watching", "rewatching", "on_hold"].includes(entry.status)),
    [sortedEntries],
  )
  const completedEntries = useMemo(
    () => sortedEntries.filter((entry) => entry.status === "completed"),
    [sortedEntries],
  )
  const plannedEntries = useMemo(
    () => sortedEntries.filter((entry) => entry.status === "plan_to_watch"),
    [sortedEntries],
  )

  const stats = useMemo(() => {
    const totalEpisodes = entries.reduce(
      (sum, entry) => sum + (entry.media_type === "ANIME" ? entry.progress || 0 : 0),
      0,
    )
    const timeWatchedHours = Math.round((totalEpisodes * 24) / 60)

    return [
      {
        label: "Time Watched",
        value: `${timeWatchedHours}h`,
        icon: Clock,
        change: totalEpisodes ? `${totalEpisodes} eps logged` : "No data yet",
        color: "from-blue-500 to-cyan-500",
      },
      {
        label: "Completed",
        value: `${completedEntries.length}`,
        icon: Trophy,
        change: completedEntries.length ? "Nice work" : "No completions yet",
        color: "from-amber-500 to-orange-500",
      },
      {
        label: "Day Streak",
        value: `${streakDays}`,
        icon: Flame,
        change: streakDays ? "Keep it going" : "No streak data",
        color: "from-red-500 to-pink-500",
      },
      {
        label: "Episodes",
        value: `${totalEpisodes}`,
        icon: TrendingUp,
        change: totalEpisodes ? "Keep it going" : "No episodes yet",
        color: "from-emerald-500 to-teal-500",
      },
    ]
  }, [entries, completedEntries.length, streakDays])

  const recentActivity = useMemo(() => {
    const sorted = [...entries].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    return sorted.slice(0, 4).map((entry) => {
      const title = entry?.media?.title?.english || entry?.media?.title?.romaji || "Unknown title"
      const progress = entry.progress ?? 0
      const action = progress > 0 ? `Updated progress to ep ${progress}` : `Moved to ${statusLabels[entry.status] || "list"}`

      return {
        title,
        action,
        time: entry.updated_at ? new Date(entry.updated_at).toLocaleDateString() : "Just now",
        icon: progress > 0 ? Play : Plus,
      }
    })
  }, [entries])

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background noise-overlay">
        <Navigation />

      <main className="pb-24 pt-24 md:pb-8">
        <div className="px-4 py-8 md:px-8">
          <div className="mx-auto max-w-6xl">
            {/* Header */}
            <div
              className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
              style={{ animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
            >
              <div>
                <h1 className="text-2xl font-bold text-foreground md:text-3xl">
                  Welcome back, <span className="text-gradient">{displayName}</span>
                </h1>
                <p className="text-muted-foreground">Continue where you left off</p>
              </div>
              <Link href="/ai-recommendations">
                <Button
                  className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:opacity-90 transition-all duration-500"
                  style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                >
                  <Brain className="h-4 w-4" />
                  AI Picks
                </Button>
              </Link>
            </div>

            {/* Stats Grid */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {loadingEntries
                ? Array.from({ length: 4 }).map((_, index) => (
                    <Card
                      key={`stat-skeleton-${index}`}
                      className="bg-card/50 border-border/50 overflow-hidden animate-pulse"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="h-10 w-10 rounded-xl bg-muted/30" />
                          <div className="h-5 w-16 rounded-full bg-muted/30" />
                        </div>
                        <div className="h-6 w-20 rounded-lg bg-muted/30 mb-2" />
                        <div className="h-4 w-24 rounded-lg bg-muted/20" />
                      </CardContent>
                    </Card>
                  ))
                : stats.map((stat, index) => {
                    const Icon = stat.icon
                    return (
                      <Card
                        key={stat.label}
                        className="bg-card/50 border-border/50 overflow-hidden"
                        style={{
                          animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                          animationDelay: `${index * 80}ms`,
                          opacity: 0,
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div
                              className={cn(
                                "h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center transition-transform duration-500 hover:scale-110 hover:rotate-3",
                                stat.color,
                              )}
                              style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                            >
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <Badge variant="secondary" className="text-[10px]">
                              {stat.change}
                            </Badge>
                          </div>
                          <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                          <p className="text-sm text-muted-foreground">{stat.label}</p>
                        </CardContent>
                      </Card>
                    )
                  })}
            </div>

            {/* Main Content */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Currently Watching */}
              <div className="lg:col-span-2">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="mb-4 flex items-center justify-between">
                    <TabsList className="bg-secondary/50">
                      <TabsTrigger
                        value="watching"
                        className="gap-2 transition-all duration-500"
                        style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                      >
                        <Play className="h-4 w-4" />
                        Watching
                      </TabsTrigger>
                      <TabsTrigger
                        value="completed"
                        className="gap-2 transition-all duration-500"
                        style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                      >
                        <Trophy className="h-4 w-4" />
                        Completed
                      </TabsTrigger>
                      <TabsTrigger
                        value="planned"
                        className="gap-2 transition-all duration-500"
                        style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                      >
                        <Calendar className="h-4 w-4" />
                        Planned
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="watching" className="mt-0">
                    {loadingEntries ? (
                      <Card className="bg-card/50 border-border/50">
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <Play className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <p>Loading your list...</p>
                        </CardContent>
                      </Card>
                    ) : entriesError ? (
                      <Card className="bg-card/50 border-border/50">
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <Play className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <p>{entriesError}</p>
                        </CardContent>
                      </Card>
                    ) : watchingEntries.length === 0 ? (
                      <Card className="bg-card/50 border-border/50">
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <Play className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <p>Your watching list is empty</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {watchingEntries.map((entry, index) => {
                          const title = entry?.media?.title?.english || entry?.media?.title?.romaji || "Unknown title"
                          const coverImage = entry?.media?.coverImage?.large || "/placeholder.svg"
                          const isManga = entry?.media_type === "MANGA"
                          const totalUnits = isManga
                            ? entry?.media?.chapters ?? null
                            : entry?.media?.episodes ??
                              (entry?.media?.nextAiringEpisode?.episode
                                ? Math.max(entry.media.nextAiringEpisode.episode - 1, 0)
                                : null)
                          const progress = entry?.progress ?? 0
                          const progressTotal = totalUnits ?? (progress > 0 ? progress + 12 : null)
                          const progressPercent = progressTotal
                            ? Math.min((progress / progressTotal) * 100, 100)
                            : 0
                          const rating = entry?.media?.averageScore
                            ? (entry.media.averageScore / 10).toFixed(1)
                            : null
                          const unitLabel = isManga ? "Chapter" : "Episode"
                          const unitShort = isManga ? "Ch" : "Ep"
                          const nextLabel = totalUnits
                            ? progress >= totalUnits
                              ? "Completed"
                              : `Next: ${unitShort} ${progress + 1}`
                            : statusLabels[entry.status] || "In progress"

                          return (
                            <Card
                              key={entry.id}
                              className="bg-card/50 border-border/50 overflow-hidden group"
                              style={{
                                animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                                animationDelay: `${index * 80}ms`,
                                opacity: 0,
                              }}
                            >
                              <CardContent className="flex items-center gap-4 p-4">
                                <Link href={`/media/${entry.media_id}`} className="relative">
                                  <img
                                    src={coverImage}
                                    alt={title}
                                    className="h-24 w-16 rounded-lg object-cover transition-transform duration-500 group-hover:scale-105"
                                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                                  />
                                  <div
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-lg"
                                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                                  >
                                    <Play className="h-6 w-6 text-white" fill="white" />
                                  </div>
                                </Link>

                                <div className="flex-1 min-w-0">
                                  <Link href={`/media/${entry.media_id}`}>
                                    <h3
                                      className="font-semibold text-foreground group-hover:text-primary transition-colors duration-500 truncate"
                                      style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                                    >
                                      {title}
                                    </h3>
                                  </Link>
                                  <p className="text-sm text-muted-foreground">
                                    {totalUnits ? `${unitLabel} ${progress} of ${totalUnits}` : `Progress ${progress}`}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {rating ? (
                                      <div className="flex items-center gap-1">
                                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                        <span className="text-xs text-muted-foreground">{rating}</span>
                                      </div>
                                    ) : null}
                                    <Badge variant="secondary" className="text-[10px]">
                                      {isManga ? "Manga" : "Anime"}
                                    </Badge>
                                    <span className="text-xs text-primary">{nextLabel}</span>
                                  </div>
                                  <Progress value={progressPercent} className="mt-2 h-1.5" />
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    disabled={pendingId === entry.id}
                                    onClick={() => handleIncrement(entry)}
                                    className="gap-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-500"
                                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                                  >
                                    {isManga ? (
                                      <BookOpen className="h-3 w-3" />
                                    ) : (
                                      <Play className="h-3 w-3" fill="white" />
                                    )}
                                    +1
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="completed">
                    {loadingEntries ? (
                      <Card className="bg-card/50 border-border/50">
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <p>Loading your list...</p>
                        </CardContent>
                      </Card>
                    ) : entriesError ? (
                      <Card className="bg-card/50 border-border/50">
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <p>{entriesError}</p>
                        </CardContent>
                      </Card>
                    ) : completedEntries.length === 0 ? (
                      <Card className="bg-card/50 border-border/50">
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <p>Your completed anime will appear here</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {completedEntries.map((entry, index) => {
                          const title = entry?.media?.title?.english || entry?.media?.title?.romaji || "Unknown title"
                          const coverImage = entry?.media?.coverImage?.large || "/placeholder.svg"
                          const rating = entry?.media?.averageScore
                            ? (entry.media.averageScore / 10).toFixed(1)
                            : null

                          return (
                            <Card
                              key={entry.id}
                              className="bg-card/50 border-border/50 overflow-hidden group"
                              style={{
                                animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                                animationDelay: `${index * 80}ms`,
                                opacity: 0,
                              }}
                            >
                              <CardContent className="flex items-center gap-4 p-4">
                                <Link href={`/media/${entry.media_id}`} className="relative">
                                  <img
                                    src={coverImage}
                                    alt={title}
                                    className="h-20 w-14 rounded-lg object-cover transition-transform duration-500 group-hover:scale-105"
                                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                                  />
                                </Link>
                                <div className="flex-1 min-w-0">
                                  <Link href={`/media/${entry.media_id}`}>
                                    <h3 className="font-semibold text-foreground truncate">{title}</h3>
                                  </Link>
                                  <p className="text-sm text-muted-foreground">Completed</p>
                                  {rating ? (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                      <span className="text-xs text-muted-foreground">{rating}</span>
                                    </div>
                                  ) : null}
                                </div>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={pendingId === entry.id}
                                  onClick={() => handleRewatch(entry)}
                                >
                                  Rewatch
                                </Button>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="planned">
                    {loadingEntries ? (
                      <Card className="bg-card/50 border-border/50">
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <p>Loading your list...</p>
                        </CardContent>
                      </Card>
                    ) : entriesError ? (
                      <Card className="bg-card/50 border-border/50">
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <p>{entriesError}</p>
                        </CardContent>
                      </Card>
                    ) : plannedEntries.length === 0 ? (
                      <Card className="bg-card/50 border-border/50">
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <p>Your plan to watch list will appear here</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {plannedEntries.map((entry, index) => {
                          const title = entry?.media?.title?.english || entry?.media?.title?.romaji || "Unknown title"
                          const coverImage = entry?.media?.coverImage?.large || "/placeholder.svg"

                          return (
                            <Card
                              key={entry.id}
                              className="bg-card/50 border-border/50 overflow-hidden group"
                              style={{
                                animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                                animationDelay: `${index * 80}ms`,
                                opacity: 0,
                              }}
                            >
                              <CardContent className="flex items-center gap-4 p-4">
                                <Link href={`/media/${entry.media_id}`} className="relative">
                                  <img
                                    src={coverImage}
                                    alt={title}
                                    className="h-20 w-14 rounded-lg object-cover transition-transform duration-500 group-hover:scale-105"
                                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                                  />
                                </Link>
                                <div className="flex-1 min-w-0">
                                  <Link href={`/media/${entry.media_id}`}>
                                    <h3 className="font-semibold text-foreground truncate">{title}</h3>
                                  </Link>
                                  <p className="text-sm text-muted-foreground">Plan to watch</p>
                                </div>
                                <Button
                                  size="sm"
                                  className="gap-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-500"
                                  style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                                  disabled={pendingId === entry.id}
                                  onClick={() => handleMoveToWatching(entry)}
                                >
                                  <Play className="h-3 w-3" fill="white" />
                                  Start
                                </Button>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                {/* AI Recommendations */}
                <Card
                  className="mt-6 bg-card/50 border-border/50 overflow-hidden"
                  style={{
                    animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                    animationDelay: "400ms",
                    opacity: 0,
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                          <Brain className="h-4 w-4 text-white" />
                        </div>
                        AI Picks for You
                      </CardTitle>
                      <Link href="/ai-recommendations">
                        <Button variant="ghost" size="sm" className="gap-1 group">
                          See all{" "}
                          <ChevronRight
                            className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-500"
                            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                          />
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p>Recommendations will appear after you add a few shows.</p>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Recent Activity */}
                <Card
                  className="bg-card/50 border-border/50"
                  style={{
                    animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                    animationDelay: "200ms",
                    opacity: 0,
                  }}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loadingEntries ? (
                      <p className="text-sm text-muted-foreground">Loading activity...</p>
                    ) : recentActivity.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recent activity yet.</p>
                    ) : (
                      recentActivity.map((activity, i) => {
                        const Icon = activity.icon
                        return (
                          <div
                            key={i}
                            className="flex items-start gap-3 group"
                            style={{
                              animation: "fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                              animationDelay: `${300 + i * 60}ms`,
                              opacity: 0,
                            }}
                          >
                            <div
                              className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors duration-500"
                              style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                            >
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
                              <p className="text-xs text-muted-foreground">{activity.action}</p>
                              <p className="text-xs text-muted-foreground/70">{activity.time}</p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>

                {/* Top Genres */}
                <Card
                  className="bg-card/50 border-border/50"
                  style={{
                    animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                    animationDelay: "300ms",
                    opacity: 0,
                  }}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Top Genres</CardTitle>
                  </CardHeader>
                  <CardContent className="py-6">
                    {topGenres.length ? (
                      <div className="flex flex-wrap gap-2">
                        {topGenres.map((genre) => (
                          <Badge key={genre.name} variant="secondary">
                            {genre.name} {genre.count}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Your top genres will show up once you track more.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Social */}
                <Card
                  className="bg-card/50 border-border/50"
                  style={{
                    animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                    animationDelay: "350ms",
                    opacity: 0,
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Social</h3>
                        <p className="text-xs text-muted-foreground">See what friends are watching</p>
                      </div>
                    </div>
                    <Link href="/social">
                      <Button variant="secondary" className="w-full">
                        Open Social
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Premium CTA */}
                <Card
                  className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/30"
                  style={{
                    animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                    animationDelay: "400ms",
                    opacity: 0,
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                        <Zap className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Go Premium</h3>
                        <p className="text-xs text-muted-foreground">Auto-track your progress</p>
                      </div>
                    </div>
                    <Link href="/premium">
                      <Button
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 text-white transition-all duration-500"
                        style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                      >
                        Upgrade Now
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
      </div>
    </RequireAuth>
  )
}
