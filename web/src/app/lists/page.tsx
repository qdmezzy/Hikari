"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { Navigation } from "@/components/layout/Navigation"
import { AnimeDecorations } from "@/components/common/anime-decorations"
import RequireAuth from "@/components/common/RequireAuth"
import { EmptyState } from "@/components/common/EmptyState"
import {
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Star,
  Trash2,
  MoreHorizontal,
  Eye,
  Calendar,
  Plus,
  Loader2,
  ListPlus,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { fetchAniListMediaByIds, formatRelativeTime, getEpisodeCount, getMediaTitle } from "@/lib/anilist"
import { logListActivity } from "@/lib/activity-service"
import { CollectionsSection } from "@/components/lists/CollectionsSection"

const statusToTab = {
  watching: "watching",
  rewatching: "watching",
  completed: "completed",
  plan_to_watch: "planned",
  "plan-to-watch": "planned",
  planned: "planned",
  on_hold: "paused",
  "on-hold": "paused",
  dropped: "dropped",
}

const tabMeta = {
  watching: {
    label: "Watching / Reading",
    icon: Play,
    badge: "text-green-500 bg-green-500/10",
    statuses: ["watching", "rewatching"],
  },
  completed: {
    label: "Completed / Read",
    icon: CheckCircle2,
    badge: "text-accent bg-accent/10",
    statuses: ["completed"],
  },
  planned: {
    label: "Plan to Watch / Read",
    icon: Clock,
    badge: "text-blue-500 bg-blue-500/10",
    statuses: ["plan_to_watch"],
  },
  paused: {
    label: "On Hold",
    icon: Pause,
    badge: "text-yellow-500 bg-yellow-500/10",
    statuses: ["on_hold"],
  },
  dropped: {
    label: "Dropped",
    icon: Trash2,
    badge: "text-red-500 bg-red-500/10",
    statuses: ["dropped"],
  },
}

const emptyCopy = {
  watching: { title: "Nothing in progress", desc: "Titles you're currently watching or reading will show up here." },
  completed: { title: "No completed titles yet", desc: "Finish a title and it'll land here." },
  planned: { title: "Your plan-to-watch is empty", desc: "Save titles you want to get to later." },
  paused: { title: "Nothing on hold", desc: "Titles you've paused will appear here." },
  dropped: { title: "Nothing dropped", desc: "Titles you've dropped will appear here." },
}

const getTabIdForStatus = (status) => statusToTab[status] || "watching"

const isMangaEntry = (entry) => entry?.media_type === "MANGA" || entry?.media?.type === "MANGA"

const getEntryUnitLabel = (entry, short = false) => {
  const manga = isMangaEntry(entry)
  if (short) return manga ? "Ch" : "Ep"
  return manga ? "chapter" : "episode"
}

const getEntryTotalUnits = (entry) => {
  if (isMangaEntry(entry)) {
    return Number(entry?.media?.chapters || 0) || Number(entry?.media?.episodes || 0) || null
  }
  return getEpisodeCount(entry?.media)
}

const getEntryStatusLabel = (entry, tabId) => {
  const manga = isMangaEntry(entry)
  if (tabId === "watching") return manga ? "Reading" : "Watching"
  if (tabId === "completed") return manga ? "Read" : "Completed"
  if (tabId === "planned") return manga ? "Plan to Read" : "Plan to Watch"
  if (tabId === "paused") return "On Hold"
  if (tabId === "dropped") return "Dropped"
  return tabMeta[tabId]?.label || "Updated"
}

const getMediaStatusLabel = (entry) => {
  const status = entry?.media?.status
  if (!status || status === "FINISHED") return null
  if (status === "RELEASING") return isMangaEntry(entry) ? "Publishing" : "Airing"
  if (status === "NOT_YET_RELEASED") return "Coming Soon"
  return status.replaceAll("_", " ")
}

const formatEntryScore = (value) => {
  const numeric = Number(value || 0)
  if (!numeric) return null
  if (numeric > 10) return (numeric / 10).toFixed(1)
  return numeric.toFixed(numeric % 1 === 0 ? 0 : 1)
}

function ListPageContent() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const statusParam = searchParams.get("status")

  const initialTab = statusParam ? statusToTab[statusParam] || "watching" : "watching"

  const [activeTab, setActiveTab] = useState(initialTab)
  const [entries, setEntries] = useState([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [entriesError, setEntriesError] = useState("")
  const [pendingId, setPendingId] = useState(null)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (statusParam && statusToTab[statusParam]) {
      setActiveTab(statusToTab[statusParam])
    }
  }, [statusParam])

  useEffect(() => {
    let isActive = true

    const loadEntries = async () => {
      if (!user) {
        setEntries([])
        setLoadingEntries(false)
        return
      }

      setLoadingEntries(true)
      setEntriesError("")

      const SELECT_FULL =
        "id, media_id, status, progress, score, media_type, updated_at, created_at, started_at, finished_at"
      const SELECT_FALLBACK = "id, media_id, status, progress, score, media_type, updated_at, created_at"

      let data: any[] | null = null
      let error: any = null
      ;({ data, error } = await client
        .from("list_entries")
        .select(SELECT_FULL)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }))

      // The started_at/finished_at columns may not be migrated yet — fall back
      // to the core columns instead of breaking the whole list.
      if (error && /started_at|finished_at|column/i.test(error.message || "")) {
        ;({ data, error } = await client
          .from("list_entries")
          .select(SELECT_FALLBACK)
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }))
      }

      if (!isActive) return

      if (error) {
        console.error("Failed to load list entries:", error)
        setEntries([])
        setEntriesError("Could not load your list yet.")
        setLoadingEntries(false)
        return
      }

      if (!data?.length) {
        setEntries([])
        setLoadingEntries(false)
        return
      }

      try {
        const mediaById = await fetchAniListMediaByIds(data.map((entry) => entry.media_id))
        if (!isActive) return

        setEntries(
          data.map((entry) => ({
            ...entry,
            media: mediaById.get(entry.media_id) || null,
          })),
        )
      } catch (loadError) {
        console.error("Failed to hydrate list media:", loadError)
        if (!isActive) return

        setEntries(data.map((entry) => ({ ...entry, media: null })))
        setEntriesError("Some covers and titles could not load.")
      } finally {
        if (isActive) {
          setLoadingEntries(false)
        }
      }
    }

    loadEntries()

    return () => {
      isActive = false
    }
  }, [user])

  const groupedEntries = useMemo(() => {
    const groups = {
      watching: [],
      completed: [],
      planned: [],
      paused: [],
      dropped: [],
    }

    entries.forEach((entry) => {
      groups[getTabIdForStatus(entry.status)].push(entry)
    })

    const ts = (value) => (value ? new Date(value).getTime() : 0)
    // Plan to Watch: newest added first.
    groups.planned.sort((a, b) => ts(b.created_at) - ts(a.created_at))
    // Completed: most recently finished first (fall back to updated_at).
    groups.completed.sort(
      (a, b) => ts(b.finished_at || b.updated_at) - ts(a.finished_at || a.updated_at),
    )
    // Watching / on-hold / dropped: most recent activity first.
    ;[groups.watching, groups.paused, groups.dropped].forEach((list) =>
      list.sort((a, b) => ts(b.updated_at) - ts(a.updated_at)),
    )

    return groups
  }, [entries])

  const tabs = useMemo(
    () =>
      Object.entries(tabMeta).map(([id, meta]) => ({
        id,
        label: meta.label,
        count: groupedEntries[id]?.length || 0,
        list: groupedEntries[id] || [],
      })),
    [groupedEntries],
  )

  const updateEntry = async (entry, updates) => {
    if (!entry?.id) return

    setPendingId(entry.id)
    const optimisticUpdatedAt = new Date().toISOString()
    const previousEntry = entry

    setEntries((current) =>
      current.map((item) =>
        item.id === entry.id ? { ...item, ...updates, updated_at: optimisticUpdatedAt } : item,
      ),
    )

    const { error } = await client.from("list_entries").update(updates).eq("id", entry.id)

    if (error) {
      console.error("Failed to update list entry:", error)
      setEntries((current) => current.map((item) => (item.id === entry.id ? previousEntry : item)))
      toast.error("Couldn't update that entry. Please try again.")
    } else {
      void logListActivity({
        user,
        media: entry.media,
        mediaId: entry.media_id,
        mediaType: entry.media_type || entry.media?.type,
        status: updates.status ?? entry.status,
        progress: updates.progress ?? entry.progress,
      })
      const statusLabel = {
        watching: "Watching",
        rewatching: "Rewatching",
        completed: "Completed",
        plan_to_watch: "Plan to Watch",
        on_hold: "On Hold",
        dropped: "Dropped",
      }
      if (updates.progress !== undefined && updates.status !== "completed") {
        toast.success("Progress updated")
      } else if (updates.status) {
        toast.success(`Moved to ${statusLabel[updates.status] || "your list"}`)
      } else {
        toast.success("List updated")
      }
    }

    setPendingId(null)
  }

  const handleIncrement = async (entry) => {
    const episodeCount = getEntryTotalUnits(entry)
    const currentProgress = Number(entry?.progress || 0)
    const nextProgress = episodeCount ? Math.min(currentProgress + 1, episodeCount) : currentProgress + 1
    const nextStatus = episodeCount && nextProgress >= episodeCount ? "completed" : "watching"
    await updateEntry(entry, { progress: nextProgress, status: nextStatus })
  }

  const handleRemove = async (entry) => {
    if (!entry?.id) return

    setPendingId(entry.id)
    const { error } = await client.from("list_entries").delete().eq("id", entry.id)

    if (error) {
      console.error("Failed to remove list entry:", error)
      toast.error("Couldn't remove that title. Please try again.")
      setPendingId(null)
      return
    }

    setEntries((current) => current.filter((item) => item.id !== entry.id))
    toast.success("Removed from your list")
    setPendingId(null)
  }

  const AnimeCard = ({ entry, tabId }) => {
    const title = getMediaTitle(entry?.media)
    const cover = entry?.media?.coverImage?.extraLarge || entry?.media?.coverImage?.large || "/placeholder.svg"
    const score = formatEntryScore(entry?.score)
    const episodeCount = getEntryTotalUnits(entry)
    const isCompletedEntry = tabId === "completed" || entry?.status === "completed"
    const rawProgress = Number(entry?.progress || 0)
    // Completed items always read as fully watched/read, never partial.
    const progress = isCompletedEntry && episodeCount ? episodeCount : rawProgress
    const progressValue = isCompletedEntry
      ? 100
      : episodeCount
        ? Math.min((progress / episodeCount) * 100, 100)
        : 0
    // Stable dates that imports don't bump: created_at (when added to Hikari),
    // started_at / finished_at (real dates from the source). updated_at is the
    // last-edit time, which a re-import touches — so we avoid it on these labels.
    const toDate = (value: string | null | undefined) =>
      value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null
    const finishedOn = toDate(entry?.finished_at)
    const lastWatchedOn = toDate(entry?.updated_at)
    const addedOn = toDate(entry?.created_at)
    // lastWatchedOn is used for the Watching tab; completed entries only show finishedAt.
    const addedLabel = formatRelativeTime(entry?.created_at)
    const meta = tabMeta[tabId]
    const Icon = meta.icon
    const isPending = pendingId === entry.id
    const unitLabel = getEntryUnitLabel(entry)
    const shortUnitLabel = getEntryUnitLabel(entry, true)
    const statusLabel = getEntryStatusLabel(entry, tabId)
    const mediaStatusLabel = getMediaStatusLabel(entry)

    const detailText =
      tabId === "completed"
        ? finishedOn
          ? `${isMangaEntry(entry) ? "Read" : "Finished"} ${finishedOn}`
          : isMangaEntry(entry)
            ? "Read"
            : "Completed"
        : tabId === "watching"
          ? lastWatchedOn
            ? `Last watched ${lastWatchedOn}`
            : `Added ${addedLabel || "recently"}`
          : addedOn
            ? `Added ${addedOn}`
            : `Added ${addedLabel || "recently"}`

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="glass-card p-4 flex gap-4 group hover:border-accent/50 transition-all"
      >
        <Link href={`/media/${entry.media_id}`} className="relative w-20 h-28 md:w-24 md:h-32 rounded-lg overflow-hidden flex-shrink-0">
          <Image
            src={cover}
            alt={title}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white">Open</span>
          </div>
        </Link>

        <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/media/${entry.media_id}`}>
                  <h3 className="font-semibold text-foreground text-lg group-hover:text-accent transition-colors line-clamp-1">
                    {title}
                  </h3>
                </Link>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge className={meta.badge}>
                    <Icon className="w-3 h-3 mr-1" />
                    {statusLabel}
                  </Badge>
                  {mediaStatusLabel ? (
                    <Badge variant="outline" className="text-xs">
                      {mediaStatusLabel}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="flex-shrink-0 h-8 w-8 p-0" disabled={isPending} aria-label="Entry actions">
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/media/${entry.media_id}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      Open details
                    </Link>
                  </DropdownMenuItem>
                  {(tabId === "watching" || tabId === "paused") && (
                    <DropdownMenuItem onClick={() => handleIncrement(entry)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add 1 {unitLabel}
                    </DropdownMenuItem>
                  )}
                  {entry.status !== "watching" && (
                    <DropdownMenuItem onClick={() => updateEntry(entry, { status: "watching" })}>
                      <Play className="w-4 h-4 mr-2" />
                      Move to {isMangaEntry(entry) ? "reading" : "watching"}
                    </DropdownMenuItem>
                  )}
                  {entry.status !== "completed" && (
                    <DropdownMenuItem
                      onClick={() =>
                        updateEntry(entry, {
                          status: "completed",
                          progress: episodeCount || entry?.progress || 0,
                        })
                      }
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Mark {isMangaEntry(entry) ? "read" : "completed"}
                    </DropdownMenuItem>
                  )}
                  {entry.status !== "plan_to_watch" && (
                    <DropdownMenuItem onClick={() => updateEntry(entry, { status: "plan_to_watch" })}>
                      <ListPlus className="w-4 h-4 mr-2" />
                      Move to plan to {isMangaEntry(entry) ? "read" : "watch"}
                    </DropdownMenuItem>
                  )}
                  {entry.status !== "on_hold" && (
                    <DropdownMenuItem onClick={() => updateEntry(entry, { status: "on_hold" })}>
                      <Pause className="w-4 h-4 mr-2" />
                      Put on hold
                    </DropdownMenuItem>
                  )}
                  {entry.status !== "dropped" && (
                    <DropdownMenuItem onClick={() => updateEntry(entry, { status: "dropped" })}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Mark dropped
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => handleRemove(entry)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove from list
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
              {episodeCount ? (
                <span>
                  {shortUnitLabel} {progress}/{episodeCount}
                </span>
              ) : progress ? (
                <span>
                  Progress {progress} {progress === 1 ? unitLabel : `${unitLabel}s`}
                </span>
              ) : null}
              {score ? (
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" />
                  <span>{score}</span>
                </div>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground mt-1">
              {tabId === "planned" ? <Calendar className="w-3 h-3 inline mr-1" /> : <Clock className="w-3 h-3 inline mr-1" />}
              {detailText}
            </p>
          </div>

          {(tabId === "watching" || tabId === "paused") && episodeCount ? (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{Math.round(progressValue)}%</span>
              </div>
              <Progress value={progressValue} className="h-1.5" />
            </div>
          ) : null}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimeDecorations variant="sparse" />
      <Navigation />

      <main className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">My List</h1>
            <p className="text-muted-foreground">Keep up with everything you're watching and reading.</p>
          </motion.div>

          <CollectionsSection user={user} />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8"
          >
            {tabs.map((tab) => {
              const meta = tabMeta[tab.id]
              const Icon = meta.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`glass-card p-4 text-center transition-all duration-300 hover:scale-105 ${
                    activeTab === tab.id ? "border-accent ring-2 ring-accent/20" : ""
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full ${meta.badge} flex items-center justify-center mx-auto mb-2`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{tab.count}</div>
                  <div className="text-xs text-muted-foreground">{tab.label}</div>
                </button>
              )
            })}
          </motion.div>

          {entriesError ? <p className="mb-4 text-sm text-rose-400">{entriesError}</p> : null}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start bg-transparent border-b border-border/50 p-0 mb-6 overflow-x-auto rounded-none h-auto">
              {tabs.map((tab) => {
                const Icon = tabMeta[tab.id].icon
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="flex items-center gap-2 px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {tab.count}
                    </span>
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-0">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  {loadingEntries ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="glass-card p-4 h-40 animate-pulse border border-white/5" />
                    ))
                  ) : tab.list.length > 0 ? (
                    tab.list.map((entry) => <AnimeCard key={entry.id} entry={entry} tabId={tab.id} />)
                  ) : (
                    <EmptyState
                      icon={tabMeta[tab.id].icon}
                      title={emptyCopy[tab.id]?.title || "Nothing here yet"}
                      description={emptyCopy[tab.id]?.desc || "Add titles and they'll show up here."}
                      action={
                        <>
                          <Button asChild>
                            <Link href="/search">Browse titles</Link>
                          </Button>
                          <Button asChild variant="outline">
                            <Link href="/onboarding">Import your list</Link>
                          </Button>
                        </>
                      }
                    />
                  )}
                </motion.div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>
    </div>
  )
}

export default function ListPage() {
  return (
    <RequireAuth>
      <ListPageContent />
    </RequireAuth>
  )
}
