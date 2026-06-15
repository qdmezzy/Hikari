"use client"

import { useEffect, useMemo, useState } from "react"
import { Navigation } from "@/components/layout/Navigation"
import RequireAuth from "@/components/common/RequireAuth"
import { EmptyState } from "@/components/common/EmptyState"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  History,
  Search,
  Play,
  Trash2,
  Clock,
  Calendar,
  MoreHorizontal,
  Filter,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Suspense } from "react"
import Loading from "./loading"
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
      chapters
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

const statusLabels = {
  watching: "Watching",
  completed: "Completed",
  rewatching: "Rewatching",
  on_hold: "On Hold",
  dropped: "Dropped",
  plan_to_watch: "Planned",
}

const formatRelativeTime = (dateValue) => {
  if (!dateValue) return "Just now"
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return "Just now"

  const diffMs = date.getTime() - Date.now()
  const diffSec = Math.round(diffMs / 1000)
  const absSec = Math.abs(diffSec)
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (absSec < 60) return rtf.format(diffSec, "second")
  if (absSec < 3600) return rtf.format(Math.round(diffSec / 60), "minute")
  if (absSec < 86400) return rtf.format(Math.round(diffSec / 3600), "hour")
  if (absSec < 604800) return rtf.format(Math.round(diffSec / 86400), "day")

  return date.toLocaleDateString()
}

