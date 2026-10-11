"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import client from "@/lib/client"
import { Button } from "@/components/ui/button"
import { SiteSelect } from "@/components/ui/site-select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { getMediaTitle } from "@/lib/anilist"

export function CollectionPublishing({collection,user,owner,items,onCover}:{collection:any,user:any,owner:boolean,items:any[],onCover:(id:number|null)=>void}) {
  const [following,setFollowing]=useState(false)
  const [updates,setUpdates]=useState<any[]>([])
  const [note,setNote]=useState("")
  const [busy,setBusy]=useState(false)
  const [ready,setReady]=useState(false)
  const [error,setError]=useState("")
  const [revision,setRevision]=useState(0)
  const [preview,setPreview]=useState(false)
  const [creator,setCreator]=useState<any>(null)
  useEffect(()=>{let active=true;setCreator(null);client.from("public_profiles").select("handle,display_name").eq("user_id",collection.user_id).eq("public_profile",true).maybeSingle().then(({data})=>{if(active)setCreator(data)});return()=>{active=false}},[collection.user_id])
  async function chooseCover(value:string){
    if(!owner||busy)return
    const id=value?Number(value):null
    if(id!==null&&!items.some(item=>Number(item.media_id)===id))return
    setBusy(true)
    try{
      const {data,error}=await client.from("custom_lists").update({cover_media_id:id}).eq("id",collection.id).eq("user_id",user.id).select("id").single()
      if(error||!data)throw error||new Error("Not saved")
      onCover(id);toast.success("Cover saved.")
    }catch{toast.error("Cover wasn’t saved. Check that the collection-tools migration is installed.")}finally{setBusy(false)}
  }
  useEffect(()=>{
    let active=true
    setReady(false);setError("");setUpdates([]);setFollowing(false)
    async function load(){
      const [history,follow]=await Promise.all([
        client.from("collection_publications").select("id,note,created_at").eq("collection_id",collection.id).order("created_at",{ascending:false}).limit(10),
        user?.id ? client.from("collection_follows").select("collection_id").eq("collection_id",collection.id).eq("user_id",user.id).maybeSingle() : Promise.resolve({data:null,error:null}),
      ])
      if(!active)return
      if(history.error||follow.error){setError("Collection updates aren’t available yet. Try again after the publishing migration is installed.");return}
      setUpdates(history.data||[]);setFollowing(Boolean(follow.data));setReady(true)
    }
    load().catch(()=>{if(active)setError("Couldn’t load collection updates. Please retry.")})
    return()=>{active=false}
  },[collection.id,user?.id,revision])
  async function changeFollow(){
    if(!user?.id||busy||!ready)return
    setBusy(true)
    try{
      const result=following ? await client.from("collection_follows").delete().eq("collection_id",collection.id).eq("user_id",user.id) : await client.rpc("follow_collection",{target_id:collection.id})
      if(result.error)throw result.error
      setFollowing(!following);toast.success(following?"Unfollowed collection.":"Following. You’ll hear only about published updates.")
    }catch{toast.error("Your follow preference wasn’t saved. Please retry.")}finally{setBusy(false)}
  }
  async function publish(event:React.FormEvent){
    event.preventDefault();if(busy||!note.trim()||!ready)return
    setBusy(true)
    try{
      const {error}=await client.rpc("publish_collection_update",{target_id:collection.id,update_note:note.trim()})
      if(error)throw error
      setNote("");setRevision(value=>value+1);toast.success("Update published. Followers have been notified in Hikari.")
    }catch{toast.error("Couldn’t publish. Check that this collection is public and wait an hour between updates.")}finally{setBusy(false)}
  }
  return <section className="hk-personal-updates" aria-label="Collection updates"><header><h2>Notes from this shelf</h2>{!owner&&collection.is_public?(user?<Button variant="outline" disabled={busy||!ready} onClick={changeFollow}>{following?"Unfollow":"Follow collection"}</Button>:<Link href={`/login?next=${encodeURIComponent('/lists/'+collection.id)}`}>Sign in to follow</Link>):null}</header>
    {creator?<p>Curated by <Link href={`/u/${encodeURIComponent(creator.handle)}`}>{creator.display_name||creator.handle}</Link></p>:<p>Curated by a Hikari member. Their profile isn’t publicly available.</p>}
    {owner?<div className="hk-collection-tools"><label htmlFor="collection-cover">Cover title </label><SiteSelect id="collection-cover" ariaLabel="Cover title" value={String(collection.cover_media_id||"default")} disabled={busy} onValueChange={value=>void chooseCover(value==="default"?"":value)} options={[{value:"default",label:"Use shelf order"},...items.map(item=>({value:String(item.media_id),label:getMediaTitle(item.media)}))]} className="max-w-[260px]" /><Button variant="outline" onClick={()=>setPreview(true)}>Preview public visibility</Button></div>:null}
    {collection.is_public?<p><a href={`/lists/${collection.id}/opengraph-image`} target="_blank" rel="noopener noreferrer">Open shareable cover ↗</a> Includes your public creator credit and collection link. Copies already shared cannot be retracted by making the collection private later.</p>:null}
    <p>Editing a shelf is quiet. Only an update deliberately published by its curator notifies followers.</p>
    {error?<p role="alert">{error} <button onClick={()=>setRevision(value=>value+1)}>Retry</button></p>:!ready?<p role="status">Loading updates…</p>:null}
    {owner&&collection.is_public?<form onSubmit={publish}><label htmlFor="collection-update-note">What changed?</label><Textarea id="collection-update-note" value={note} onChange={event=>setNote(event.target.value)} maxLength={500} placeholder="A new addition, a different order, a note worth sharing…"/><Button type="submit" disabled={busy||!ready||!note.trim()}>Publish and notify followers</Button><p>Public note · up to one published update per hour.</p></form>:null}
    {updates.map(update=><article key={update.id}><time dateTime={update.created_at}>{new Date(update.created_at).toLocaleDateString()}</time><p>{update.note}</p></article>)}
    {ready&&!updates.length?<p>No published updates yet.</p>:null}
    <Dialog open={preview} onOpenChange={setPreview}><DialogContent><DialogHeader><DialogTitle>What visitors can see</DialogTitle><DialogDescription>{collection.is_public?"This collection is public. Visitors can see its title, description, titles and published notes. Your tracking progress and private notes aren’t included.":"This collection is private. Visitors cannot open it. This preview does not change its visibility."}</DialogDescription></DialogHeader>{collection.is_public?<><h3>{collection.name}</h3><p>{collection.description}</p><p>{items.length} titles · {creator?`Curated by ${creator.display_name||creator.handle}`:"Hikari member"}</p><div className="hk-collection-panorama">{items.slice(0,5).map(item=><img key={item.id} src={item.media?.coverImage?.large||"/placeholder.svg"} alt={getMediaTitle(item.media)}/>)}</div></>:<p>Private collection — unavailable to visitors.</p>}</DialogContent></Dialog>
  </section>
}
