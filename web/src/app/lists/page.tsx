"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Navigation } from "@/components/Navigation"
import RequireAuth from "@/components/RequireAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  BookMarked,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Share2,
  ChevronRight,
  Play,
  Star,
  Sparkles,
  Clock,
  PauseCircle,
  RotateCcw,
  Ban,
  Plus,
  Globe,
  Lock,
} from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Suspense } from "react"
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
      averageScore
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

const STATUS_LISTS = [
  {
    id: "watching",
    name: "Watching",
    description: "Currently watching and tracking progress.",
    icon: Play,
  },
  {
    id: "completed",
    name: "Completed",
    description: "All the shows and manga you finished.",
    icon: Star,
  },
  {
    id: "plan_to_watch",
    name: "Plan to Watch",
    description: "Titles queued up for later.",
    icon: Clock,
  },
  {
    id: "rewatching",
    name: "Rewatching",
    description: "Second runs and revisits.",
    icon: RotateCcw,
  },
  {
    id: "on_hold",
    name: "On Hold",
    description: "Paused for now, but not dropped.",
    icon: PauseCircle,
  },
  {
    id: "dropped",
    name: "Dropped",
    description: "Stopped watching or reading.",
    icon: Ban,
  },
]

const formatRelativeTime = (dateValue) => {
  if (!dateValue) return "No activity yet"
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return "No activity yet"

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

const Loading = () => null

export default function MyListsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [entries, setEntries] = useState([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [entriesError, setEntriesError] = useState("")
  const [activeListId, setActiveListId] = useState(null)
  const [customLists, setCustomLists] = useState([])
  const [customListItems, setCustomListItems] = useState({})
  const [loadingCustomLists, setLoadingCustomLists] = useState(true)
  const [customListsError, setCustomListsError] = useState("")
  const [activeCustomListId, setActiveCustomListId] = useState(null)
  const [createListOpen, setCreateListOpen] = useState(false)
  const [newListName, setNewListName] = useState("")
  const [newListDescription, setNewListDescription] = useState("")
  const [newListPublic, setNewListPublic] = useState(false)
  const [listSaving, setListSaving] = useState(false)
  const [customListItemPending, setCustomListItemPending] = useState({})
  const [selectedEntryId, setSelectedEntryId] = useState("")
  const { user } = useAuth()

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

      const { data, error } = await client
        .from("list_entries")
        .select("id, media_id, status, progress, media_type, updated_at")
        .eq("user_id", user.id)

      if (!isActive) return

      if (error) {
        console.error("Failed to load list entries:", error)
        setEntries([])
        setEntriesError("Could not load your lists yet.")
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
        console.error("Failed to hydrate list media:", err)
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

  const loadCustomLists = useCallback(async () => {
    if (!user) {
      setCustomLists([])
      setCustomListItems({})
      setLoadingCustomLists(false)
      return
    }

    setLoadingCustomLists(true)
    setCustomListsError("")

    const { data, error } = await client
      .from("custom_lists")
      .select("id, name, description, is_public, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("Failed to load custom lists:", error)
      setCustomLists([])
      setCustomListItems({})
      setCustomListsError("Could not load your custom lists yet.")
      setLoadingCustomLists(false)
      return
    }

    const lists = data || []
    if (lists.length === 0) {
      setCustomLists([])
      setCustomListItems({})
      setLoadingCustomLists(false)
      return
    }

    const listIds = lists.map((list) => list.id)
    const { data: listItems, error: listItemsError } = await client
      .from("custom_list_items")
      .select("id, list_id, media_id, media_type, added_at")
      .in("list_id", listIds)

    if (listItemsError) {
      console.error("Failed to load custom list items:", listItemsError)
      setCustomLists(lists)
      setCustomListItems({})
      setLoadingCustomLists(false)
      return
    }

    const items = listItems || []
    const mediaIds = Array.from(new Set(items.map((item) => item.media_id).filter(Boolean)))
    const mediaById = new Map()

    try {
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
    } catch (err) {
      console.error("Failed to hydrate custom list items:", err)
    }

    const itemsWithMedia = items.map((item) => ({
      ...item,
      media: mediaById.get(item.media_id) || null,
    }))

    const grouped = itemsWithMedia.reduce((acc, item) => {
      if (!acc[item.list_id]) acc[item.list_id] = []
      acc[item.list_id].push(item)
      return acc
    }, {})

    setCustomLists(lists)
    setCustomListItems(grouped)
    setLoadingCustomLists(false)
  }, [user])

  useEffect(() => {
    loadCustomLists()
  }, [loadCustomLists])

  useEffect(() => {
    setSelectedEntryId("")
  }, [activeCustomListId])

  const statusLists = useMemo(() => {
    return STATUS_LISTS.map((status) => {
      const listEntries = entries.filter((entry) => entry.status === status.id)
      const coverImages = listEntries
        .map((entry) => entry?.media?.coverImage?.large)
        .filter(Boolean)
        .slice(0, 4)
      const mostRecent = listEntries.reduce((latest, entry) => {
        if (!entry.updated_at) return latest
        if (!latest) return entry.updated_at
        return new Date(entry.updated_at) > new Date(latest) ? entry.updated_at : latest
      }, null)
      const animeCount = listEntries.filter((entry) => entry.media_type === "ANIME").length
      const mangaCount = listEntries.filter((entry) => entry.media_type === "MANGA").length

      return {
        ...status,
        entries: listEntries,
        coverImages,
        updatedAt: formatRelativeTime(mostRecent),
        animeCount,
        mangaCount,
        itemCount: listEntries.length,
      }
    })
  }, [entries])

  const customListsData = useMemo(() => {
    return customLists.map((list) => {
      const items = customListItems[list.id] || []
      const coverImages = items
        .map((item) => item?.media?.coverImage?.large)
        .filter(Boolean)
        .slice(0, 4)
      const mostRecent = items.reduce((latest, item) => {
        if (!item.added_at) return latest
        if (!latest) return item.added_at
        return new Date(item.added_at) > new Date(latest) ? item.added_at : latest
      }, null)
      return {
        ...list,
        entries: items,
        coverImages,
        updatedAt: formatRelativeTime(mostRecent),
        itemCount: items.length,
      }
    })
  }, [customLists, customListItems])

  const filteredStatusLists = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return statusLists
    return statusLists.filter((list) => {
      return list.name.toLowerCase().includes(query) || list.description.toLowerCase().includes(query)
    })
  }, [statusLists, searchQuery])

  const filteredCustomLists = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return customListsData
    return customListsData.filter((list) => {
      return (
        list.name.toLowerCase().includes(query) ||
        (list.description || "").toLowerCase().includes(query)
      )
    })
  }, [customListsData, searchQuery])

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
      .slice(0, 2)
  }, [entries])

  const topRated = useMemo(() => {
    const ranked = entries
      .filter((entry) => entry?.media?.averageScore)
      .sort((a, b) => (b.media?.averageScore || 0) - (a.media?.averageScore || 0))
    return ranked[0]
  }, [entries])

  const aiSuggestedLists = useMemo(() => {
    const suggestions = []
    if (topGenres[0]) {
      suggestions.push({
        name: `${topGenres[0].name} Gems`,
        reason: "Based on your top genre",
        count: topGenres[0].count,
        href: `/search?genres=${encodeURIComponent(topGenres[0].name)}`,
      })
    }
    if (topRated?.media?.title) {
      const title = topRated.media.title.english || topRated.media.title.romaji
      if (title) {
        suggestions.push({
          name: `Similar to ${title}`,
          reason: "Based on your ratings",
          count: "",
          href: `/search?query=${encodeURIComponent(title)}`,
        })
      }
    }
    return suggestions
  }, [topGenres, topRated])

  const handleCreateList = async () => {
    if (!user || !newListName.trim()) return
    setListSaving(true)
    const { data, error } = await client
      .from("custom_lists")
      .insert({
        user_id: user.id,
        name: newListName.trim(),
        description: newListDescription.trim() || null,
        is_public: newListPublic,
      })
      .select("id, name, description, is_public, created_at, updated_at")
      .single()

    if (error) {
      console.error("Failed to create custom list:", error)
      setListSaving(false)
      return
    }

    setCustomLists((prev) => [data, ...prev])
    setCustomListItems((prev) => ({ ...prev, [data.id]: [] }))
    setNewListName("")
    setNewListDescription("")
    setNewListPublic(false)
    setCreateListOpen(false)
    setListSaving(false)
  }

  const handleDeleteCustomList = async (listId) => {
    if (!user) return
    const { error } = await client
      .from("custom_lists")
      .delete()
      .eq("id", listId)
      .eq("user_id", user.id)
    if (error) {
      console.error("Failed to delete custom list:", error)
      return
    }
    setCustomLists((prev) => prev.filter((list) => list.id !== listId))
    setCustomListItems((prev) => {
      const next = { ...prev }
      delete next[listId]
      return next
    })
    if (activeCustomListId === listId) {
      setActiveCustomListId(null)
    }
  }

  const handleAddCustomListItem = async () => {
    if (!user || !activeCustomListId || !selectedEntryId) return
    const entryId = selectedEntryId
    const entry = entries.find((item) => String(item.media_id) === entryId)
    if (!entry) return

    setCustomListItemPending((prev) => ({ ...prev, [entryId]: true }))
    const { data, error } = await client
      .from("custom_list_items")
      .insert({
        list_id: activeCustomListId,
        media_id: entry.media_id,
        media_type: entry.media_type || "ANIME",
      })
      .select("id, list_id, media_id, media_type, added_at")
      .single()

    if (error) {
      console.error("Failed to add to custom list:", error)
      setCustomListItemPending((prev) => ({ ...prev, [entryId]: false }))
      return
    }

    const itemWithMedia = { ...data, media: entry.media || null }
    setCustomListItems((prev) => {
      const next = { ...prev }
      next[activeCustomListId] = [itemWithMedia, ...(next[activeCustomListId] || [])]
      return next
    })
    setSelectedEntryId("")
    setCustomListItemPending((prev) => ({ ...prev, [entryId]: false }))
  }

  const handleRemoveCustomListItem = async (itemId, listId) => {
    if (!user) return
    setCustomListItemPending((prev) => ({ ...prev, [itemId]: true }))
    const { error } = await client
      .from("custom_list_items")
      .delete()
      .eq("id", itemId)
    if (error) {
      console.error("Failed to remove custom list item:", error)
      setCustomListItemPending((prev) => ({ ...prev, [itemId]: false }))
      return
    }
    setCustomListItems((prev) => {
      const next = { ...prev }
      next[listId] = (next[listId] || []).filter((item) => item.id !== itemId)
      return next
    })
    setCustomListItemPending((prev) => ({ ...prev, [itemId]: false }))
  }

  const handleShareCustomList = async (list) => {
    if (typeof window === "undefined") return
    const shareUrl = `${window.location.origin}/lists/${list.id}`
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch (error) {
      console.error("Failed to copy share link:", error)
    }
  }

  const activeList = useMemo(
    () => statusLists.find((list) => list.id === activeListId),
    [activeListId, statusLists],
  )

  const activeCustomList = useMemo(
    () => customListsData.find((list) => list.id === activeCustomListId),
    [activeCustomListId, customListsData],
  )

  const totalListCount = statusLists.length + customLists.length

  return (
    <Suspense fallback={<Loading />}>
      <RequireAuth>
        <div className="min-h-screen bg-background noise-overlay">
          <Navigation />

        <main className="pb-24 pt-24 md:pb-8">
          <div className="px-4 py-8 md:px-8">
            <div className="mx-auto max-w-5xl">
              {/* Header */}
              <div
                className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                style={{
                  animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
                    <BookMarked className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground md:text-3xl">My Lists</h1>
                    <p className="text-muted-foreground">{totalListCount} lists tracked</p>
                  </div>
                </div>
                <Button
                  onClick={() => setCreateListOpen(true)}
                  className="gap-2 rounded-full px-4"
                >
                  <Plus className="h-4 w-4" />
                  Create List
                </Button>
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
                <CardContent className="p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search your lists..."
                      className="pl-9 bg-background/50 border-border/50"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* AI Suggested Lists */}
              <Card
                className="mb-8 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-violet-500/10 border-violet-500/20"
                style={{
                  animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                  animationDelay: "150ms",
                  opacity: 0,
                }}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-violet-400" />
                    AI Suggested Lists
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {aiSuggestedLists.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Suggestions will appear after you track more titles.
                    </div>
                  ) : (
                    aiSuggestedLists.map((list) => (
                      <Link
                        key={list.name}
                        href={list.href}
                        className="flex items-center gap-3 p-3 rounded-xl bg-background/50 hover:bg-background/80 border border-border/50 hover:border-violet-500/30 transition-all text-left group"
                      >
                        <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Sparkles className="h-5 w-5 text-violet-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground group-hover:text-violet-400 transition-colors">
                            {list.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {list.reason} {list.count ? `- ${list.count} titles` : ""}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Custom Lists */}
              <div
                className="mb-8"
                style={{
                  animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                  animationDelay: "180ms",
                  opacity: 0,
                }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Custom Lists</h2>
                    <p className="text-sm text-muted-foreground">
                      Curate playlists like "Beginner Anime" or "Cozy Nights".
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {customLists.length} created
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {loadingCustomLists ? (
                    <Card className="bg-card/50 border-border/50">
                      <CardContent className="py-10 text-center text-muted-foreground">
                        <BookMarked className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                        <p>Loading custom lists...</p>
                      </CardContent>
                    </Card>
                  ) : customListsError ? (
                    <Card className="bg-card/50 border-border/50">
                      <CardContent className="py-10 text-center text-muted-foreground">
                        <BookMarked className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                        <p>{customListsError}</p>
                      </CardContent>
                    </Card>
                  ) : filteredCustomLists.length === 0 ? (
                    <Card className="bg-card/50 border-border/50">
                      <CardContent className="py-10 text-center text-muted-foreground">
                        <BookMarked className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                        <p>No custom lists yet.</p>
                        <Button
                          size="sm"
                          className="mt-3"
                          onClick={() => setCreateListOpen(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Create your first list
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredCustomLists.map((list) => (
                      <Card
                        key={list.id}
                        className="bg-card/50 border-border/50 overflow-hidden group hover:border-primary/30 transition-all duration-300"
                      >
                        <button
                          type="button"
                          onClick={() => setActiveCustomListId(list.id)}
                          className="block w-full text-left"
                        >
                          <div className="relative h-28 overflow-hidden">
                            <div className="absolute inset-0 grid grid-cols-4 gap-0.5">
                              {list.coverImages.slice(0, 4).map((img, i) => (
                                <div key={i} className="relative overflow-hidden">
                                  <img
                                    src={img || "/placeholder.svg"}
                                    alt=""
                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                  />
                                </div>
                              ))}
                              {list.coverImages.length < 4 &&
                                Array.from({ length: 4 - list.coverImages.length }).map((_, i) => (
                                  <div key={`custom-empty-${i}`} className="bg-secondary" />
                                ))}
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                            <div className="absolute top-2 right-2">
                              <Badge variant="secondary" className="gap-1">
                                {list.is_public ? (
                                  <Globe className="h-3 w-3" />
                                ) : (
                                  <Lock className="h-3 w-3" />
                                )}
                                {list.is_public ? "Public" : "Private"}
                              </Badge>
                            </div>
                          </div>
                        </button>

                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setActiveCustomListId(list.id)}
                              className="flex-1 text-left"
                            >
                              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                {list.name}
                              </h3>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                                {list.description || "Custom playlist."}
                              </p>
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleShareCustomList(list)}>
                                  <Share2 className="h-4 w-4 mr-2" />
                                  Copy Share Link
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteCustomList(list.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                            <span>{list.itemCount} titles</span>
                            <span>Updated {list.updatedAt}</span>
                          </div>

                          <div className="mt-4">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="w-full"
                              onClick={() => setActiveCustomListId(list.id)}
                            >
                              View List
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>

              {/* Lists Grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                {loadingEntries ? (
                  <Card className="bg-card/50 border-border/50">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <BookMarked className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>Loading your lists...</p>
                    </CardContent>
                  </Card>
                ) : entriesError ? (
                  <Card className="bg-card/50 border-border/50">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <BookMarked className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>{entriesError}</p>
                    </CardContent>
                  </Card>
                ) : filteredStatusLists.length === 0 ? (
                  <Card className="bg-card/50 border-border/50">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <BookMarked className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>No lists match your search.</p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredStatusLists.map((list, index) => {
                    const Icon = list.icon

                    return (
                      <Card
                        key={list.id}
                        className="bg-card/50 border-border/50 overflow-hidden group hover:border-primary/30 transition-all duration-300"
                        style={{
                          animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                          animationDelay: `${200 + index * 80}ms`,
                          opacity: 0,
                        }}
                      >
                        {/* Cover Images Grid */}
                        <button
                          type="button"
                          onClick={() => setActiveListId(list.id)}
                          className="block w-full text-left"
                        >
                          <div className="relative h-32 overflow-hidden">
                            <div className="absolute inset-0 grid grid-cols-4 gap-0.5">
                              {list.coverImages.slice(0, 4).map((img, i) => (
                                <div key={i} className="relative overflow-hidden">
                                  <img
                                    src={img || "/placeholder.svg"}
                                    alt=""
                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                                  />
                                </div>
                              ))}
                              {list.coverImages.length < 4 &&
                                Array.from({ length: 4 - list.coverImages.length }).map((_, i) => (
                                  <div key={`empty-${i}`} className="bg-secondary" />
                                ))}
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />

                            <div className="absolute top-2 right-2">
                              <Badge variant="secondary" className="gap-1">
                                <Icon className="h-3 w-3" />
                                {list.name}
                              </Badge>
                            </div>
                          </div>
                        </button>

                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <button
                              type="button"
                              onClick={() => setActiveListId(list.id)}
                              className="flex-1 text-left"
                            >
                              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                {list.name}
                              </h3>
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                {list.description}
                              </p>
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit List
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Share2 className="h-4 w-4 mr-2" />
                                  Share
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Play className="h-3 w-3" />
                              {list.animeCount} anime
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              {list.mangaCount} manga
                            </span>
                            <span>Updated {list.updatedAt}</span>
                          </div>

                          <div className="mt-4">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="w-full"
                              onClick={() => setActiveListId(list.id)}
                            >
                              View List
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </main>

        <Dialog
          open={Boolean(activeList || activeCustomList)}
          onOpenChange={() => {
            setActiveListId(null)
            setActiveCustomListId(null)
            setSelectedEntryId("")
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            {activeCustomList ? (
              <>
                <DialogHeader>
                  <DialogTitle>{activeCustomList.name}</DialogTitle>
                  <DialogDescription>{activeCustomList.description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  {activeCustomList.entries.length ? (
                    activeCustomList.entries.map((entry) => {
                      const title =
                        entry?.media?.title?.english ||
                        entry?.media?.title?.romaji ||
                        "Unknown title"
                      const coverImage = entry?.media?.coverImage?.large || "/placeholder.svg"

                      return (
                        <div
                          key={entry.id}
                          className="flex items-center gap-4 rounded-xl border border-border/50 bg-card/60 p-3"
                        >
                          <img
                            src={coverImage}
                            alt={title}
                            className="h-16 w-12 rounded-lg object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{title}</p>
                            <p className="text-xs text-muted-foreground">
                              {entry.media_type || "ANIME"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link href={`/media/${entry.media_id}`}>
                              <Button size="sm" variant="secondary">
                                Open
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveCustomListItem(entry.id, activeCustomList.id)}
                              disabled={customListItemPending[entry.id]}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-sm text-muted-foreground">No titles in this list yet.</div>
                  )}

                  <div className="rounded-xl border border-border/50 bg-card/40 p-4">
                    <p className="text-sm font-medium text-foreground mb-2">Add from your library</p>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                      <select
                        value={selectedEntryId}
                        onChange={(event) => setSelectedEntryId(event.target.value)}
                        className="h-9 w-full rounded-md border border-border/50 bg-background/50 px-3 text-sm text-foreground"
                      >
                        <option value="">Select a title</option>
                        {entries
                          .filter((entry) =>
                            !(activeCustomList.entries || []).some(
                              (item) => item.media_id === entry.media_id,
                            ),
                          )
                          .map((entry) => {
                            const title =
                              entry?.media?.title?.english ||
                              entry?.media?.title?.romaji ||
                              "Unknown title"
                            return (
                              <option key={entry.media_id} value={entry.media_id}>
                                {title}
                              </option>
                            )
                          })}
                      </select>
                      <Button
                        size="sm"
                        onClick={handleAddCustomListItem}
                        disabled={!selectedEntryId || customListItemPending[selectedEntryId]}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>{activeList?.name || "List"}</DialogTitle>
                  <DialogDescription>{activeList?.description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  {activeList?.entries?.length ? (
                    activeList.entries.map((entry) => {
                      const title =
                        entry?.media?.title?.english ||
                        entry?.media?.title?.romaji ||
                        "Unknown title"
                      const coverImage = entry?.media?.coverImage?.large || "/placeholder.svg"
                      const isManga = entry?.media_type === "MANGA"
                      const totalUnits = isManga
                        ? entry?.media?.chapters ?? null
                        : entry?.media?.episodes ?? null
                      const progress = entry?.progress ?? 0

                      return (
                        <div
                          key={entry.id}
                          className="flex items-center gap-4 rounded-xl border border-border/50 bg-card/60 p-3"
                        >
                          <img
                            src={coverImage}
                            alt={title}
                            className="h-16 w-12 rounded-lg object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{title}</p>
                            <p className="text-xs text-muted-foreground">
                              {isManga ? "Chapter" : "Episode"} {progress}
                              {totalUnits ? ` / ${totalUnits}` : ""}
                            </p>
                          </div>
                          <Link href={`/media/${entry.media_id}`}>
                            <Button size="sm" variant="secondary">
                              Open
                            </Button>
                          </Link>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-sm text-muted-foreground">No titles in this list yet.</div>
                  )}
                </div>
              </>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setActiveListId(null)
                  setActiveCustomListId(null)
                  setSelectedEntryId("")
                }}
                className="bg-transparent"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={createListOpen} onOpenChange={setCreateListOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create a custom list</DialogTitle>
              <DialogDescription>Group titles into shareable playlists.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">List name</label>
                <Input
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                  placeholder="Beginner Anime"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <textarea
                  value={newListDescription}
                  onChange={(event) => setNewListDescription(event.target.value)}
                  placeholder="Perfect starter shows for new anime fans."
                  className="h-24 w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/40 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Public list</p>
                  <p className="text-xs text-muted-foreground">
                    Enable sharing to friends later.
                  </p>
                </div>
                <Switch checked={newListPublic} onCheckedChange={setNewListPublic} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateListOpen(false)} className="bg-transparent">
                Cancel
              </Button>
              <Button onClick={handleCreateList} disabled={!newListName.trim() || listSaving}>
                {listSaving ? "Creating..." : "Create List"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </RequireAuth>
    </Suspense>
  )
}
