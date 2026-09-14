"use client"

import { useState } from "react"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { fetchAniList,getMediaTitle } from "@/lib/anilist"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog"

const query=`query($search:String!){Page(perPage:12){media(search:$search,isAdult:false){id type title{english romaji native} coverImage{large}}}}`
export function FavoritePicker(){
 const {user}=useAuth()
 const [open,setOpen]=useState(false),[search,setSearch]=useState("")
 const [results,setResults]=useState<any[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("")
 async function find(event:React.FormEvent){event.preventDefault();if(busy||!search.trim())return;setBusy(true);setError("");try{const data=await fetchAniList(query,{search:search.trim()});setResults(data?.Page?.media||[])}catch{setError("Search couldn’t load. Try again.")}finally{setBusy(false)}}
 async function toggle(id:number){
  if(busy||!user)return;setBusy(true);setError("")
  try{
   const {data:current,error:readError}=await client.auth.getUser()
   if(readError||!current.user)throw new Error("Please sign in again.")
   const before=(current.user.user_metadata.favorite_media_ids||[]).map(Number).filter(Number.isSafeInteger)
   const next=before.includes(id)?before.filter((value:number)=>value!==id):[...new Set([...before,id])]
   const {error:saveError}=await client.auth.updateUser({data:{favorite_media_ids:next}})
   if(saveError)throw new Error("Your favorites weren’t saved. Please retry.")
   const {error:publicError}=await client.from("public_profiles").update({favorite_media_ids:next}).eq("user_id",user.id)
   if(publicError)setError("Saved to your account, but the public profile copy couldn’t sync. Please retry before sharing.")
  }catch(error){setError(error instanceof Error?error.message:"Couldn’t save favorites.")}finally{setBusy(false)}
 }
 const favorites=(user?.user_metadata?.favorite_media_ids||[]).map(Number)
 return <><Button variant="outline" onClick={()=>setOpen(true)}>Choose favorites</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>The stories you keep close</DialogTitle><DialogDescription>Choose anime or manga directly. Favorites are separate from collections and tracking. Their public visibility follows your profile privacy settings.</DialogDescription></DialogHeader><form onSubmit={find} className="hk-collection-tools"><Input aria-label="Search favorite titles" placeholder="Find an anime or manga…" value={search} onChange={event=>setSearch(event.target.value)}/><Button disabled={busy||!search.trim()}>Search</Button></form>{error?<p role="alert">{error}</p>:null}<div className="hk-hidden-titles">{results.map(title=><div key={title.id}><span>{getMediaTitle(title)} <small>· {title.type==='MANGA'?'Manga':'Anime'}</small></span><Button variant="outline" aria-pressed={favorites.includes(title.id)} disabled={busy} onClick={()=>toggle(title.id)}>{favorites.includes(title.id)?"Remove favorite":"Favorite"}</Button></div>)}</div><a href="/settings?section=privacy">Review favorite visibility ↗</a></DialogContent></Dialog></>
}