export default function WatchHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [entries, setEntries] = useState([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [entriesError, setEntriesError] = useState("")
  const [pendingId, setPendingId] = useState(null)
  const { user } = useAuth()

  useEffect(() => {
    let isActive = true

    const loadHistory = async () => {
      if (!user) {
        setEntries([])
        setLoadingEntries(false)
        return
      }

      setLoadingEntries(true)
      setEntriesError("")

      const { data, error } = await client
        .from("list_entries")
        .select("id, media_id, status, progress, media_type, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (!isActive) return

      if (error) {
        console.error("Failed to load history entries:", error)
        setEntries([])
        setEntriesError("Could not load watch history yet.")
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
        console.error("Failed to hydrate history media:", err)
        if (isActive) {
          setEntries(data.map((entry) => ({ ...entry, media: null })))
          setEntriesError("Some details could not load.")
          setLoadingEntries(false)
        }
      }
    }

    loadHistory()

    return () => {
      isActive = false
    }
  }, [user])

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return entries
    return entries.filter((entry) => {
      const title =
        entry?.media?.title?.english ||
        entry?.media?.title?.romaji ||
        "Unknown title"
      return title.toLowerCase().includes(query)
    })
  }, [entries, searchQuery])

  const groupedEntries = useMemo(() => {
    const buckets = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Earlier: [],
    }

    filteredEntries.forEach((entry) => {
      const updatedAt = entry.updated_at ? new Date(entry.updated_at) : null
      if (!updatedAt || Number.isNaN(updatedAt.getTime())) {
        buckets.Earlier.push(entry)
        return
      }

      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)

      if (updatedAt >= startOfToday) {
        buckets.Today.push(entry)
      } else if (updatedAt >= startOfYesterday) {
        buckets.Yesterday.push(entry)
      } else if (updatedAt >= startOfWeek) {
        buckets["This Week"].push(entry)
      } else {
        buckets.Earlier.push(entry)
      }
    })

    return [
      { date: "Today", items: buckets.Today },
      { date: "Yesterday", items: buckets.Yesterday },
      { date: "This Week", items: buckets["This Week"] },
      { date: "Earlier", items: buckets.Earlier },
    ].filter((group) => group.items.length > 0)
  }, [filteredEntries])

  const handleRemove = async (entryId) => {
    if (!user || !entryId) return
    setPendingId(entryId)
    const { error } = await client.from("list_entries").delete().eq("id", entryId)
    if (error) {
      console.error("Failed to remove entry:", error)
    } else {
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId))
    }
    setPendingId(null)
  }

  return (
    <Suspense fallback={<Loading />}>
      <RequireAuth>
        <div className="min-h-screen bg-background noise-overlay">
          <Navigation />

        <main className="pb-24 pt-24 md:pb-8">
          <div className="px-4 py-8 md:px-8">
            <div className="mx-auto max-w-4xl">
              {/* Header */}
              <div
                className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                style={{
                  animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <History className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground md:text-3xl">
                      Watch History
                    </h1>
                    <p className="text-muted-foreground">
                      Continue where you left off
                    </p>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 bg-transparent">
                      <MoreHorizontal className="h-4 w-4" />
                      Options
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Pause Watch History</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      Clear All History
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Search */}
              <Card
                className="mb-6 bg-card/50 border-border/50"
                style={{
                  animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                  animationDelay: "100ms",
                  opacity: 0,
                }}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search watch history..."
                      className="pl-9 bg-background/50 border-border/50"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                    <Filter className="h-4 w-4" />
                    Filter
                  </Button>
                </CardContent>
              </Card>

              {/* History List */}
              <div className="space-y-8">
                {loadingEntries ? (
                  <Card className="bg-card/50 border-border/50">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>Loading watch history...</p>
                    </CardContent>
                  </Card>
                ) : entriesError ? (
                  <Card className="bg-card/50 border-border/50">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>{entriesError}</p>
                    </CardContent>
                  </Card>
                ) : groupedEntries.length === 0 ? (
                  <EmptyState
                    icon={History}
                    title="No watch history yet"
                    description="As you update progress on titles, your activity will show up here."
                    action={
                      <Button asChild>
                        <Link href="/search">Browse titles</Link>
                      </Button>
                    }
                  />
                ) : (
                  groupedEntries.map((group, groupIndex) => (
                    <div
                      key={group.date}
                      style={{
                        animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                        animationDelay: `${150 + groupIndex * 100}ms`,
                        opacity: 0,
                      }}
                    >
                      <h2 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {group.date}
                      </h2>
                      <div className="space-y-3">
                        {group.items.map((item, itemIndex) => {
                          const title =
                            item?.media?.title?.english ||
                            item?.media?.title?.romaji ||
                            "Unknown title"
                          const coverImage = item?.media?.coverImage?.large || "/placeholder.svg"
                          const isManga = item?.media_type === "MANGA"
                          const totalUnits = isManga
                            ? item?.media?.chapters ?? null
                            : item?.media?.episodes ?? null
                          const progress = item?.progress ?? 0
                          const progressPercent = totalUnits
                            ? Math.min((progress / totalUnits) * 100, 100)
                            : 0
                          const statusLabel = statusLabels[item.status] || "Updated"
                          const unitLabel = isManga ? "Chapter" : "Episode"

                          return (
                            <Card
                              key={item.id}
                              className="bg-card/50 border-border/50 overflow-hidden group hover:border-primary/30 transition-all duration-300"
                              style={{
                                animation: "fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                                animationDelay: `${200 + groupIndex * 100 + itemIndex * 50}ms`,
                                opacity: 0,
                              }}
                            >
                              <CardContent className="flex items-center gap-4 p-4">
                                <Link href={`/media/${item.media_id}`} className="relative shrink-0 group/thumb">
                                  <img
                                    src={coverImage}
                                    alt={title}
                                    className="h-20 w-32 rounded-lg object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity rounded-lg">
                                    <Play className="h-8 w-8 text-white" fill="white" />
                                  </div>
                                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50 rounded-b-lg overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full transition-all duration-500",
                                        progressPercent === 100
                                          ? "bg-emerald-500"
                                          : "bg-primary"
                                      )}
                                      style={{ width: `${progressPercent}%` }}
                                    />
                                  </div>
                                </Link>

                                <div className="flex-1 min-w-0">
                                  <Link href={`/media/${item.media_id}`}>
                                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                      {title}
                                    </h3>
                                  </Link>
                                  <p className="text-sm text-muted-foreground mt-0.5">
                                    {unitLabel} {progress || 0} - {statusLabel}
                                  </p>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatRelativeTime(item.updated_at)}
                                    </span>
                                    {totalUnits ? (
                                      <span>
                                        {progress}/{totalUnits} {isManga ? "Ch" : "Ep"}
                                      </span>
                                    ) : (
                                      <span>{progress} logged</span>
                                    )}
                                    {progressPercent < 100 && progressPercent > 0 && (
                                      <Badge variant="secondary" className="text-xs">
                                        {Math.round(progressPercent)}% watched
                                      </Badge>
                                    )}
                                    {progressPercent === 100 && (
                                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                                        Completed
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Link href={`/media/${item.media_id}`}>
                                    <Button
                                      size="sm"
                                      className={cn(
                                        "gap-1",
                                        progressPercent < 100
                                          ? "bg-gradient-to-r from-primary to-accent hover:opacity-90"
                                          : "bg-transparent"
                                      )}
                                      variant={progressPercent < 100 ? "default" : "outline"}
                                    >
                                      <Play className="h-3 w-3" fill={progressPercent < 100 ? "white" : "none"} />
                                      {progressPercent < 100 ? "Resume" : "Rewatch"}
                                    </Button>
                                  </Link>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-muted-foreground"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem>Next Episode</DropdownMenuItem>
                                      <DropdownMenuItem>View Anime</DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        disabled={pendingId === item.id}
                                        onClick={() => handleRemove(item.id)}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Remove from History
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          </div>
        </main>
        </div>
      </RequireAuth>
    </Suspense>
  )
}




