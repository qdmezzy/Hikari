"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Navigation } from "@/components/layout/Navigation"
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
import { Input } from "@/components/ui/input"
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
import { WatchNextSection } from "@/components/lists/WatchNextSection"

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

function TrackingEntryRow({ entry, tabId, pendingId, onIncrement, onUpdate, onRemove }) {
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
  // updated_at is bumped by imports and edits, not just watching — so only
  // treat it as real watch/read activity when it lands meaningfully after the
  // entry was added. Otherwise an imported list would falsely read
  // "Last watched today" on every title.
  const createdMs = entry?.created_at ? new Date(entry.created_at).getTime() : 0
  const updatedMs = entry?.updated_at ? new Date(entry.updated_at).getTime() : 0
  const hasProgressActivity = createdMs > 0 && updatedMs - createdMs > 120_000
  const lastActivityVerb = isMangaEntry(entry) ? "Last read" : "Last watched"
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
        ? hasProgressActivity && lastWatchedOn
          ? `${lastActivityVerb} ${lastWatchedOn}`
          : addedOn
            ? `Added ${addedOn}`
            : `Added ${addedLabel || "recently"}`
        : addedOn
          ? `Added ${addedOn}`
          : `Added ${addedLabel || "recently"}`

  return <article className="hk-library-entry">
    <Link className="hk-library-cover" href={`/media/${entry.media_id}`} aria-label={title}><Image src={cover} alt="" fill sizes="48px" /></Link>
    <div className="hk-library-title"><Link href={`/media/${entry.media_id}`}><h3>{title}</h3></Link><p>{isMangaEntry(entry) ? "Manga" : "Anime"}{mediaStatusLabel ? ` · ${mediaStatusLabel}` : ""} · {detailText}</p></div>
    <div className="hk-library-progress"><span>{shortUnitLabel} <strong>{progress}</strong>{episodeCount ? ` / ${episodeCount}` : ""}</span>{episodeCount ? <Progress value={progressValue} aria-label={`${title} progress`} className="h-1" /> : null}</div>
    <div className="hk-library-score"><Star size={12} /><span>{score || "—"}</span></div>
    <div className="hk-library-actions">{tabId === "watching" || tabId === "paused" ? <Button size="icon" variant="outline" disabled={isPending} onClick={() => onIncrement(entry)} aria-label={`Add one ${unitLabel} to ${title}`}><Plus size={15} /></Button> : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="flex-shrink-0 h-8 w-8 p-0" disabled={isPending} aria-label={`Actions for ${title}`}>
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
                  <DropdownMenuItem onClick={() => onIncrement(entry)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add 1 {unitLabel}
                  </DropdownMenuItem>
                )}
                {entry.status !== "watching" && (
                  <DropdownMenuItem onClick={() => onUpdate(entry, { status: "watching" })}>
                    <Play className="w-4 h-4 mr-2" />
                    Move to {isMangaEntry(entry) ? "reading" : "watching"}
                  </DropdownMenuItem>
                )}
                {entry.status !== "completed" && (
                  <DropdownMenuItem
                    onClick={() =>
                      onUpdate(entry, {
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
                  <DropdownMenuItem onClick={() => onUpdate(entry, { status: "plan_to_watch" })}>
                    <ListPlus className="w-4 h-4 mr-2" />
                    Move to plan to {isMangaEntry(entry) ? "read" : "watch"}
                  </DropdownMenuItem>
                )}
                {entry.status !== "on_hold" && (
                  <DropdownMenuItem onClick={() => onUpdate(entry, { status: "on_hold" })}>
                    <Pause className="w-4 h-4 mr-2" />
                    Put on hold
                  </DropdownMenuItem>
                )}
                {entry.status !== "dropped" && (
                  <DropdownMenuItem onClick={() => onUpdate(entry, { status: "dropped" })}>
                    <XCircle className="w-4 h-4 mr-2" />
                    Mark dropped
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => onRemove(entry)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove from list
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
    </div>
  </article>
}

function ListPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [removeTarget, setRemoveTarget] = useState<any>(null)
  const statusParam = searchParams.get("status")

  const initialTab = statusParam ? statusToTab[statusParam] || "watching" : "watching"

  const libraryView = searchParams.get("view") === "collections" ? "collections" : "titles"
  const [listQuery, setListQuery] = useState("")
  const changeView = (view: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("view", view)
    router.replace(`/lists?${params.toString()}`, { scroll: false })
  }
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
      if (updates.status === "completed" && !Number(entry.score)) {
        // Finishing something unrated is the moment people actually rate —
        // and every score makes the recommendations smarter.
        const title = getMediaTitle(entry.media)
        toast.success(`Finished ${title}! 🎉`, {
          description: "How was it? Give it a score.",
          action: {
            label: "Rate it",
            onClick: () => router.push(`/media/${entry.media_id}`),
          },
          duration: 8000,
        })
      } else if (updates.progress !== undefined && updates.status !== "completed") {
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


  return (
    <div className="hikari-revamp rv-library min-h-screen">
      <Navigation />

      <main className="rv-container rv-main">
        <div className="mx-auto">
          <header className="rv-page-heading">
            <div><p className="hk-page-jp" lang="ja">マイリスト</p><h1>My List</h1><p>Track episodes and chapters, or organize your collections.</p></div>
            <Button variant="outline" asChild><Link href="/search"><Plus size={16} />Find a title</Link></Button>
          </header>
          <div className="rv-tabs" aria-label="Library views">
            <button type="button" aria-pressed={libraryView === "titles"} onClick={() => changeView("titles")}>Tracking <small>{entries.length}</small></button>
            <button type="button" aria-pressed={libraryView === "collections"} onClick={() => changeView("collections")}>Collections</button>
          </div>
          {libraryView === "collections" ? <CollectionsSection user={user} /> : <>
          <div className="rv-library-search"><Input aria-label="Search your tracking list" placeholder="Find something in your list…" value={listQuery} onChange={event => setListQuery(event.target.value)} /><Link href="/onboarding" className="ml-auto text-xs text-muted-foreground hover:text-foreground">Import a list</Link></div>
          {entriesError ? <p className="mb-4 text-sm text-rose-400">{entriesError}</p> : null}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="hk-tracking-layout">
            <TabsList className="hk-tracking-statuses">
              {tabs.map((tab) => {
                const Icon = tabMeta[tab.id].icon
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="flex items-center gap-2 px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{({watching:"In progress",completed:"Completed",planned:"Planned",paused:"On hold",dropped:"Dropped"})[tab.id]}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {tab.count}
                    </span>
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-0">
                {tab.id === "planned" && !loadingEntries && entries.length ? (
                  <WatchNextSection entries={entries} />
                ) : null}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  {loadingEntries ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="hikari-panel p-4 h-40 animate-pulse border border-white/5" />
                    ))
                  ) : tab.list.length > 0 ? (
                    tab.list.filter(entry => getMediaTitle(entry.media).toLowerCase().includes(listQuery.trim().toLowerCase())).length ? tab.list.filter(entry => getMediaTitle(entry.media).toLowerCase().includes(listQuery.trim().toLowerCase())).map((entry) => <TrackingEntryRow key={entry.id} entry={entry} tabId={tab.id} pendingId={pendingId} onIncrement={handleIncrement} onUpdate={updateEntry} onRemove={setRemoveTarget} />) : <div className="rv-empty"><h3>No matching titles</h3><p>Try another search in this status.</p><Button variant="outline" onClick={() => setListQuery("")}>Clear search</Button></div>
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
          </>}
        </div>
      </main>
      <Dialog open={Boolean(removeTarget)} onOpenChange={open => { if (!open) setRemoveTarget(null) }}>
        <DialogContent><DialogTitle>Remove this title?</DialogTitle><DialogDescription>{removeTarget ? getMediaTitle(removeTarget.media) : "This title"} will leave your tracking list, including its progress and score. Your collections are separate.</DialogDescription><DialogFooter><Button variant="outline" onClick={() => setRemoveTarget(null)}>Keep title</Button><Button variant="destructive" disabled={Boolean(pendingId)} onClick={async () => { await handleRemove(removeTarget); setRemoveTarget(null) }}>Remove from list</Button></DialogFooter></DialogContent>
      </Dialog>
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
