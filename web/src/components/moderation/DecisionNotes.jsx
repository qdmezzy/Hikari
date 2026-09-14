"use client"
import {useEffect,useState} from "react"
import client from "@/lib/client"
export function DecisionNotes({reportId}){
 const [rows,setRows]=useState([]),[error,setError]=useState(""),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0)
 useEffect(()=>{let active=true;setRows([]);setError("");setLoading(true);client.from("moderation_decisions").select("id,action,previous_status,next_status,note,created_at,actor_id").eq("report_id",reportId).order("created_at",{ascending:false}).limit(50).then(({data,error})=>{if(!active)return;if(error)setError("Decision history couldn’t load. The moderation migration and moderator access are required.");else setRows(data||[])}).catch(()=>{if(active)setError("Decision history couldn’t load.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[reportId,revision])
 return <section className="mod-evidence"><h3>Decision history</h3>{loading?<p role="status">Loading previous decisions…</p>:error?<p role="alert">{error} <button onClick={()=>setRevision(value=>value+1)}>Retry</button></p>:rows.length?rows.map(row=><article key={row.id}><strong>{row.action} · {row.previous_status} → {row.next_status}</strong><p>{row.note||"No note recorded."}</p><small>{new Date(row.created_at).toLocaleString()} · Moderator {row.actor_id}</small></article>):<p>No durable decisions recorded for this report.</p>}<p>Latest 50 decisions. Account bans can be reversed from People. Content removal is not reversed by changing a report’s status.</p></section>
}
