"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Search } from "lucide-react"
import { Navigation } from "@/components/layout/Navigation"
import RequireAuth from "@/components/common/RequireAuth"
import { Button } from "@/components/ui/button"
import { SiteSelect } from "@/components/ui/site-select"
import { ScrollReveal } from "@/components/common/ScrollReveal"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { getMediaHref } from "@/lib/anilist"

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
  const [mediaFilter, setMediaFilter] = useState("all")
  const [reload, setReload] = useState(0)
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
  }, [user, reload])

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return entries.filter((entry) => {
      if (mediaFilter !== "all" && entry.media_type !== mediaFilter) return false
      if (!query) return true
      const title =
        entry?.media?.title?.english ||
        entry?.media?.title?.romaji ||
        "Unknown title"
      return title.toLowerCase().includes(query)
    })
  }, [entries, searchQuery, mediaFilter])

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


  return <RequireAuth><div className="hikari-revamp min-h-screen bg-background"><Navigation/>
    <main className="rv-main hk-personal"><div className="rv-container">
      <header className="hk-personal-heading"><div><span className="hk-page-jp" lang="ja">視聴と読書の記録</span><h1>History</h1><p>Your latest update for each title, ordered by when you last tracked it.</p></div><Link href="/lists">Manage My List <ArrowUpRight size={16}/></Link></header>
      <div className="hk-personal-toolbar"><label className="hk-personal-search"><Search size={17}/><input aria-label="Search your history" placeholder="Find a title in your history…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/></label><SiteSelect ariaLabel="History media type" value={mediaFilter} onValueChange={setMediaFilter} options={[{value:"all",label:"Anime & manga"},{value:"ANIME",label:"Anime"},{value:"MANGA",label:"Manga"}]} /></div>
      {loadingEntries ? <p role="status" className="hk-personal-empty">Loading your history…</p> : <>
        {entriesError ? <p role="alert" className="hk-personal-notice">{entriesError} <button onClick={()=>setReload(value=>value+1)}>Try again</button></p>:null}
        {!groupedEntries.length ? <div className="hk-personal-empty"><span lang="ja">ここからはじまる</span><h2>{searchQuery || mediaFilter!=="all" ? "No matching updates" : "Your watch log starts here"}</h2><p>{searchQuery || mediaFilter!=="all" ? "Try another title or show all media." : "Track an episode or chapter in My List to see your latest progress here."}</p>{searchQuery || mediaFilter!=="all" ? <Button variant="outline" onClick={()=>{setSearchQuery("");setMediaFilter("all")}}>Clear filters</Button>:<Button variant="outline" asChild><Link href="/lists">Open My List</Link></Button>}</div>:
          <div className="hk-history-timeline">{groupedEntries.map(group=><ScrollReveal key={group.date}><section className="hk-history-day"><header><h2>{group.date}</h2><small>{group.items.length} {group.items.length===1 ? "title" : "titles"}</small></header><div>{group.items.map(entry=>{
            const title=entry.media?.title?.english || entry.media?.title?.romaji || "Title #"+entry.media_id
            const manga=entry.media_type==="MANGA"
            return <article className="hk-history-entry" key={entry.id}><Link href={getMediaHref(entry.media_id,title)} className="hk-history-cover"><img src={entry.media?.coverImage?.large || "/placeholder.svg"} alt="" loading="lazy"/></Link><div><p className="hk-history-status">{statusLabels[entry.status] || entry.status} <span>· {manga ? "Manga" : "Anime"}</span></p><h3><Link href={getMediaHref(entry.media_id,title)}>{title}</Link></h3><p>{manga ? "Chapter" : "Episode"} {entry.progress || 0}{(manga ? entry.media?.chapters : entry.media?.episodes) ? " / "+(manga ? entry.media.chapters : entry.media.episodes) : ""}</p></div><time dateTime={entry.updated_at}>{formatRelativeTime(entry.updated_at)}</time><Link className="hk-history-manage" href={"/lists?status="+encodeURIComponent(entry.status)} aria-label={"Manage "+title+" in My List"}><ArrowUpRight size={18}/></Link></article>
          })}</div></section></ScrollReveal>)}</div>}
      </>}
    </div></main>
  </div></RequireAuth>
}



