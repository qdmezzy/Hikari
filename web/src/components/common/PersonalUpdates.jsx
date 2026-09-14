"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import client from "@/lib/client"

export function PersonalUpdates({ userId, kind, revision = 0 }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!userId) return
    let active = true
    setLoading(true)
    setRows([])
    setError("")
    const request = kind === "feedback"
      ? client.from("feedback").select("id,category,message,resolved,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(20)
      : client.from("notifications").select("id,type,title,message,metadata,created_at,read").eq("user_id",userId).in("type",["episode","preair","digest"]).order("created_at",{ascending:false}).limit(30)
    Promise.resolve(request).then(({data,error:loadError})=>{if(!active)return;if(loadError)throw loadError;setRows(data || [])}).catch(()=>{if(active)setError("Your updates could not load. Try again.")}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[userId,kind,revision,retry])
  if(!userId)return null
  return <section className="hk-personal-updates"><header><div><span className="hk-page-jp" lang="ja">{kind==="feedback"?"送った声":"お知らせ"}</span><h2>{kind==="feedback"?"Your messages":"Airing inbox"}</h2></div><button onClick={()=>setRetry(value=>value+1)}>Refresh</button></header>{loading?<p role="status">Checking your updates…</p>:error?<p role="alert">{error}</p>:!rows.length?<p>{kind==="feedback"?"No visible submissions yet. Signed-in submissions appear here when account-history access is enabled.":"No airing messages yet. Your episode alerts and digests will collect here as they arrive."}</p>:rows.map(row=><article key={row.id}><div><strong>{kind==="feedback"?row.category:row.title}</strong><small>{kind==="feedback"?(row.resolved?"Resolved":"Received · awaiting review"):row.type}</small></div><p>{row.message}</p><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleDateString()}</time>{kind!=="feedback"&&Number.isSafeInteger(Number(row.metadata?.mediaId))&&Number(row.metadata.mediaId)>0?<Link href={`/media/${Number(row.metadata.mediaId)}`}>Open title ↗</Link>:null}</article>)}<small>Only your account’s updates. Showing the latest {kind==="feedback"?20:30} records.</small></section>
}
