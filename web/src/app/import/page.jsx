"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Navigation } from "@/components/layout/Navigation"
import RequireAuth from "@/components/common/RequireAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Upload, Link2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"

const importSources = [
  {
    key: "mal",
    name: "MyAnimeList",
    description: "Connect via OAuth or import MAL XML exports.",
    icon: "M",
    supportsUsername: false,
    supportsOAuth: true,
  },
  {
    key: "anilist",
    name: "AniList",
    description: "Import by username or AniList JSON export.",
    icon: "A",
    supportsUsername: true,
    supportsOAuth: false,
  },
  {
    key: "kitsu",
    name: "Kitsu",
    description: "Best-effort import from Kitsu JSON export.",
    icon: "K",
    supportsUsername: false,
    supportsOAuth: false,
  },
]

const STATUS_MAP = {
  CURRENT: "watching",
  COMPLETED: "completed",
  PAUSED: "on_hold",
  DROPPED: "dropped",
  PLANNING: "plan_to_watch",
  REPEATING: "rewatching",
}

const MAL_STATUS_MAP = {
  watching: "watching",
  completed: "completed",
  on_hold: "on_hold",
  dropped: "dropped",
  plan_to_watch: "plan_to_watch",
  reading: "watching",
  plan_to_read: "plan_to_watch",
  rereading: "rewatching",
  rewatching: "rewatching",
  Watching: "watching",
  Completed: "completed",
  "On-Hold": "on_hold",
  Dropped: "dropped",
  "Plan to Watch": "plan_to_watch",
  Reading: "watching",
  "Plan to Read": "plan_to_watch",
}

const KITSU_STATUS_MAP = {
  current: "watching",
  completed: "completed",
  on_hold: "on_hold",
  dropped: "dropped",
  planned: "plan_to_watch",
}

const ALLOWED_STATUSES = new Set([
  "watching",
  "completed",
  "rewatching",
  "dropped",
  "on_hold",
  "plan_to_watch",
])

const ANILIST_LIST_QUERY = `
query ($userName: String, $type: MediaType) {
  MediaListCollection(userName: $userName, type: $type) {
    lists {
      status
      entries {
        status
        progress
        score
        media {
          id
          type
        }
      }
    }
  }
}
`

const MAL_MAPPING_QUERY = `
query ($ids: [Int], $type: MediaType) {
  Page(perPage: 50) {
    media(idMal_in: $ids, type: $type) {
      id
      idMal
    }
  }
}
`

const chunk = (arr, size) => {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

const mapStatus = (raw, fallback = "plan_to_watch") => {
  if (!raw) return fallback
  const direct = STATUS_MAP[raw]
  if (direct) return direct
  const normalized = raw.toString().trim()
  return MAL_STATUS_MAP[normalized] || KITSU_STATUS_MAP[normalized.toLowerCase()] || fallback
}

const normalizeStatus = (status, fallback = "watching") => {
  if (!status) return fallback
  if (ALLOWED_STATUSES.has(status)) return status
  return fallback
}

const normalizeEntries = (entries) => {
  const deduped = new Map()
  entries.forEach((entry) => {
    if (!entry?.mediaId || !entry?.mediaType) return
    const key = `${entry.mediaId}-${entry.mediaType}`
    deduped.set(key, entry)
  })
  return Array.from(deduped.values())
}

const normalizeScore = (score) => {
  if (!Number.isFinite(score)) return null
  if (score > 10 && score <= 100) return Math.round(score / 10)
  if (score > 20 && score <= 1000) return Math.round(score / 100)
  return Math.round(score)
}

const extractAniListEntries = (payload, typeOverride) => {
  const collection =
    payload?.MediaListCollection ||
    payload?.data?.MediaListCollection ||
    payload?.data ||
    payload
  const lists = collection?.lists || payload?.lists || []
  const entries = []

  lists.forEach((list) => {
    ;(list?.entries || []).forEach((entry) => {
      const media = entry?.media || {}
      const mediaId = entry?.mediaId || media?.id
      const mediaType = media?.type || entry?.mediaType || typeOverride
      if (!mediaId || !mediaType) return
      entries.push({
        mediaId,
        mediaType,
        status: mapStatus(entry?.status || list?.status),
        progress: Number(entry?.progress) || 0,
        score: Number(entry?.score) || null,
      })
    })
  })

  if (!entries.length && Array.isArray(collection)) {
    collection.forEach((entry) => {
      const mediaId = entry?.mediaId || entry?.media?.id
      const mediaType = entry?.mediaType || entry?.media?.type || typeOverride
      if (!mediaId || !mediaType) return
      entries.push({
        mediaId,
        mediaType,
        status: mapStatus(entry?.status),
        progress: Number(entry?.progress) || 0,
        score: Number(entry?.score) || null,
      })
    })
  }

  return entries
}

const parseMalXml = (xmlText) => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, "application/xml")
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("Invalid XML file.")
  }

  const getText = (node, tag) =>
    node?.getElementsByTagName(tag)?.[0]?.textContent?.trim() || ""

  const animeNodes = Array.from(doc.getElementsByTagName("anime"))
  const mangaNodes = Array.from(doc.getElementsByTagName("manga"))

  const animeEntries = animeNodes.map((node) => ({
    sourceId: Number(getText(node, "series_animedb_id")),
    title: getText(node, "series_title"),
    mediaType: "ANIME",
    status: mapStatus(getText(node, "my_status")),
    progress: Number(getText(node, "my_watched_episodes")) || 0,
    score: Number(getText(node, "my_score")) || null,
  }))

  const mangaEntries = mangaNodes.map((node) => ({
    sourceId: Number(getText(node, "series_mangadb_id")),
    title: getText(node, "series_title"),
    mediaType: "MANGA",
    status: mapStatus(getText(node, "my_status")),
    progress: Number(getText(node, "my_read_chapters")) || 0,
    score: Number(getText(node, "my_score")) || null,
  }))

  return [...animeEntries, ...mangaEntries].filter((entry) => Number.isFinite(entry.sourceId))
}

