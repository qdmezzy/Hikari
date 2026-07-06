"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Navigation } from "@/components/layout/Navigation"
import { EmptyState } from "@/components/common/EmptyState"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Bell, BellOff, Clock, Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"

export default function CalendarPage() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [viewMode, setViewMode] = useState("calendar")
  const [statusFilters, setStatusFilters] = useState(["watching", "rewatching", "on_hold"])
  // "mine" = only what you track · "all" = the whole current season.
  const [scheduleScope, setScheduleScope] = useState("mine")
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

  // Whole current-season airing schedule (for the "All Airing" tab).
  const ALL_AIRING_QUERY = `
  query ($season: MediaSeason, $seasonYear: Int, $perPage: Int) {
    Page(perPage: $perPage) {
      media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, isAdult: false) {
        id
        title { romaji english }
        coverImage { large }
        episodes
        nextAiringEpisode { airingAt timeUntilAiring episode }
      }
    }
  }
  `

  const getCurrentSeason = () => {
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    if (month <= 3) return { season: "WINTER", year }
    if (month <= 6) return { season: "SPRING", year }
    if (month <= 9) return { season: "SUMMER", year }
    return { season: "FALL", year }
  }

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
    const storedNotifsEnabled = window.localStorage.getItem(`hikari-calendar-notifs-${user.id}`)
    if (storedNotifsEnabled !== null) {
      setNotificationsEnabled(storedNotifsEnabled !== "0")
    }

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
    if (!user || typeof window === "undefined") return
    window.localStorage.setItem(`hikari-calendar-notifs-${user.id}`, notificationsEnabled ? "1" : "0")
  }, [notificationsEnabled, user])

  useEffect(() => {
    let isActive = true

    const loadSchedule = async () => {
      setLoadingSchedule(true)
      setScheduleError("")

      // Signed-out visitors can still view the whole-season schedule.
      const effectiveScope = user ? scheduleScope : "all"

      const toUpcoming = (mediaList) =>
        mediaList
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

      // "All Airing" — the whole current season, regardless of your list.
      if (effectiveScope === "all") {
        try {
          const { season, year } = getCurrentSeason()
          const res = await fetch("/api/anilist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: ALL_AIRING_QUERY, variables: { season, seasonYear: year, perPage: 50 } }),
          })
          const json = await res.json()
          if (!res.ok || json?.errors) {
            throw new Error(json?.errors?.[0]?.message || "Failed to load airing schedule.")
          }
          const upcoming = toUpcoming(json?.data?.Page?.media ?? [])
          if (isActive) {
            setSchedule(upcoming)
            setLoadingSchedule(false)
          }
        } catch (err) {
          console.error("Failed to load schedule:", err)
          if (isActive) {
            setScheduleError(err.message || "Could not load the airing schedule.")
            setLoadingSchedule(false)
          }
        }
        return
      }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, statusFilters, scheduleScope])

  // A true week structure: one section per day for the next 7 days (empty days
  // included, today first), plus a "Later" bucket for everything beyond.
  const weekSections = useMemo(() => {
    const now = new Date()
    const week = []
    const byKey = new Map()
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
      const section = {
        key: d.toDateString(),
        label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "long" }),
        sub: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        isToday: i === 0,
        items: [],
      }
      week.push(section)
      byKey.set(section.key, section)
    }
    const later = []
    schedule.forEach((item) => {
      const date = new Date(item.airingAt * 1000)
      const section = byKey.get(date.toDateString())
      if (section) section.items.push({ ...item, date })
      else later.push({ ...item, date })
    })
    return { week, later }
  }, [schedule])

  const weekEpisodeCount = useMemo(
    () => weekSections.week.reduce((sum, day) => sum + day.items.length, 0),
    [weekSections],
  )

  const toggleStatusFilter = (status) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status],
    )
  }

  const toggleNotify = (id) => {
    setNotifyIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  // Signed-out visitors always see the public "All Airing" view.
  const effectiveScope = user ? scheduleScope : "all"

  return (
    <div className="min-h-screen bg-background">
        <Navigation />

      <main className="pb-16 pt-24 lg:pt-28">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <header className="animate-rise">
            <p className="font-jp text-sm font-medium tracking-[0.3em] text-primary/70">放送予定</p>
            <div className="mt-1 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">Airing schedule</h1>
                <p className="mt-2 text-pretty text-muted-foreground">
                  {scheduleScope === "all"
                    ? "Upcoming episodes across the whole current season."
                    : "Upcoming episodes from the titles on your list."}
                </p>
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

          <div className="mt-8 flex w-fit items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
            {[
              { id: "mine", label: "My List" },
              { id: "all", label: "All Airing" },
            ].map((scope) =>
              scope.id === "mine" && !user ? (
                <Link
                  key={scope.id}
                  href="/login?next=%2Fcalendar"
                  className="rounded-lg px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {scope.label}
                </Link>
              ) : (
                <button
                  key={scope.id}
                  type="button"
                  onClick={() => setScheduleScope(scope.id)}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                    effectiveScope === scope.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {scope.label}
                </button>
              ),
            )}
          </div>

          {effectiveScope === "mine" ? (
            <div className="mb-6 mt-4 flex flex-wrap items-center gap-2">
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
          ) : (
            <div className="mb-6 mt-4" />
          )}

          {loading || loadingSchedule ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="card-elevated h-24 animate-pulse" />
              ))}
            </div>
          ) : scheduleError ? (
            <EmptyState icon={CalendarIcon} title="Couldn't load the schedule" description={scheduleError} />
          ) : schedule.length === 0 ? (
            <EmptyState
              icon={CalendarIcon}
              title="No upcoming episodes"
              description={
                effectiveScope === "all"
                  ? "Nothing with a confirmed next-episode time right now. Check back soon."
                  : "Add currently-airing titles to your list and their next episodes will show up here."
              }
              action={
                <Button asChild>
                  <Link href="/search">Browse titles</Link>
                </Button>
              }
            />
          ) : viewMode === "list" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Next up</Badge>
                <span className="text-sm text-muted-foreground">
                  {weekEpisodeCount} {weekEpisodeCount === 1 ? "episode" : "episodes"} airing this week
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
                const minutes = Math.max(Math.round(item.timeUntilAiring / 60), 0)
                const countdown =
                  minutes >= 1440
                    ? `${Math.round(minutes / 1440)}d`
                    : minutes >= 60
                      ? `${Math.round(minutes / 60)}h`
                      : `${minutes}m`
                return (
                  <div
                    key={item.id}
                    className="card-elevated group flex flex-col gap-4 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/30 sm:flex-row sm:items-center"
                  >
                    <Link
                      href={`/media/${item.id}`}
                      className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-secondary"
                    >
                      <img
                        src={item.cover || "/placeholder.svg"}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/media/${item.id}`} className="min-w-0">
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
                <Badge variant="secondary">Next 7 days</Badge>
                <span className="text-sm text-muted-foreground">
                  {weekEpisodeCount} {weekEpisodeCount === 1 ? "episode" : "episodes"} airing this week
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {weekSections.week.map((day) => (
                  <div
                    key={day.key}
                    className={cn("card-elevated p-4", day.isToday && "border-primary/40 ring-1 ring-primary/15")}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className={cn("font-semibold", day.isToday ? "text-primary" : "text-foreground")}>
                          {day.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{day.sub}</p>
                      </div>
                      {day.items.length ? (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {day.items.length}
                        </span>
                      ) : null}
                    </div>
                    {day.items.length ? (
                      <div className="space-y-1">
                        {day.items.map((item) => (
                          <ScheduleDayRow
                            key={item.id}
                            item={item}
                            isNotified={notifySet.has(item.id)}
                            notificationsEnabled={notificationsEnabled}
                            onToggleNotify={toggleNotify}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="py-5 text-center text-xs text-muted-foreground/60">No episodes</p>
                    )}
                  </div>
                ))}
              </div>

              {weekSections.later.length ? (
                <div className="card-elevated p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">Later</p>
                      <p className="text-xs text-muted-foreground">Beyond this week</p>
                    </div>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {weekSections.later.length}
                    </span>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {weekSections.later.map((item) => (
                      <ScheduleDayRow
                        key={item.id}
                        item={item}
                        withDate
                        isNotified={notifySet.has(item.id)}
                        notificationsEnabled={notificationsEnabled}
                        onToggleNotify={toggleNotify}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>
      </div>
  )
}

function ScheduleDayRow({ item, isNotified, notificationsEnabled, onToggleNotify, withDate = false }) {
  const timeLabel = item.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  const meta = withDate
    ? `Ep ${item.episode} · ${item.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : `Ep ${item.episode} · ${timeLabel}`
  return (
    <div className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/40">
      <Link
        href={`/media/${item.id}`}
        className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-secondary"
      >
        <img
          src={item.cover || "/placeholder.svg"}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </Link>
      <Link href={`/media/${item.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground">{meta}</p>
      </Link>
      <Button
        variant={isNotified ? "secondary" : "ghost"}
        size="icon"
        className="size-8 flex-shrink-0"
        aria-label={isNotified ? "Stop notifying" : "Notify me"}
        disabled={!notificationsEnabled}
        onClick={() => onToggleNotify(item.id)}
      >
        {isNotified ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      </Button>
    </div>
  )
}
