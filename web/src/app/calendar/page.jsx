"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Navigation } from "@/components/layout/Navigation"
import RequireAuth from "@/components/common/RequireAuth"
import { EmptyState } from "@/components/common/EmptyState"
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

      <main className="pb-16 pt-24 lg:pt-28">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          {/* Header */}
          <header className="animate-rise">
            <p className="font-jp text-sm font-medium tracking-[0.3em] text-primary/70">放送予定</p>
            <div className="mt-1 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">Airing schedule</h1>
                <p className="mt-2 text-pretty text-muted-foreground">Upcoming episodes from the titles on your list.</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode("calendar")}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      viewMode === "calendar"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Calendar
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      viewMode === "list"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    List
                  </button>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
                  {notificationsEnabled ? (
                    <Bell className="h-4 w-4 text-primary" />
                  ) : (
                    <BellOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Switch
                    checked={notificationsEnabled}
                    onCheckedChange={setNotificationsEnabled}
                    aria-label={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
                  />
                </div>
              </div>
            </div>
          </header>

          <div className="mb-6 mt-8 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Show</span>
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status.id}
                type="button"
                onClick={() => toggleStatusFilter(status.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  statusFilters.includes(status.id)
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {status.label}
              </button>
            ))}
          </div>

          {loading || loadingSchedule ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="card-elevated h-24 animate-pulse" />
              ))}
            </div>
          ) : !user ? (
            <EmptyState
              icon={CalendarIcon}
              title="Sign in to see your schedule"
              description="Your upcoming episodes appear here once you're signed in."
              action={
                <Button asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
              }
            />
          ) : scheduleError ? (
            <EmptyState icon={CalendarIcon} title="Couldn't load your schedule" description={scheduleError} />
          ) : schedule.length === 0 ? (
            <EmptyState
              icon={CalendarIcon}
              title="No upcoming episodes"
              description="Add currently-airing titles to your list and their next episodes will show up here."
              action={
                <Button asChild>
                  <Link href="/search">Browse titles</Link>
                </Button>
              }
            />
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
                const hours = Math.round(item.timeUntilAiring / 3600)
                const countdown = hours >= 24 ? `${Math.round(hours / 24)}d` : `${Math.max(hours, 0)}h`
                return (
                  <div
                    key={item.id}
                    className="card-elevated group flex flex-col gap-4 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/30 sm:flex-row sm:items-center"
                  >
                    <Link
                      href={`/media/${item.mediaId || item.id}`}
                      className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-secondary"
                    >
                      <img
                        src={item.cover || "/placeholder.svg"}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/media/${item.mediaId || item.id}`} className="min-w-0">
                        <h3 className="truncate font-semibold text-foreground transition-colors group-hover:text-primary">
                          {item.title}
                        </h3>
                      </Link>
                      <p className="mt-0.5 text-sm font-medium text-primary">Episode {item.episode}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {dateLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {timeLabel}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        in {countdown}
                      </span>
                      <Button
                        variant={isNotified ? "secondary" : "outline"}
                        size="sm"
                        className="gap-1.5"
                        disabled={!notificationsEnabled}
                        onClick={() => toggleNotify(item.id)}
                      >
                        {isNotified ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                        {isNotified ? "Notifying" : "Notify"}
                      </Button>
                    </div>
                  </div>
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
                  <div key={dateLabel} className="card-elevated p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-semibold text-foreground">{dateLabel}</p>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {items.length} {items.length === 1 ? "episode" : "episodes"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const isNotified = notifySet.has(item.id)
                        return (
                          <div
                            key={item.id}
                            className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/40"
                          >
                            <Link
                              href={`/media/${item.mediaId || item.id}`}
                              className="relative h-16 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-secondary"
                            >
                              <img
                                src={item.cover || "/placeholder.svg"}
                                alt={item.title}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            </Link>
                            <Link href={`/media/${item.mediaId || item.id}`} className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                                {item.title}
                              </p>
                              <p className="text-xs text-muted-foreground">Episode {item.episode}</p>
                            </Link>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                {item.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </span>
                              <Button
                                variant={isNotified ? "secondary" : "ghost"}
                                size="icon"
                                className="size-8"
                                aria-label={isNotified ? "Stop notifying" : "Notify me"}
                                disabled={!notificationsEnabled}
                                onClick={() => toggleNotify(item.id)}
                              >
                                {isNotified ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
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