const parseKitsuJson = (payload) => {
  const data = Array.isArray(payload) ? payload : payload?.data || []
  const entries = []

  data.forEach((item) => {
    const attrs = item?.attributes || item
    const mediaType = attrs?.media_type?.toUpperCase() || attrs?.kind?.toUpperCase() || "ANIME"
    const anilistId = Number(attrs?.anilist_id || attrs?.anilistId)
    const malId = Number(attrs?.mal_id || attrs?.malId)

    entries.push({
      mediaType,
      mediaId: Number.isFinite(anilistId) ? anilistId : null,
      sourceId: Number.isFinite(malId) ? malId : null,
      status: mapStatus(attrs?.status),
      progress: Number(attrs?.progress) || 0,
      score: Number(attrs?.rating) || Number(attrs?.ratingTwenty) || null,
    })
  })

  return entries
}

export default function ImportPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef(null)
  const [selectedSource, setSelectedSource] = useState("anilist")
  const [username, setUsername] = useState("")
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [importError, setImportError] = useState("")
  const [importSummary, setImportSummary] = useState(null)
  const [selectedFileName, setSelectedFileName] = useState("")
  const [malConnected, setMalConnected] = useState(false)
  const selectedSourceMeta = useMemo(
    () => importSources.find((source) => source.key === selectedSource),
    [selectedSource],
  )

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [loading, user, router])

  useEffect(() => {
    const malStatus = searchParams.get("mal")
    if (malStatus === "connected") {
      setMalConnected(true)
      setImportError("")
    } else if (malStatus === "error") {
      setImportError("MAL connection failed. Try again.")
    }
  }, [searchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Redirecting...</div>
      </div>
    )
  }

  const fetchAniListCollection = async (userName, type) => {
    const res = await fetch("/api/anilist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: ANILIST_LIST_QUERY,
        variables: { userName, type },
      }),
    })
    const json = await res.json()
    if (!res.ok || json?.errors) {
      throw new Error(json?.errors?.[0]?.message || "AniList import failed.")
    }
    return json?.data
  }

  const fetchAniListIdsFromMal = async (ids, type) => {
    const map = new Map()
    const batches = chunk(ids, 50)
    for (const batch of batches) {
      const res = await fetch("/api/anilist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: MAL_MAPPING_QUERY,
          variables: { ids: batch, type },
        }),
      })
      const json = await res.json()
      if (!res.ok || json?.errors) {
        throw new Error(json?.errors?.[0]?.message || "MAL mapping failed.")
      }
      const media = json?.data?.Page?.media || []
      media.forEach((item) => {
        if (Number.isFinite(item?.idMal) && Number.isFinite(item?.id)) {
          map.set(item.idMal, item.id)
        }
      })
    }
    return map
  }

  const upsertEntries = async (entries) => {
    const batches = chunk(entries, 100)
    let processed = 0
    for (const batch of batches) {
      const { error } = await client
        .from("list_entries")
        .upsert(batch, { onConflict: "user_id,media_id" })
      if (error) {
        throw error
      }
      processed += batch.length
      setProgress(Math.round((processed / entries.length) * 100))
    }
  }

  const buildImportPayload = (entries) =>
    entries.map((entry) => ({
      user_id: user.id,
      media_id: entry.mediaId,
      media_type: entry.mediaType,
      status: normalizeStatus(entry.status || "plan_to_watch"),
      progress: Number(entry.progress) || 0,
      score: normalizeScore(Number(entry.score)),
    }))

  const resolveMalEntries = async (entries) => {
    const grouped = entries.reduce(
      (acc, entry) => {
        acc[entry.mediaType].push(entry)
        return acc
      },
      { ANIME: [], MANGA: [] },
    )

    const resolved = []
    let unmatchedCount = 0

    for (const type of ["ANIME", "MANGA"]) {
      const list = grouped[type]
      if (!list.length) continue
      const ids = list.map((entry) => entry.sourceId)
      const idMap = await fetchAniListIdsFromMal(ids, type)
      list.forEach((entry) => {
        const mediaId = idMap.get(entry.sourceId)
        if (mediaId) {
          resolved.push({
            mediaId,
            mediaType: entry.mediaType,
            status: mapStatus(entry.status),
            progress: entry.progress,
            score: entry.score,
          })
        } else {
          unmatchedCount += 1
        }
      })
    }

    return { resolved, unmatchedCount }
  }

  const finalizeImport = async (entries, unmatchedCount = 0) => {
    const normalized = normalizeEntries(entries)
    if (!normalized.length) {
      setImportError("No entries were found in that file.")
      setImporting(false)
      return
    }

    const payload = buildImportPayload(normalized)
    await upsertEntries(payload)

    const animeCount = normalized.filter((entry) => entry.mediaType === "ANIME").length
    const mangaCount = normalized.filter((entry) => entry.mediaType === "MANGA").length

    setImportSummary({
      total: normalized.length,
      anime: animeCount,
      manga: mangaCount,
      unmatched: unmatchedCount,
    })
  }

  const handleFileImport = async (file) => {
    if (!file) return
    setImportError("")
    setImportSummary(null)
    setProgress(0)
    setImporting(true)
    setSelectedFileName(file.name)

    try {
      const text = await file.text()
      const trimmed = text.trim()

      if (trimmed.startsWith("<")) {
        const entries = parseMalXml(text)
        const { resolved, unmatchedCount } = await resolveMalEntries(entries)
        await finalizeImport(resolved, unmatchedCount)
        setImporting(false)
        return
      }

      const json = JSON.parse(text)
      const isAniList =
        Boolean(json?.MediaListCollection) ||
        Boolean(json?.data?.MediaListCollection) ||
        Boolean(json?.lists)

      if (isAniList) {
        const entries = extractAniListEntries(json)
        await finalizeImport(entries)
        setImporting(false)
        return
      }

      const kitsuEntries = parseKitsuJson(json)
      const direct = kitsuEntries.filter((entry) => entry.mediaId)
      const needsMapping = kitsuEntries.filter((entry) => entry.sourceId && !entry.mediaId)
      let unresolvedCount = 0

      const mappedResult = needsMapping.length ? await resolveMalEntries(needsMapping) : { resolved: [], unmatchedCount: 0 }
      unresolvedCount += mappedResult.unmatchedCount

      await finalizeImport([...direct, ...mappedResult.resolved], unresolvedCount)
      setImporting(false)
    } catch (error) {
      console.error(error)
      setImportError(error.message || "Import failed.")
      setImporting(false)
    }
  }

  const handleMalConnect = () => {
    window.location.href = "/api/mal/authorize?returnTo=/import"
  }

  const handleMalImport = async () => {
    setImportError("")
    setImportSummary(null)
    setProgress(0)
    setImporting(true)

    try {
      const res = await fetch("/api/mal/list")
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error || "Failed to fetch MAL list.")
      }

      const entries = (json?.entries || []).map((entry) => ({
        sourceId: entry.sourceId,
        mediaType: entry.mediaType,
        status: mapStatus(entry.status),
        progress: entry.progress,
        score: entry.score,
      }))

      const { resolved, unmatchedCount } = await resolveMalEntries(entries)
      await finalizeImport(resolved, unmatchedCount)
      setImporting(false)
    } catch (error) {
      console.error(error)
      setImportError(error.message || "MAL import failed.")
      setImporting(false)
    }
  }

  const handleUsernameImport = async () => {
    if (!username.trim()) {
      setImportError("Enter a username to import.")
      return
    }
    if (!selectedSourceMeta?.supportsUsername) {
      setImportError("Username import is only available for AniList right now.")
      return
    }

    setImportError("")
    setImportSummary(null)
    setProgress(0)
    setImporting(true)

    try {
      const animeData = await fetchAniListCollection(username.trim(), "ANIME")
      const mangaData = await fetchAniListCollection(username.trim(), "MANGA")
      const entries = [
        ...extractAniListEntries(animeData, "ANIME"),
        ...extractAniListEntries(mangaData, "MANGA"),
      ]
      await finalizeImport(entries)
      setImporting(false)
    } catch (error) {
      console.error(error)
      setImportError(error.message || "Import failed.")
      setImporting(false)
    }
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileImport(file)
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const file = event.dataTransfer?.files?.[0]
    if (file) {
      handleFileImport(file)
    }
  }

  const handleDragOver = (event) => {
    event.preventDefault()
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <Navigation />

      <main className="pb-20 pt-16 md:pb-8">
        <div className="px-4 py-8 md:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">Import Your Lists</h1>
              <p className="text-muted-foreground">Bring your existing anime and manga lists to Hikari</p>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-3">
              {importSources.map((source) => (
                <Card
                  key={source.name}
                  onClick={() => setSelectedSource(source.key)}
                  className={`cursor-pointer bg-card transition-colors hover:border-primary ${
                    selectedSource === source.key ? "border-primary" : ""
                  }`}
                >
                  <CardContent className="p-6 text-center">
                    <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-xl font-semibold text-foreground">
                      {source.icon}
                    </div>
                    <h3 className="mb-1 font-semibold text-foreground">{source.name}</h3>
                    <p className="mb-4 text-sm text-muted-foreground">{source.description}</p>
                    {source.supportsOAuth ? (
                      <Button size="sm" variant={malConnected ? "secondary" : "outline"} onClick={handleMalConnect}>
                        <Link2 className="mr-2 h-4 w-4" />
                        {malConnected ? "Connected" : "Connect"}
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Link2 className="h-4 w-4" />
                        {source.supportsUsername ? "Username supported" : "File import only"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle>Manual Import</CardTitle>
                <CardDescription>Import from an XML or JSON export file</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="flex items-center justify-center rounded-lg border-2 border-dashed border-border p-8"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="text-center">
                    <Upload className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                    <p className="mb-2 text-foreground">
                      {selectedFileName ? selectedFileName : "Drag and drop your export file here"}
                    </p>
                    <p className="mb-4 text-sm text-muted-foreground">Supports MAL XML, AniList JSON, and Kitsu JSON</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".xml,.json"
                      onChange={handleFileChange}
                    />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      Choose File
                    </Button>
                  </div>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  <p>Or paste your username below (AniList only):</p>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Enter username..."
                    className="flex-1"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    disabled={importing}
                  />
                  <Button onClick={handleUsernameImport} disabled={importing}>
                    {importing ? "Importing..." : "Import"}
                  </Button>
                </div>

                {malConnected && (
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-secondary/40 px-4 py-4 text-sm text-muted-foreground">
                    <p>Connected to MAL. Import your live list now.</p>
                    <Button onClick={handleMalImport} disabled={importing}>
                      {importing ? "Importing..." : "Import MAL List"}
                    </Button>
                  </div>
                )}

                {importError && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {importError}
                  </div>
                )}
              </CardContent>
            </Card>

            {(importing || importSummary) && (
              <Card className="mt-8 bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {importing ? (
                      <Upload className="h-5 w-5 text-primary" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                    {importing ? "Importing..." : "Import Complete"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={importing ? progress : 100} className="h-2" />

                  {importSummary && (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-lg bg-secondary p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{importSummary.anime}</p>
                        <p className="text-sm text-muted-foreground">Anime Imported</p>
                      </div>
                      <div className="rounded-lg bg-secondary p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{importSummary.manga}</p>
                        <p className="text-sm text-muted-foreground">Manga Imported</p>
                      </div>
                      <div className="rounded-lg bg-secondary p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{importSummary.unmatched}</p>
                        <p className="text-sm text-muted-foreground">Entries Unmatched</p>
                      </div>
                    </div>
                  )}

                  {importSummary?.unmatched > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-primary/10 p-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-primary" />
                        <span className="text-sm text-foreground">
                          Some entries could not be matched to AniList IDs.
                        </span>
                      </div>
                    </div>
                  )}

                  {importSummary && (
                    <Button className="w-full gap-2" onClick={() => router.push("/lists")}>
                      Go to My List
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      </div>
    </RequireAuth>
  )
}
