"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { Navigation } from "@/components/layout/Navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fetchAniListMediaByIds, getMediaTitle } from "@/lib/anilist"

export default function ComparePage(){
 const {user,loading}=useAuth()
 const [profile,setProfile]=useState<any>(null),[handle,setHandle]=useState("")
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[result,setResult]=useState<any>(null)
 const [titles,setTitles]=useState<any[]>([])
 useEffect(()=>{let active=true;setProfile(null);setResult(null);if(user?.id)client.from("public_profiles").select("public_profile,show_favorites,allow_taste_comparison").eq("user_id",user.id).maybeSingle().then(({data,error})=>{if(!active)return;setProfile(data);if(error)setError("Comparison needs the latest database migration. Please retry after setup.")});return()=>{active=false}},[user?.id])
 async function consent(){
  if(busy||!profile)return
  setBusy(true);setError("");setResult(null)
  try{
   const {data,error}=await client.from("public_profiles").update({allow_taste_comparison:!profile.allow_taste_comparison}).eq("user_id",user.id).select("public_profile,show_favorites,allow_taste_comparison").single()
   if(error)throw error
   setProfile(data)
  }catch{setError("Your preference wasn’t saved. Please retry.")}finally{setBusy(false)}
 }
 async function compare(event:React.FormEvent){
  event.preventDefault();if(busy)return
  setBusy(true);setError("");setResult(null);setTitles([])
  try{
   const {data,error}=await client.rpc("compare_public_favorites",{target_handle:handle.trim()})
   if(error)throw new Error("Comparison unavailable. Both people must have public profiles, visible favorites and comparison enabled.")
   setResult(data)
   try{const media=await fetchAniListMediaByIds(data.shared_ids||[]);setTitles((data.shared_ids||[]).map((id:number)=>({id,media:media.get(id)})))}catch{setTitles((data.shared_ids||[]).map((id:number)=>({id})));setError("The comparison loaded, but artwork is unavailable.")}
  }catch(error){setError(error instanceof Error?error.message:"Couldn’t compare profiles.")}finally{setBusy(false)}
 }
 return <div className="hikari-revamp min-h-screen"><Navigation/><main className="rv-container rv-main" style={{maxWidth:900}}><header className="rv-page-heading"><div><p className="rv-kicker" lang="ja">好きが重なる</p><h1>A little in common.</h1><p>Compare favorite titles—not private watch history, scores, or an invented compatibility rating.</p></div></header>
 {loading?<p role="status">Loading your preference…</p>:!user?<Button asChild><Link href="/login?next=%2Fcompare">Sign in to compare</Link></Button>:<><section className="hk-personal-updates"><h2>Your choice</h2><p>Both people must opt in. Turning this off prevents future comparisons; it cannot retract anything someone already saw.</p>{profile?<Button variant="outline" disabled={busy} onClick={consent}>{profile.allow_taste_comparison?"Turn comparison off":"Allow favorites comparison"}</Button>:null}{profile&&(!profile.public_profile||!profile.show_favorites)?<p>Public profile and visible favorites must also be enabled in <Link href="/settings?section=privacy">privacy settings</Link>. Nothing here changes those settings.</p>:null}</section>
 <form onSubmit={compare} className="hk-collection-tools"><label htmlFor="compare-handle">Their Hikari handle</label><Input id="compare-handle" value={handle} onChange={event=>setHandle(event.target.value)} maxLength={40} placeholder="@username"/><Button disabled={busy||!profile?.allow_taste_comparison||!handle.trim()}>Compare favorites</Button></form></>}
 {error?<p role="alert">{error}</p>:null}{result?<section className="hk-related-stories"><h2>{result.shared_ids.length} shared favorites with @{result.handle}</h2><p>Out of {result.union_count} distinct favorites across both profiles. An empty overlap just means different shelves.</p><div>{titles.map(title=><Link href={`/media/${title.id}`} key={title.id}><img src={title.media?.coverImage?.large||"/placeholder.svg"} alt=""/><strong>{title.media?getMediaTitle(title.media):`Title #${title.id}`}</strong></Link>)}</div></section>:null}</main></div>
}
