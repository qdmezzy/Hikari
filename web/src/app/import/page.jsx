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
import { downloadJson } from "@/lib/export-library.mjs"
import { getSafeNextPath } from "@/lib/safe-navigation.mjs"

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
        startedAt { year month day }
        completedAt { year month day }
        media {
          id
          type
        }
      }
    }
  }
}
`

// AniList fuzzy date {year,month,day} -> "YYYY-MM-DD" (or null if incomplete).
const fuzzyDateToISO = (date) => {
  if (!date?.year || !date?.month || !date?.day) return null
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`
}

// MAL "YYYY-MM-DD" (XML or API) -> ISO date, ignoring empty "0000-00-00".
const malDateToISO = (value) => {
  if (!value || typeof value !== "string") return null
  if (!/^\d{4}-\d{2}-\d{2}/.test(value) || value.startsWith("0000")) return null
  return value.slice(0, 10)
}

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
        startedAt: fuzzyDateToISO(entry?.startedAt),
        finishedAt: fuzzyDateToISO(entry?.completedAt),
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
        startedAt: fuzzyDateToISO(entry?.startedAt),
        finishedAt: fuzzyDateToISO(entry?.completedAt),
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
    startedAt: malDateToISO(getText(node, "my_start_date")),
    finishedAt: malDateToISO(getText(node, "my_finish_date")),
  }))

  const mangaEntries = mangaNodes.map((node) => ({
    sourceId: Number(getText(node, "series_mangadb_id")),
    title: getText(node, "series_title"),
    mediaType: "MANGA",
    status: mapStatus(getText(node, "my_status")),
    progress: Number(getText(node, "my_read_chapters")) || 0,
    score: Number(getText(node, "my_score")) || null,
    startedAt: malDateToISO(getText(node, "my_start_date")),
    finishedAt: malDateToISO(getText(node, "my_finish_date")),
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
      startedAt: malDateToISO(attrs?.startedAt || attrs?.started_at),
      finishedAt: malDateToISO(attrs?.finishedAt || attrs?.finished_at),
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
  const [preview, setPreview] = useState(null)
  const [mergeExisting, setMergeExisting] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState("")
  const [malConnected, setMalConnected] = useState(false)
  useEffect(()=>{
    const source=searchParams.get("source")
    if(importSources.some(item=>item.key===source))setSelectedSource(source)
    const initialUsername=searchParams.get("username")
    if(initialUsername)setUsername(initialUsername.slice(0,100))
  },[searchParams])
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
    let written=0
    for(const row of entries){
      const {_existing,_updatedAt,...values}=row
      const result = _existing
        ? await client.from("list_entries").update(values).eq("user_id",user.id).eq("media_id",values.media_id).eq("updated_at",_updatedAt).select("media_id")
        : await client.from("list_entries").upsert(values,{onConflict:"user_id,media_id",ignoreDuplicates:true}).select("media_id")
      if(result.error) throw new Error(`Import stopped after ${written} saved entries. ${result.error.message}`)
      if(!result.data?.length) throw new Error(`Your list changed during import. ${written} entries were saved; refresh the preview before continuing.`)
      written++
      setProgress(Math.round(written/entries.length*100))
    }
    return written
  }

  // Non-destructive: for entries you already have on Hikari, only fill gaps and
  // advance progress — never overwrite your Hikari status/score, never delete.
  // Rows that wouldn't actually change are skipped, so re-importing doesn't bump
  // every entry's updated_at (which would make everything read "just now").
  const dateOnly = (value) => (value ? String(value).slice(0, 10) : null)

  const buildImportPayload = async (entries) => {
    const { data: existingRows, error: existingError } = await client
      .from("list_entries")
      .select("media_id, status, progress, score, started_at, finished_at, updated_at")
      .eq("user_id", user.id)
    if (existingError) throw new Error("Your existing list could not be checked. Nothing has been imported.")
    const existingByMedia = new Map((existingRows || []).map((row) => [Number(row.media_id), row]))

    const rows = []
    entries.forEach((entry) => {
      const existing = existingByMedia.get(Number(entry.mediaId))
      const importedScore = normalizeScore(Number(entry.score))
      const merged = {
        _existing: Boolean(existing),
        _updatedAt: existing?.updated_at,
        user_id: user.id,
        media_id: entry.mediaId,
        media_type: entry.mediaType,
        status: existing ? existing.status : normalizeStatus(entry.status || "plan_to_watch"),
        progress: Math.max(Number(entry.progress) || 0, Number(existing?.progress) || 0),
        score: existing ? existing.score ?? importedScore : importedScore,
        started_at: dateOnly(existing?.started_at) || entry.startedAt || null,
        finished_at: dateOnly(existing?.finished_at) || entry.finishedAt || null,
      }

      // Skip rows that wouldn't change anything (avoids touching updated_at).
      if (existing) {
        const unchanged =
          merged.progress === (Number(existing.progress) || 0) &&
          (merged.score ?? null) === (existing.score ?? null) &&
          dateOnly(merged.started_at) === dateOnly(existing.started_at) &&
          dateOnly(merged.finished_at) === dateOnly(existing.finished_at)
        if (unchanged) return
      }
      rows.push(merged)
    })
    return rows
  }

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
            startedAt: entry.startedAt,
            finishedAt: entry.finishedAt,
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

    const payload = await buildImportPayload(normalized)
    setPreview({payload, total:normalized.length, anime:normalized.filter(entry=>entry.mediaType==="ANIME").length,manga:normalized.filter(entry=>entry.mediaType==="MANGA").length,unmatched:unmatchedCount})
    return

  }

  const confirmImport = async () => {
    if(!preview || importing) return
    setImporting(true)
    setImportError("")
    try{
      const chosen=preview.payload.filter(row=>mergeExisting || !row._existing)
      const written=await upsertEntries(chosen)
      setImportSummary({total:written,anime:chosen.filter(row=>row.media_type==="ANIME").length,manga:chosen.filter(row=>row.media_type==="MANGA").length,unmatched:preview.unmatched})
      setPreview(null)
      setProgress(100)
    }catch(error){setImportError(error.message || "Import failed.");setPreview(null)}
    finally{setImporting(false)}
  }
  const exportList = async () => {
    try{
      const {data,error}=await client.from("list_entries").select("media_id,media_type,status,progress,score,started_at,finished_at").eq("user_id",user.id)
      if(error) throw error
      downloadJson("hikari-library.json",{format:"hikari-library",version:1,entries:data || []})
    }catch{setImportError("Your library could not be exported. Try again.")}
  }

  const handleFileImport = async (file) => {
    if (!file) return
    setImportError("")
    setImportSummary(null)
    setPreview(null)
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
      if (json?.format === "hikari-library" && json.version === 1 && Array.isArray(json.entries)) {
        await finalizeImport(json.entries.map(row=>({mediaId:Number(row.media_id),mediaType:row.media_type,status:row.status,progress:row.progress,score:row.score,startedAt:row.started_at,finishedAt:row.finished_at})))
        setImporting(false)
        return
      }
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
    setPreview(null)
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
        startedAt: malDateToISO(entry.startDate),
        finishedAt: malDateToISO(entry.finishDate),
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
    setPreview(null)
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

      <main className="rv-main rv-container hk-import-journal">
        <div className="px-4 py-8 md:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <span className="hk-page-jp" lang="ja">引っ越し / BRING YOUR HISTORY</span><h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">Your next chapter starts here.</h1>
              <p className="text-muted-foreground">Preview first. Keep your progress. Nothing changes until you confirm.</p><Button variant="outline" className="mt-4" onClick={exportList}>Export my Hikari library</Button>
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

            {preview ? <section className="hk-import-preview" aria-label="Import preview"><span className="hk-page-jp">BEFORE YOU BRING IT OVER</span><h2>Check your import</h2><p>{preview.total} matched titles · {preview.unmatched} unmatched · {preview.payload.filter(row=>!row._existing).length} new · {preview.payload.filter(row=>row._existing).length} existing entries with possible updates.</p><p>Unchanged entries are skipped. Existing status and scores stay yours; progress never moves backward.</p><label><input type="checkbox" checked={mergeExisting} onChange={event=>setMergeExisting(event.target.checked)}/> Also fill missing dates/scores and advance progress on existing entries</label><div className="hk-import-preview-rows">{preview.payload.slice(0,12).map(row=><div key={row.media_id}><span>#{row.media_id} · {row.media_type}</span><span>{row._existing?"Update if selected":"Add new"} · progress {row.progress}</span></div>)}</div><div className="hk-collection-tools"><Button disabled={importing} onClick={confirmImport}>Confirm import</Button><Button variant="outline" disabled={importing} onClick={()=>setPreview(null)}>Cancel — change nothing</Button></div></section>:null}
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
                    <Button className="w-full gap-2" onClick={() => router.push(getSafeNextPath(searchParams?.get("next"), "/lists"))}>
                      Continue
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
