"use client"

import { useEffect, useMemo, useState } from "react"
import { Navigation } from "@/components/layout/Navigation"
import RequireAuth from "@/components/common/RequireAuth"
import { EmptyState } from "@/components/common/EmptyState"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Bookmark, Search, Grid3X3, List, Play, Trash2, SortAsc, Calendar } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"

type SavedClip = {
  id: string
  media_id: number
  trailer_id: string
  media_title: string
  thumbnail_url: string | null
  clip_type: string | null
  created_at: string
}

const formatDate = (value: string) => {
  if (!value) return ""
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function FavoritesPage() {
  const { user } = useAuth()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("Recently Saved")
  const [savedClips, setSavedClips] = useState<SavedClip[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setSavedClips([])
      setLoading(false)
      return
    }

    let active = true

    const loadSaved = async () => {
      setLoading(true)
      setLoadError("")
      const { data, error } = await client
        .from("saved_clips")
        .select("id, media_id, trailer_id, media_title, thumbnail_url, clip_type, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (!active) return

      if (error) {
        console.error("Failed to load saved clips:", error)
        setLoadError("Could not load saved clips.")
        setLoading(false)
        return
      }

      setSavedClips(data || [])
      setLoading(false)
    }

    loadSaved()

    return () => {
      active = false
    }
  }, [user])

  const handleRemove = async (clipId: string) => {
    if (!user) return
    setRemovingId(clipId)
    const { error } = await client.from("saved_clips").delete().eq("id", clipId).eq("user_id", user.id)
    if (!error) {
      setSavedClips((prev) => prev.filter((clip) => clip.id !== clipId))
    }
    setRemovingId(null)
  }

  const filteredClips = useMemo(() => {
    return savedClips.filter((clip) =>
      (clip.media_title || "").toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [savedClips, searchQuery])

  const sortedClips = useMemo(() => {
    const next = [...filteredClips]
    switch (sortBy) {
      case "Alphabetical":
        return next.sort((a, b) => (a.media_title || "").localeCompare(b.media_title || ""))
      case "Recently Saved":
      default:
        return next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
  }, [filteredClips, sortBy])

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background noise-overlay">
        <Navigation />

      <main className="pb-24 pt-24 md:pb-8">
        <div className="px-4 py-8 md:px-8">
          <div className="mx-auto max-w-6xl">
            <div
              className="mb-8"
              style={{
                animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/25">
                  <Bookmark className="h-6 w-6 text-white" fill="white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground md:text-3xl">Saved Clips</h1>
                  <p className="text-muted-foreground">{savedClips.length} trailers saved</p>
                </div>
              </div>
            </div>

            <Card
              className="mb-6 bg-card/50 border-border/50"
              style={{
                animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                animationDelay: "100ms",
                opacity: 0,
              }}
            >
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="relative flex-1 min-w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search saved clips..."
                    className="pl-9 bg-background/50 border-border/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                      <SortAsc className="h-4 w-4" />
                      {sortBy}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {["Recently Saved", "Alphabetical"].map((option) => (
                      <DropdownMenuItem key={option} onClick={() => setSortBy(option)}>
                        {option}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 transition-all duration-300",
                      viewMode === "grid" && "bg-background shadow-sm",
                    )}
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 transition-all duration-300",
                      viewMode === "list" && "bg-background shadow-sm",
                    )}
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {loading && (
              <Card className="bg-card/50 border-border/50">
                <CardContent className="py-16 text-center text-muted-foreground">
                  Loading saved clips...
                </CardContent>
              </Card>
            )}

            {!loading && loadError && (
              <Card className="bg-card/50 border-border/50">
                <CardContent className="py-16 text-center text-muted-foreground">
                  {loadError}
                </CardContent>
              </Card>
            )}

            {!loading && !loadError && sortedClips.length === 0 && (
              <EmptyState
                icon={Bookmark}
                title="No saved clips yet"
                description="Save trailers and clips from Discover to keep them here for later."
                action={
                  <Button asChild>
                    <Link href="/discover">Discover trailers</Link>
                  </Button>
                }
              />
            )}

            {!loading && !loadError && sortedClips.length > 0 && (
              <>
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {sortedClips.map((clip, index) => (
                      <Link
                        key={clip.id}
                        href={`/media/${clip.media_id}`}
                        className="group relative"
                        style={{
                          animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                          animationDelay: `${150 + index * 50}ms`,
                          opacity: 0,
                        }}
                      >
                        <div className="relative aspect-[3/4] overflow-hidden rounded-xl">
                          <img
                            src={clip.thumbnail_url || "/placeholder.svg"}
                            alt={clip.media_title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                          <div
                            className={cn(
                              "absolute inset-0 flex items-center justify-center gap-2 bg-black/60 transition-all duration-300",
                              "opacity-0 group-hover:opacity-100",
                            )}
                          >
                            <Button
                              size="icon"
                              className="h-10 w-10 rounded-full bg-primary/90 hover:bg-primary shadow-lg"
                            >
                              <Play className="h-5 w-5" fill="white" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-10 w-10 rounded-full bg-background/20 backdrop-blur border-white/20 hover:bg-destructive hover:border-destructive text-white"
                              disabled={removingId === clip.id}
                              onClick={(e) => {
                                e.preventDefault()
                                handleRemove(clip.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="absolute top-2 right-2">
                            <Badge className="bg-black/60 text-white border-white/10">{clip.clip_type || "Trailer"}</Badge>
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <h3 className="font-semibold text-white text-sm line-clamp-2 mb-1">{clip.media_title}</h3>
                            <div className="flex items-center gap-2 text-xs text-white/70">
                              <Calendar className="h-3 w-3" />
                              Saved {formatDate(clip.created_at)}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedClips.map((clip, index) => (
                      <Card
                        key={clip.id}
                        className="bg-card/50 border-border/50 overflow-hidden group hover:border-primary/30 transition-all duration-300"
                        style={{
                          animation: "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                          animationDelay: `${150 + index * 50}ms`,
                          opacity: 0,
                        }}
                      >
                        <CardContent className="flex items-center gap-4 p-4">
                          <Link href={`/media/${clip.media_id}`} className="relative shrink-0">
                            <img
                              src={clip.thumbnail_url || "/placeholder.svg"}
                              alt={clip.media_title}
                              className="h-20 w-14 rounded-lg object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          </Link>

                          <div className="flex-1 min-w-0">
                            <Link href={`/media/${clip.media_id}`}>
                              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                {clip.media_title}
                              </h3>
                            </Link>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge className="bg-black/60 text-white border-white/10">{clip.clip_type || "Trailer"}</Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Saved {formatDate(clip.created_at)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Link href={`/media/${clip.media_id}`}>
                              <Button size="sm" className="gap-1 bg-gradient-to-r from-primary to-accent hover:opacity-90">
                                <Play className="h-3 w-3" fill="white" />
                                View
                              </Button>
                            </Link>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              disabled={removingId === clip.id}
                              onClick={() => handleRemove(clip.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      </div>
    </RequireAuth>
  )
}
