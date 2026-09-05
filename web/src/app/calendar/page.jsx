"use client"
import { ScheduleScreen } from "@/components/media/ScheduleScreen"

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
import { toast } from "sonner"
import { ensurePushSubscription } from "@/lib/push-client"

export default function CalendarPage() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [viewMode, setViewMode] = useState("calendar")
  const [selectedDay, setSelectedDay] = useState("all")
  const [timeZone, setTimeZone] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => { setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll("_", " ")) }, [])
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

    // The episode_alerts table is what the push cron reads, so it's the
    // source of truth — merge it with any older localStorage-only bells and
    // migrate those up.
    const syncAlerts = async () => {
      try {
        const { data } = await client.from("episode_alerts").select("media_id").eq("user_id", user.id)
        const dbIds = (data || []).map((row) => Number(row.media_id)).filter(Number.isFinite)
        let localIds = []
        try {
          localIds = (JSON.parse(storedNotify || "[]") || []).map(Number).filter(Number.isFinite)
        } catch {}
        const merged = Array.from(new Set([...dbIds, ...localIds]))
        if (merged.length) setNotifyIds(merged)
        const missing = merged.filter((id) => !dbIds.includes(id))
        if (missing.length) {
          void client
            .from("episode_alerts")
            .upsert(missing.map((media_id) => ({ user_id: user.id, media_id })), {
              onConflict: "user_id,media_id",
            })
        }
      } catch {
        /* table may not exist yet — bells still work locally */
      }
    }
    syncAlerts()
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
  }, [user, statusFilters, scheduleScope, retry])

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
    if (!user) { window.location.assign("/login?next=%2Fcalendar"); return }
    const enabling = !notifyIds.includes(id)
    setNotifyIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
    if (!user) return

    if (enabling) {
      void client
        .from("episode_alerts")
        .upsert({ user_id: user.id, media_id: id }, { onConflict: "user_id,media_id" })
      void ensurePushSubscription().then((status) => {
        if (status === "subscribed") {
          toast.success("You'll get a notification when the episode airs.")
        } else if (status === "denied") {
          toast.error("Notifications are blocked for this site — allow them in your browser settings.")
        }
      })
    } else {
      void client.from("episode_alerts").delete().eq("user_id", user.id).eq("media_id", id)
    }
  }

  const handleNotificationsToggle = (enabled) => {
    setNotificationsEnabled(enabled)
    if (enabled) {
      void ensurePushSubscription().then((status) => {
        if (status === "denied") {
          toast.error("Notifications are blocked for this site — allow them in your browser settings.")
        }
      })
    }
  }

  // Signed-out visitors always see the public "All Airing" view.
  const effectiveScope = user ? scheduleScope : "all"

  return <ScheduleScreen model={{weekSections, selectedDay, setSelectedDay, timeZone, user, effectiveScope, setScheduleScope, notificationsEnabled, handleNotificationsToggle, loadingSchedule, loading, weekEpisodeCount, statusFilters, STATUS_OPTIONS, toggleStatusFilter, viewMode, setViewMode, scheduleError, setRetry, notifySet, toggleNotify}}/>
}
