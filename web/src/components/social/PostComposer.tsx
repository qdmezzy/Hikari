"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Film,
  BarChart2,
  Link2,
  AlertTriangle,
  Users,
  X,
  Plus,
  List,
} from "lucide-react"
import { cn } from "@/lib/utils"

const MEDIA_SEARCH = `
query ($search: String, $perPage: Int) {
  Page(perPage: $perPage) {
    media(search: $search, sort: POPULARITY_DESC) {
      id
      type
      title { romaji english }
      coverImage { large }
    }
  }
}
`

const postCategories = ["Text", "Art", "Hot Takes", "Questions", "Reviews", "Memes"]

type MediaOption = {
  id: number
  title: string
  type: string
  coverImage?: string
}

type ListOption = {
  id: string
  name: string
  is_public?: boolean
}

type PostComposerProps = {
  onCreate?: (payload: {
    content: string
    fandom?: string | null
    attachedMedia?: MediaOption | null
    attachedList?: ListOption | null
    hasSpoilers?: boolean
    spoilerRange?: string | null
    pollOptions?: string[]
    clipUrl?: string
    postToDiscover?: boolean
    postType?: string
  }) => void
  availableFandoms?: string[]
  availableLists?: ListOption[]
  isAuthenticated?: boolean
  avatarUrl?: string
  avatarInitial?: string
}

