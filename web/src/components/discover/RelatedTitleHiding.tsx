"use client"
import {useState} from "react"
import {Button} from "@/components/ui/button"
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog"
import {fetchAniList,getMediaTitle} from "@/lib/anilist"
const relations=new Set(['PREQUEL','SEQUEL','PARENT','SIDE_STORY','SPIN_OFF','SUMMARY','COMPILATION','ALTERNATIVE'])
const query=`query($ids:[Int]){Page(perPage:25){media(id_in:$ids,type:ANIME,isAdult:false){id title{english romaji native} relations{edges{relationType(version:3) node{id type isAdult title{english romaji native}}}}}}}`
export function RelatedTitleHiding({title,onHide}:{title:any,onHide:(titles:{id:number,title:string}[])=>Promise<boolean>}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("")
 const [items,setItems]=useState<{id:number,title:string}[]>([]),[selected,setSelected]=useState<number[]>([]),[limited,setLimited]=useState(false)
 async function find(){
  setOpen(true);setBusy(true);setError("");setItems([]);setSelected([]);setLimited(false)
  try{
   const found=new Map<number,string>([[title.id,title.title]]),visited=new Set<number>();let queue=[title.id],requests=0
   while(queue.length&&requests<8&&found.size<200){
    const batch=queue.splice(0,25).filter(id=>!visited.has(id));if(!batch.length)continue
    batch.forEach(id=>visited.add(id));requests++
    const data=await fetchAniList(query,{ids:batch})
    for(const media of data?.Page?.media||[])for(const edge of media.relations?.edges||[]){
     const node=edge.node
     if(!relations.has(edge.relationType)||node?.type!=='ANIME'||node.isAdult||!Number.isSafeInteger(node.id)||found.has(node.id))continue
     if(found.size>=200)break
     found.set(node.id,getMediaTitle(node));queue.push(node.id)
    }
   }
   const values=[...found].map(([id,title])=>({id,title}));setItems(values);setSelected(values.map(item=>item.id));setLimited(queue.length>0)
  }catch{setError("Related titles couldn’t load. Nothing has been hidden. Try again.")}finally{setBusy(false)}
 }
 async function save(){if(busy||!selected.length)return;setBusy(true);try{if(await onHide(items.filter(item=>selected.includes(item.id))))setOpen(false);else setError("Nothing was saved. Check account setup and retry.")}catch{setError("Couldn’t save hidden titles. Please retry.")}finally{setBusy(false)}}
 return <><button type="button" onClick={find}>Hide related anime…</button><Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value)}}><DialogContent><DialogHeader><DialogTitle>Leave this group off your feed</DialogTitle><DialogDescription>Choose from AniList’s linked sequels, prequels, recaps and side stories. Relationships aren’t a definitive franchise list; future catalog additions are not automatically hidden.</DialogDescription></DialogHeader>{busy?<p role="status">Working…</p>:null}{error?<p role="alert">{error} <button onClick={find}>Retry lookup</button></p>:null}{limited?<p>This is a partial group (lookup limit reached). Only the selected titles below will be hidden.</p>:null}<div className="hk-hidden-titles">{items.map(item=><label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} disabled={busy} onChange={()=>setSelected(values=>values.includes(item.id)?values.filter(id=>id!==item.id):[...values,item.id])}/> {item.title}</label>)}</div><Button disabled={busy||!selected.length} onClick={save}>Hide {selected.length} selected titles</Button></DialogContent></Dialog></>
}
