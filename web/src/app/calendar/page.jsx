"use client"
import { ScheduleScreen } from "@/components/media/ScheduleScreen"

import { useEffect, useMemo, useRef, useState } from "react"
import { saveEpisodeReminder } from "@/lib/reminder-contract.mjs"
import { readAllRows } from "@/lib/read-all-rows.mjs"
import { buildScheduleWeek, validTimeZone } from "@/lib/schedule-domain.mjs"
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
  const [alertsReady, setAlertsReady] = useState(false)
  const [pendingReminders, setPendingReminders] = useState([])
  const reminderLocks = useRef(new Set())
  const [preferencesKey, setPreferencesKey] = useState("")
  const [pushStatus, setPushStatus] = useState("idle")
  const [viewMode, setViewMode] = useState("calendar")
  const [selectedDay, setSelectedDay] = useState("all")
  const [timeZone, setTimeZone] = useState("")
  const [retry, setRetry] = useState(0)

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

  // Include ongoing shows from older seasons, not just the current season.
  const ALL_AIRING_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(type: ANIME, status: RELEASING, sort: ID, isAdult: false) {
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
    if (loading) return
    const key = "hikari-schedule-v2-" + (user?.id || "guest")
    try {
      const prefs = JSON.parse(localStorage.getItem(key) || "{}")
      setViewMode(prefs.viewMode === "list" ? "list" : "calendar")
      setScheduleScope(prefs.scope === "all" ? "all" : "mine")
      setTimeZone(validTimeZone(prefs.timeZone) ? prefs.timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone)
      setStatusFilters(Array.isArray(prefs.statuses) ? prefs.statuses.filter(value => STATUS_OPTIONS.some(option => option.id === value)) : ["watching", "rewatching", "on_hold"])
    } catch { setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone) }
    setPreferencesKey(key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id])

  useEffect(() => {
    if (!preferencesKey || preferencesKey !== "hikari-schedule-v2-" + (user?.id || "guest")) return
    try { localStorage.setItem(preferencesKey, JSON.stringify({ viewMode, scope: scheduleScope, timeZone, statuses: statusFilters })) } catch {}
  }, [preferencesKey, viewMode, scheduleScope, timeZone, statusFilters, user?.id])

  useEffect(() => {
    let active = true
    setNotifyIds([])
    setAlertsReady(false)
    if (!user) return
    readAllRows(() => client.from("episode_alerts").select("media_id").eq("user_id", user.id), { key: "media_id", isActive: () => active }).then(({ data, error }) => {
      if (!active) return
      if (error) { toast.error("Saved reminders could not load. Refresh to retry."); return }
      setNotifyIds((data || []).map(row => Number(row.media_id)).filter(Number.isFinite))
      setAlertsReady(true)
    }).catch(() => { if (active) toast.error("Saved reminders could not load. Refresh to retry.") })
    return () => { active = false }
  }, [user?.id, retry])

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

      // "All Airing" — next announced episodes for currently releasing shows.
      if (effectiveScope === "all") {
        try {
          const allMedia = new Map()
          for (let page = 1; ; page++) {
          if (!isActive) return
          if (page > 40) throw new Error("The airing catalog is too large to load fully. Please try My Shows.")
          const res = await fetch("/api/anilist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: ALL_AIRING_QUERY, variables: { page, perPage: 50 } }),
            signal: AbortSignal.timeout(15000),
          })
          const json = await res.json()
          if (!res.ok || json?.errors) {
            throw new Error(json?.errors?.[0]?.message || "Failed to load airing schedule.")
          }
          const result = json?.data?.Page
          if (!Array.isArray(result?.media) || typeof result?.pageInfo?.hasNextPage !== "boolean") throw new Error("The airing catalog returned an incomplete page. Please retry.")
          for (const media of result.media) allMedia.set(media.id, media)
          if (!result.pageInfo.hasNextPage) break
          }
          const upcoming = toUpcoming([...allMedia.values()])
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

      const { data, error } = await readAllRows(() => client
        .from("list_entries")
        .select("media_id, status, media_type")
        .eq("user_id", user.id)
        .eq("media_type", "ANIME")
        .in("status", statusFilters), { key: "media_id", isActive: () => isActive })

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
            signal: AbortSignal.timeout(15000),
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
  const weekSections = useMemo(() => buildScheduleWeek(schedule, timeZone || "UTC"), [schedule, timeZone])

  const weekEpisodeCount = useMemo(
    () => weekSections.week.reduce((sum, day) => sum + day.items.length, 0),
    [weekSections],
  )

  const toggleStatusFilter = (status) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status],
    )
  }

  const toggleNotify = async (id) => {
    if (!user) { window.location.assign("/login?next=%2Fcalendar"); return }
    if (!alertsReady || reminderLocks.current.has(id)) return
    const enabling = !notifyIds.includes(id)
    reminderLocks.current.add(id)
    setPendingReminders(previous => [...previous, id])
    try {
      await saveEpisodeReminder(client, user.id, id, enabling)
      setNotifyIds(previous => enabling ? [...new Set([...previous, id])] : previous.filter(value => value !== id))
      toast.success(enabling ? "Reminder saved. Browser delivery is optional." : "Reminder removed.")
    } catch (error) {
      toast.error(error.message || "Reminder wasn't saved. Try again.")
    } finally {
      reminderLocks.current.delete(id)
      setPendingReminders(previous => previous.filter(value => value !== id))
    }
  }

  const enablePush = async () => {
    if (pushStatus === "pending") return
    setPushStatus("pending")
    const status = await ensurePushSubscription()
    setPushStatus(status)
    if (status === "subscribed") toast.success("This browser is subscribed to notifications.")
    else if (status === "denied") toast.error("Browser notifications are blocked. Your saved reminders haven't changed.")
    else if (status === "unsupported") toast.info("Push isn't available in this browser or isn't configured yet.")
    else toast.error("Browser subscription wasn't saved. Try again.")
  }

  // Signed-out visitors always see the public "All Airing" view.
  const effectiveScope = user ? scheduleScope : "all"

  return <ScheduleScreen model={{weekSections, selectedDay, setSelectedDay, timeZone, setTimeZone, user, effectiveScope, setScheduleScope, alertsReady, pendingReminders, pushStatus, enablePush, loadingSchedule, loading, weekEpisodeCount, statusFilters, STATUS_OPTIONS, toggleStatusFilter, viewMode, setViewMode, scheduleError, setRetry, notifySet, toggleNotify}}/>
}
