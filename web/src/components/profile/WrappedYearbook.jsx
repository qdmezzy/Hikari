"use client"
import {useEffect,useMemo,useState} from "react"
import Link from "next/link"
import {Navigation} from "@/components/layout/Navigation"
import {Button} from "@/components/ui/button"
import RequireAuth from "@/components/common/RequireAuth"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import {fetchAniListMediaByIds,getMediaTitle} from "@/lib/anilist"
import {buildYearbook,MONTHS} from "@/lib/wrapped-history.mjs"
import {downloadJson} from "@/lib/export-library.mjs"

export function WrappedYearbook(){
 const {user}=useAuth()
 const currentYear=new Date().getFullYear()
 const [year,setYear]=useState(currentYear),[events,setEvents]=useState([]),[media,setMedia]=useState(new Map())
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[artError,setArtError]=useState(false),[revision,setRevision]=useState(0),[truncated,setTruncated]=useState(false)
 useEffect(()=>{if(!user?.id)return;let active=true;setLoading(true);setError("");setEvents([]);setMedia(new Map());setArtError(false);setTruncated(false)
  async function load(){
   const {data,error,count}=await client.from("tracking_history").select("id,media_id,media_type,action,old_progress,new_progress,old_status,new_status,new_score,recorded_at",{count:"exact"}).eq("user_id",user.id).gte("recorded_at",`${year}-01-01T00:00:00Z`).lt("recorded_at",`${year+1}-01-01T00:00:00Z`).order("recorded_at").order("id").limit(10000)
   if(error)throw new Error("The new tracking-history migration needs to be installed before this yearbook can load. No historical watch dates will be invented.")
   if(!active)return;setEvents(data||[]);setTruncated((count||0)>(data?.length||0))
   const ids=[...new Set((data||[]).map(event=>Number(event.media_id)))]
   try{const art=await fetchAniListMediaByIds(ids.slice(0,300));if(active){setMedia(art);setArtError(ids.length>300)}}catch{if(active)setArtError(true)}
  }
  load().catch(error=>{if(active)setError(error.message)}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[user?.id,year,revision])
 const book=useMemo(()=>buildYearbook(events,year,media),[events,year,media])
 const maxMonth=Math.max(1,...book.months)
 const exportBook=()=>downloadJson(`hikari-${year}-yearbook.json`,{format:"hikari-yearbook",version:1,...book,partial:truncated,timezone:"UTC",method:"Recorded tracking changes, not verified viewing. Imports establish baselines. Runtime is a partial estimate from known catalog durations."})
 return <RequireAuth><div className="hikari-revamp hk-yearbook"><Navigation/><main className="rv-container rv-main"><header className="hk-yearbook-masthead"><div><span lang="ja">一年の記録</span><p>HIKARI / YOUR YEAR IN STORIES</p></div><label>Edition <select value={year} onChange={event=>setYear(Number(event.target.value))}>{Array.from({length:8},(_,index)=>currentYear-index).map(value=><option key={value}>{value}</option>)}</select></label></header>
 <section className="hk-yearbook-cover"><div className="hk-yearbook-year">{year}</div><div><p>{year===currentYear?"A work in progress.":"A year worth keeping."}</p><h1>The stories<br/>that stayed.</h1><span>Notes from your tracking journal—not a personality test.</span></div><div className="hk-yearbook-posters">{book.titleIds.slice(0,3).map(id=><img key={id} src={media.get(id)?.coverImage?.large||"/placeholder.svg"} alt=""/>)}</div></section>
 {loading?<p className="hk-yearbook-state" role="status">Gathering the pages of your year…</p>:error?<section className="hk-yearbook-state"><h2>This edition isn’t ready yet.</h2><p role="alert">{error}</p><Button variant="outline" onClick={()=>setRevision(value=>value+1)}>Try again</Button></section>:!book.eventCount?<section className="hk-yearbook-state"><h2>No dated tracking records for {year}.</h2><p>Your existing library is safe. The new journal starts recording after setup; it cannot recover when you watched older episodes. Importing a list does not count its lifetime progress as this year’s viewing.</p><Link href="/lists">Back to your library ↗</Link></section>:<>
 <aside className="hk-yearbook-disclosure"><strong>{truncated?"Partial edition":"About this edition"}</strong><p>{truncated?"Only the first 10,000 records are included; these are partial totals. ":""}Dates are recorded in UTC. This is tracking activity, which can include imports and corrections—not proof of when you watched. {artError?"Some catalog artwork and metadata are missing. ":""}Recording begins with the new history system; older activity may be absent.</p></aside>
 <section className="hk-yearbook-chapter"><header><span>01 / THE RECORD</span><h2>A little at a time<br/>adds up.</h2></header><div className="hk-yearbook-totals">{[[book.titleIds.length,"titles in your journal"],[book.activeDays,"days with logged changes"],[book.completed,"titles marked complete"],[book.streak,"consecutive logging days"]].map(([value,label])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></section>
 <section className="hk-yearbook-chapter"><header><span>02 / TURNING THE PAGE</span><h2>Progress, with context.</h2></header><div className="hk-yearbook-progress"><p><strong>{book.episodes}</strong> net episode progress</p><p><strong>{book.chapters}</strong> net chapter progress</p><p><strong>{book.films}</strong> films with recorded progress</p></div><p>Newly added/imported titles establish a baseline. Later progress increases and corrections are netted per title; rewatches are not reconstructed.</p><p>{Math.round(book.knownMinutes/60)} hours of estimated runtime represented by known durations. This is not measured watch time. {book.unknownRuntimeTitles} titles lack runtime; {book.unknownTypeTitles} lack format metadata and are excluded from these totals.</p></section>
 <section className="hk-yearbook-chapter"><header><span>03 / THE RHYTHM</span><h2>Your journal, month by month.</h2></header><div className="hk-yearbook-months">{MONTHS.map((month,index)=><div key={month}><span>{book.months[index]}</span><meter min={0} max={maxMonth} value={book.months[index]} aria-label={`${month}: ${book.months[index]} logged changes`}/><small>{month}</small></div>)}</div><p>Logged changes—not episodes watched per month.</p></section>
 <section className="hk-yearbook-chapter"><header><span>04 / YOUR SHELF</span><h2>A few familiar faces.</h2></header><div className="hk-yearbook-shelf">{book.titleIds.slice(0,12).map(id=><Link href={`/media/${id}`} key={id}><img loading="lazy" src={media.get(id)?.coverImage?.large||"/placeholder.svg"} alt=""/><span>{media.has(id)?getMediaTitle(media.get(id)):`Title #${id}`}</span></Link>)}</div><p>Titles ordered by their first recorded change in this edition—not a ranking.</p><div className="hk-yearbook-genres">{book.topGenres.map(([genre,count])=><span key={genre}>{genre} <small>{count} titles</small></span>)}</div></section>
 <footer className="hk-yearbook-end"><span lang="ja">また来年。</span><h2>Keep a place<br/>for the next story.</h2><Button onClick={exportBook}>Export this edition’s data</Button><Link href="/lists">Return to My List ↗</Link><p>Your yearbook is private. Exporting downloads a file; it does not publish your activity.</p></footer>
 </> }</main></div></RequireAuth>
}
