"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Search, ArrowUpRight } from "lucide-react"
import { Navigation } from "@/components/layout/Navigation"
import RequireAuth from "@/components/common/RequireAuth"
import { Button } from "@/components/ui/button"
import { AnimeCard } from "@/components/media/AnimeCard"
import { ScrollReveal } from "@/components/common/ScrollReveal"
import { fetchAniListMediaByIds, getMediaTitle } from "@/lib/anilist"
import useAuth from "@/hooks/useAuth"

export default function FavoritesPage() {
  const { user }=useAuth()
  const [titles,setTitles]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")
  const [query,setQuery]=useState("")
  const [sort,setSort]=useState("saved")
  const [retry,setRetry]=useState(0)
  useEffect(()=>{
    if(!user)return
    let active=true
    setLoading(true);setError("")
    const ids=[...new Set((user.user_metadata?.favorite_media_ids || []).map(Number).filter(Number.isFinite))] as number[]
    const load=async()=>{try{
      const media=ids.length ? await fetchAniListMediaByIds(ids) : new Map()
      if(active)setTitles(ids.map(id=>media.get(id)).filter(Boolean))
    }catch{if(active)setError("Your favorite titles could not load.")}
    finally{if(active)setLoading(false)}}
    void load()
    return()=>{active=false}
  },[user,retry])
  const results=useMemo(()=>{
    const result=titles.filter(title=>getMediaTitle(title).toLowerCase().includes(query.trim().toLowerCase()))
    return sort==="name" ? result.sort((a,b)=>getMediaTitle(a).localeCompare(getMediaTitle(b))) : result
  },[titles,query,sort])
  return <RequireAuth><div className="hikari-revamp min-h-screen bg-background"><Navigation/><main className="rv-main hk-personal"><div className="rv-container">
    <header className="hk-personal-heading"><div><span className="hk-page-jp" lang="ja">お気に入りの作品</span><h1>Favorites</h1><p>The anime and manga you’ve favorited. Your own collection of standouts.</p></div><Link href="/search">Browse titles <ArrowUpRight size={16}/></Link></header>
    <div className="hk-personal-toolbar"><label className="hk-personal-search"><Search size={17}/><input aria-label="Search favorite titles" placeholder="Find a favorite…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Sort favorite titles" value={sort} onChange={e=>setSort(e.target.value)}><option value="saved">Saved order</option><option value="name">Title A–Z</option></select></div>
    {loading ? <p role="status" className="hk-personal-empty">Loading favorite titles…</p> : error ? <div role="alert" className="hk-personal-empty"><p>{error}</p><Button variant="outline" onClick={()=>setRetry(n=>n+1)}>Try again</Button></div> : results.length ? <ScrollReveal><div className="hk-favorite-grid">{results.map(anime=><AnimeCard key={anime.id} anime={anime}/>)}</div></ScrollReveal> : <div className="hk-personal-empty"><span lang="ja">好きな作品を、ここに。</span><h2>{query ? "No matching favorites" : "Your favorite titles belong here"}</h2><p>{query ? "Try another title." : "Tap the heart on an anime or manga page to add it here."}</p>{query ? <Button variant="outline" onClick={()=>setQuery("")}>Clear search</Button> : <Button asChild variant="outline"><Link href="/search">Find a title</Link></Button>}</div>}
  </div></main></div></RequireAuth>
}
