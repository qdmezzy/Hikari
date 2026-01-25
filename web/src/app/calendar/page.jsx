"use client"

import { useEffect, useMemo, useState } from "react"
import { Navigation } from "@/components/Navigation"
import RequireAuth from "@/components/RequireAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Bell, BellOff, Clock, Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState("")
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [viewMode, setViewMode] = useState("calendar")
  const [statusFilters, setStatusFilters] = useState(["watching", "rewatching", "on_hold"])
  const [notifyIds, setNotifyIds] = useState([])
  const [schedule, setSchedule] = useState([])
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [scheduleError, setScheduleError] = useState("")
  const { user, loading } = useAuth()
  const notifySet = useMemo(() => new Set(notifyIds), [notifyIds])

  const STATUS_OPTIONS = [
    { id: "watching", label: "Watching" },
    { id: "rewatching", label: "Rewatching" },
    { id: "on_hold", label: "On Hold" },
    { id: "completed", label: "Completed" },
    { id: "plan_to_watch", label: "Planned" },
    { id: "dropped", label: "Dropped" },
  ]

  const AIRING_QUERY = `
  query ($ids: [Int], $perPage: Int) {
    Page(perPage: $perPage) {
      media(id_in: $ids, type: ANIME) {
        id
        title { romaji english }
        coverImage { large }
        episodes
        nextAiringEpisode { airingAt timeUntilAiring episode }
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

  useEffect(() => {
    if (!loading && !user) {
      setSchedule([])
      setLoadingSchedule(false)
    }
  }, [loading, user])

  useEffect(() => {
    if (!user || typeof window === "undefined") return
    const storedFilters = window.localStorage.getItem(`hikari-calendar-statuses-${user.id}`)
    const storedNotify = window.localStorage.getItem(`hikari-calendar-notify-${user.id}`)

    if (storedFilters) {
      try {
        const parsed = JSON.parse(storedFilters)
        if (Array.isArray(parsed) && parsed.length) {
          setStatusFilters(parsed)
        }
      } catch {}
    }

    if (storedNotify) {
      try {
        const parsed = JSON.parse(storedNotify)
        if (Array.isArray(parsed)) {
          setNotifyIds(parsed)
        }
      } catch {}
    }
  }, [user])

  useEffect(() => {
    if (!user || typeof window === "undefined") return
    window.localStorage.setItem(
      `hikari-calendar-statuses-${user.id}`,
      JSON.stringify(statusFilters),
    )
  }, [statusFilters, user])

  useEffect(() => {
    if (!user || typeof window === "undefined") return
    window.localStorage.setItem(
      `hikari-calendar-notify-${user.id}`,
      JSON.stringify(notifyIds),
    )
  }, [notifyIds, user])

  useEffect(() => {
    let isActive = true

    const loadSchedule = async () => {
      if (!user) return

      setLoadingSchedule(true)
      setScheduleError("")

      if (!statusFilters.length) {
        setSchedule([])
        setLoadingSchedule(false)
        return
      }

      const { data, error } = await client
        .from("list_entries")
        .select("media_id, status, media_type")
        .eq("user_id", user.id)
        .eq("media_type", "ANIME")
        .in("status", statusFilters)

      if (!isActive) return

      if (error) {
        console.error("Failed to load list entries:", error)
        setScheduleError("Could not load your calendar.")
        setLoadingSchedule(false)
        return
      }

      if (!data || data.length === 0) {
        setSchedule([])
        setLoadingSchedule(false)
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
              query: AIRING_QUERY,
              variables: { ids: batch, perPage: batch.length },
            }),
          })

          const json = await res.json()
          if (!res.ok || json?.errors) {
            throw new Error(json?.errors?.[0]?.message || "Failed to load airing schedule.")
          }

          const mediaList = json?.data?.Page?.media ?? []
          mediaList.forEach((media) => {
            mediaById.set(media.id, media)
          })
        }

        const upcoming = mediaIds
          .map((id) => mediaById.get(id))
          .filter((media) => media?.nextAiringEpisode)
          .map((media) => ({
            id: media.id,
            title: media.title?.english || media.title?.romaji || "Untitled",
            cover: media.coverImage?.large,
            episode: media.nextAiringEpisode.episode,
            airingAt: media.nextAiringEpisode.airingAt,
            timeUntilAiring: media.nextAiringEpisode.timeUntilAiring,
            totalEpisodes: media.episodes,
          }))
          .sort((a, b) => a.airingAt - b.airingAt)

        if (isActive) {
          setSchedule(upcoming)
          const nextDate = upcoming[0]?.airingAt ? new Date(upcoming[0].airingAt * 1000) : new Date()
          setCurrentMonth(nextDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }))
          setLoadingSchedule(false)
        }
      } catch (err) {
        console.error("Failed to load schedule:", err)
        if (isActive) {
          setScheduleError(err.message || "Could not load your calendar.")
          setLoadingSchedule(false)
        }
      }
    }

    loadSchedule()

    return () => {
      isActive = false
    }
  }, [user, statusFilters])

  const groupedSchedule = useMemo(() => {
    const grouped = schedule.reduce((acc, item) => {
      const date = new Date(item.airingAt * 1000)
      const key = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
      if (!acc[key]) acc[key] = []
      acc[key].push({ ...item, date })
      return acc
    }, {})

    return Object.entries(grouped)
  }, [schedule])

  const toggleStatusFilter = (status) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status],
    )
  }

  const toggleNotify = (id) => {
    setNotifyIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <Navigation />

      <main className="pb-24 pt-20 md:pb-8">
        <div className="mx-auto max-w-6xl px-4 py-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/50 rounded-2xl blur-lg" />
                <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <CalendarIcon className="h-7 w-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Anime Calendar</h1>
                <p className="text-muted-foreground">Your personalized airing schedule</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
                <button
                  onClick={() => setViewMode("calendar")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    viewMode === "calendar" ? "bg-background shadow-sm" : "text-muted-foreground",
                  )}
                >
                  Calendar
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground",
                  )}
                >
                  List
                </button>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50">
                {notificationsEnabled ? (
                  <Bell className="h-4 w-4 text-primary" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
                <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
              </div>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Show:</span>
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status.id}
                onClick={() => toggleStatusFilter(status.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  statusFilters.includes(status.id)
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/40",
                )}
              >
                {status.label}
              </button>
            ))}
          </div>

          {loading || loadingSchedule ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-16 text-center text-muted-foreground">Loading schedule...</CardContent>
            </Card>
          ) : !user ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-16 text-center text-muted-foreground">
                Log in to see your upcoming episodes.
              </CardContent>
            </Card>
          ) : scheduleError ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-16 text-center text-muted-foreground">{scheduleError}</CardContent>
            </Card>
          ) : schedule.length === 0 ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-16 text-center text-muted-foreground">
                No upcoming episodes yet. Add some anime to your watching list.
              </CardContent>
            </Card>
          ) : viewMode === "list" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{currentMonth}</Badge>
                <span className="text-sm text-muted-foreground">
                  {notificationsEnabled ? "Notifications on" : "Notifications off"}
                </span>
              </div>
              {schedule.map((item) => {
                const date = new Date(item.airingAt * 1000)
                const dateLabel = date.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
                const timeLabel = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                const isNotified = notifySet.has(item.id)
                return (
                  <Card key={item.id} className="bg-card/50 border-border/50">
                    <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
                      <img
                        src={item.cover || "/placeholder.svg"}
                        alt={item.title}
                        className="h-20 w-14 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">Episode {item.episode}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            {dateLabel}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {timeLabel}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start md:self-auto">
                        <Button
                          variant={isNotified ? "secondary" : "ghost"}
                          size="sm"
                          className="gap-1"
                          disabled={!notificationsEnabled}
                          onClick={() => toggleNotify(item.id)}
                        >
                          {isNotified ? (
                            <Bell className="h-3.5 w-3.5" />
                          ) : (
                            <BellOff className="h-3.5 w-3.5" />
                          )}
                          {isNotified ? "Notifying" : "Notify"}
                        </Button>
                        <Badge variant="outline">{Math.round(item.timeUntilAiring / 3600)}h</Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{currentMonth}</Badge>
                <span className="text-sm text-muted-foreground">Upcoming episodes</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {groupedSchedule.map(([dateLabel, items]) => (
                  <Card key={dateLabel} className="bg-card/50 border-border/50">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-foreground">{dateLabel}</p>
                        <Badge variant="outline">{items.length} eps</Badge>
                      </div>
                      {items.map((item) => {
                        const isNotified = notifySet.has(item.id)
                        return (
                        <div key={item.id} className="flex items-center gap-3">
                          <img
                            src={item.cover || "/placeholder.svg"}
                            alt={item.title}
                            className="h-14 w-10 rounded-lg object-cover"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{item.title}</p>
                            <p className="text-xs text-muted-foreground">Episode {item.episode}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant={isNotified ? "secondary" : "ghost"}
                              size="icon"
                              disabled={!notificationsEnabled}
                              onClick={() => toggleNotify(item.id)}
                            >
                              {isNotified ? (
                                <Bell className="h-4 w-4" />
                              ) : (
                                <BellOff className="h-4 w-4" />
                              )}
                            </Button>
                            <Badge variant="secondary">
                              {item.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </Badge>
                          </div>
                        </div>
                      )})}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      </div>
    </RequireAuth>
  )
}