export function PostComposer({
  onCreate,
  availableFandoms = [],
  availableLists = [],
  isAuthenticated = false,
  avatarUrl,
  avatarInitial = "U",
}: PostComposerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [content, setContent] = useState("")
  const [fandomInput, setFandomInput] = useState("")
  const [attachedMedia, setAttachedMedia] = useState<MediaOption | null>(null)
  const [attachedList, setAttachedList] = useState<ListOption | null>(null)
  const [postCategory, setPostCategory] = useState("Text")
  const [hasSpoilers, setHasSpoilers] = useState(false)
  const [spoilerEpisode, setSpoilerEpisode] = useState("")
  const [showPoll, setShowPoll] = useState(false)
  const [pollOptions, setPollOptions] = useState(["", ""])
  const [showClip, setShowClip] = useState(false)
  const [clipLink, setClipLink] = useState("")
  const [postToDiscover, setPostToDiscover] = useState(false)
  const [mediaQuery, setMediaQuery] = useState("")
  const [mediaResults, setMediaResults] = useState<MediaOption[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaError, setMediaError] = useState("")
  const [listQuery, setListQuery] = useState("")

  const fandomOptions = useMemo(() => {
    const set = new Set(
      [...availableFandoms, attachedMedia?.title].filter((value) => Boolean(value)),
    )
    return Array.from(set)
  }, [availableFandoms, attachedMedia])

  const filteredLists = useMemo(() => {
    const query = listQuery.trim().toLowerCase()
    if (!query) return availableLists
    return availableLists.filter((list) => list.name.toLowerCase().includes(query))
  }, [availableLists, listQuery])

  useEffect(() => {
    if (!isExpanded) return
    const query = mediaQuery.trim()
    if (query.length < 2) {
      setMediaResults([])
      setMediaError("")
      setMediaLoading(false)
      return
    }

    let active = true
    setMediaLoading(true)
    setMediaError("")

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/anilist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: MEDIA_SEARCH,
            variables: { search: query, perPage: 6 },
          }),
        })
        const json = await res.json()
        if (!res.ok || json?.errors) {
          throw new Error(json?.errors?.[0]?.message || "Search failed")
        }
        const media = json?.data?.Page?.media || []
        if (!active) return
        const mapped = media.map((item) => ({
          id: item.id,
          title: item.title?.english || item.title?.romaji || "Untitled",
          type: item.type,
          coverImage: item.coverImage?.large || "",
        }))
        setMediaResults(mapped)
      } catch (error) {
        if (!active) return
        setMediaError("Could not load matches.")
        setMediaResults([])
      } finally {
        if (active) setMediaLoading(false)
      }
    }, 300)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [mediaQuery, isExpanded])

  const resetComposer = () => {
    setContent("")
    setFandomInput("")
    setAttachedMedia(null)
    setAttachedList(null)
    setPostCategory("Text")
    setHasSpoilers(false)
    setSpoilerEpisode("")
    setShowPoll(false)
    setPollOptions(["", ""])
    setShowClip(false)
    setClipLink("")
    setPostToDiscover(false)
    setIsExpanded(false)
    setMediaQuery("")
    setMediaResults([])
    setListQuery("")
  }

  const handlePost = () => {
    if (!isAuthenticated || !content.trim() || !onCreate) return
    const trimmedContent = content.trim()
    const trimmedFandom = fandomInput.trim()
    const filteredPolls = pollOptions.map((item) => item.trim()).filter(Boolean)
    const spoilerRange = hasSpoilers ? spoilerEpisode.trim() || null : null
    const clipUrl = showClip ? clipLink.trim() : ""
    const normalizedCategory = postCategory.trim().toLowerCase().replace(/\s+/g, "-") || "text"
    const postType =
      filteredPolls.length >= 2
        ? "poll"
        : clipUrl
          ? "clip"
          : attachedList
            ? "list"
            : normalizedCategory

    onCreate({
      content: trimmedContent,
      fandom: trimmedFandom || null,
      attachedMedia,
      attachedList,
      hasSpoilers,
      spoilerRange,
      pollOptions: filteredPolls,
      clipUrl,
      postToDiscover: Boolean(clipUrl) && postToDiscover,
      postType,
    })

    resetComposer()
  }

  const selectMedia = (media: MediaOption) => {
    setAttachedMedia(media)
    setMediaQuery("")
    setMediaResults([])
    if (!fandomInput.trim()) {
      setFandomInput(media.title)
    }
  }

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-zinc-950/80 via-zinc-950/60 to-fuchsia-500/10 shadow-xl shadow-black/30">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.18),_transparent_60%)]" />
      <CardContent className="relative p-5">
        <div className="flex gap-3">
          <Avatar className="h-9 w-9 flex-shrink-0">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="Profile avatar" /> : null}
            <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-500 text-white text-sm">
              {avatarInitial}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <Textarea
              placeholder={isAuthenticated ? "Share your thoughts on an anime..." : "Sign in to start posting..."}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => {
                if (isAuthenticated) setIsExpanded(true)
              }}
              disabled={!isAuthenticated}
              className={cn(
                "resize-none border border-white/10 bg-black/40 focus-visible:ring-1 focus-visible:ring-pink-500/40 transition-all text-sm placeholder:text-white/40",
                isExpanded ? "min-h-20" : "min-h-9",
              )}
            />

            {(fandomInput || attachedMedia || attachedList) && (
              <div className="flex flex-wrap gap-1.5 animate-in fade-in duration-200">
                {fandomInput && (
                  <Badge variant="secondary" className="gap-1 text-xs bg-white/10 border border-white/10">
                    <Users className="h-3 w-3" />
                    {fandomInput}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-red-400 transition-colors"
                      onClick={() => setFandomInput("")}
                    />
                  </Badge>
                )}
                {attachedMedia && (
                  <Badge variant="secondary" className="gap-1 text-xs bg-white/10 border border-white/10">
                    <Film className="h-3 w-3" />
                    {attachedMedia.title}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-red-400 transition-colors"
                      onClick={() => setAttachedMedia(null)}
                    />
                  </Badge>
                )}
                {attachedList && (
                  <Badge variant="secondary" className="gap-1 text-xs bg-white/10 border border-white/10">
                    <List className="h-3 w-3" />
                    {attachedList.name}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-red-400 transition-colors"
                      onClick={() => setAttachedList(null)}
                    />
                  </Badge>
                )}
              </div>
            )}

            {showPoll && isExpanded && (
              <div className="space-y-2 rounded-xl bg-black/40 border border-white/10 p-3 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Create Poll</span>
                  <X
                    className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPoll(false)}
                  />
                </div>
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...pollOptions]
                        newOptions[index] = e.target.value
                        setPollOptions(newOptions)
                      }}
                      className="bg-black/40 border-white/10 h-8 text-sm"
                    />
                    {pollOptions.length > 2 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 4 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    className="gap-1 h-7 text-xs"
                  >
                    <Plus className="h-3 w-3" />
                    Add Option
                  </Button>
                )}
              </div>
            )}

            {showClip && isExpanded && (
              <div className="space-y-2 rounded-xl bg-black/40 border border-white/10 p-3 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Clip Link</span>
                  <X
                    className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      setShowClip(false)
                      setClipLink("")
                      setPostToDiscover(false)
                    }}
                  />
                </div>
                <Input
                  placeholder="Paste YouTube/Twitter clip link..."
                  value={clipLink}
                  onChange={(e) => setClipLink(e.target.value)}
                  className="bg-black/40 border-white/10 h-8 text-sm"
                />
                <div className="flex items-center gap-2">
                  <Switch
                    id="post-to-discover"
                    checked={postToDiscover}
                    onCheckedChange={setPostToDiscover}
                    disabled={!clipLink.trim()}
                    className="scale-90"
                  />
                  <Label htmlFor="post-to-discover" className="text-xs text-muted-foreground">
                    Also post to Discover
                  </Label>
                </div>
              </div>
            )}

            {hasSpoilers && isExpanded && (
              <div className="space-y-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-xs font-medium">Spoiler Warning</span>
                  </div>
                  <X
                    className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setHasSpoilers(false)}
                  />
                </div>
                <Input
                  placeholder="Spoilers up to Episode/Chapter..."
                  value={spoilerEpisode}
                  onChange={(e) => setSpoilerEpisode(e.target.value)}
                  className="bg-black/40 border-white/10 h-8 text-sm"
                />
              </div>
            )}

            {isExpanded && (
              <div className="flex flex-wrap items-center gap-1 border-t border-white/10 pt-3 animate-in fade-in duration-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClip((prev) => !prev)}
                  className={cn(
                    "gap-1 h-7 px-2 text-xs rounded-full bg-white/5 hover:bg-white/10",
                    showClip ? "text-cyan-400" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Film className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPoll((prev) => !prev)}
                  className={cn(
                    "gap-1 h-7 px-2 text-xs rounded-full bg-white/5 hover:bg-white/10",
                    showPoll ? "text-purple-400" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                </Button>

                <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 h-7 px-2 text-muted-foreground hover:text-foreground text-xs rounded-full bg-white/5 hover:bg-white/10"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </Button>
                </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Attach Anime/Manga</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-4">
                      <Input
                        placeholder="Search anime or manga..."
                        value={mediaQuery}
                        onChange={(e) => setMediaQuery(e.target.value)}
                        className="bg-secondary/50"
                      />
                      {mediaLoading && (
                        <p className="text-xs text-muted-foreground">Searching...</p>
                      )}
                      {mediaError && <p className="text-xs text-red-400">{mediaError}</p>}
                      <div className="grid gap-1">
                        {mediaResults.length === 0 && !mediaLoading ? (
                          <p className="text-xs text-muted-foreground py-2">
                            {mediaQuery.trim().length < 2
                              ? "Type at least 2 characters to search."
                              : "No matches found."}
                          </p>
                        ) : (
                          mediaResults.map((item) => (
                            <Button
                              key={item.id}
                              variant="ghost"
                              className="justify-start h-10 text-sm gap-2"
                              onClick={() => selectMedia(item)}
                            >
                              {item.coverImage ? (
                                <img
                                  src={item.coverImage}
                                  alt={item.title}
                                  className="h-6 w-6 rounded object-cover"
                                />
                              ) : (
                                <div className="h-6 w-6 rounded bg-secondary" />
                              )}
                              <span className="flex-1 truncate">{item.title}</span>
                              <span className="text-[10px] text-muted-foreground">{item.type}</span>
                            </Button>
                          ))
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 h-7 px-2 text-muted-foreground hover:text-foreground text-xs rounded-full bg-white/5 hover:bg-white/10"
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Attach List</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-4">
                      <Input
                        placeholder="Search your lists..."
                        value={listQuery}
                        onChange={(e) => setListQuery(e.target.value)}
                        className="bg-secondary/50"
                      />
                      <div className="grid gap-1">
                        {filteredLists.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">
                            {availableLists.length === 0
                              ? "Create a list to attach it here."
                              : "No lists match your search."}
                          </p>
                        ) : (
                          filteredLists.map((list) => (
                            <Button
                              key={list.id}
                              variant="ghost"
                              className="justify-start h-9 text-sm"
                              onClick={() => setAttachedList(list)}
                            >
                              {list.name}
                            </Button>
                          ))
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHasSpoilers((prev) => !prev)}
                  className={cn(
                    "gap-1 h-7 px-2 text-xs rounded-full bg-white/5 hover:bg-white/10",
                    hasSpoilers ? "text-red-400" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {isExpanded && (
              <div className="flex flex-wrap gap-2">
                {postCategories.map((category) => (
                  <Badge
                    key={category}
                    variant={postCategory === category ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer text-[11px] transition-smooth",
                      postCategory !== category && "bg-transparent hover:bg-secondary",
                    )}
                    onClick={() => setPostCategory(category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              {isExpanded ? (
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    list="fandom-options"
                    value={fandomInput}
                    onChange={(e) => setFandomInput(e.target.value)}
                    placeholder="Fandom"
                    className="w-44 bg-secondary/50 border-0 h-8 text-xs"
                  />
                  <datalist id="fandom-options">
                    {fandomOptions.map((fandom) => (
                      <option key={fandom} value={fandom} />
                    ))}
                  </datalist>
                </div>
              ) : (
                <div />
              )}

              <Button
                onClick={handlePost}
                disabled={!isAuthenticated || !content.trim()}
                className="rounded-full px-5 h-8 text-sm bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 hover:scale-105 transition-transform"
              >
                Post
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
