"use client"
import {useEffect,useState} from "react"
import Link from "next/link"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import {Navigation} from "@/components/layout/Navigation"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {fetchAniListMediaByIds,getMediaTitle} from "@/lib/anilist"

export default function ClubsPage(){
 const {user}=useAuth(),isMod=user?.app_metadata?.is_mod===true||user?.app_metadata?.isMod===true
 const [club,setClub]=useState<any>(null),[episodes,setEpisodes]=useState<any[]>([]),[member,setMember]=useState(false)
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("")
 const [mediaId,setMediaId]=useState(""),[episode,setEpisode]=useState("1"),[revision,setRevision]=useState(0)
 useEffect(()=>{let active=true;setLoading(true);setError("");setClub(null);setMember(false)
  async function load(){
   const {data,error}=await client.from("watch_clubs").select("id,name,media_id").eq("is_active",true).maybeSingle()
   if(error)throw new Error("Watch clubs aren’t available. The club migration must be installed first.")
   if(!active)return;setClub(data);if(!data)return
   const [links,membership]=await Promise.all([client.from("watch_club_episodes").select("episode,post_id").eq("club_id",data.id).order("episode"),user?client.from("watch_club_members").select("club_id").eq("club_id",data.id).eq("user_id",user.id).maybeSingle():Promise.resolve({data:null,error:null})])
   if(links.error||membership.error)throw new Error("Couldn’t load this club. Please retry.")
   if(active){setEpisodes(links.data||[]);setMember(Boolean(membership.data))}
  }
  load().catch(error=>{if(active)setError(error.message)}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[user?.id,revision])
 async function act(work:()=>Promise<void>){if(busy)return;setBusy(true);setError("");try{await work();setRevision(value=>value+1)}catch(error){setError(error instanceof Error?error.message:"Couldn’t save that change.")}finally{setBusy(false)}}
 async function create(event:React.FormEvent){event.preventDefault();await act(async()=>{const id=Number(mediaId);if(!Number.isSafeInteger(id)||id<1)throw new Error("Enter an AniList anime ID.");const media=(await fetchAniListMediaByIds([id])).get(id);if(!media||media.type!=="ANIME"||media.isAdult)throw new Error("Choose an available, non-adult anime title.");const {error}=await client.rpc("open_watch_club",{club_name:getMediaTitle(media).slice(0,100),title_id:id});if(error)throw new Error("Couldn’t open the club. Only one curated club can be active.")})}
 async function membership(){await act(async()=>{const result=member?await client.from("watch_club_members").delete().eq("club_id",club.id).eq("user_id",user.id):await client.from("watch_club_members").insert({club_id:club.id,user_id:user.id});if(result.error)throw new Error("Your membership wasn’t saved.")})}
 async function openEpisode(event:React.FormEvent){event.preventDefault();await act(async()=>{const number=Number(episode);if(!Number.isSafeInteger(number)||number<1)throw new Error("Enter a valid episode number.");const media=(await fetchAniListMediaByIds([club.media_id])).get(club.media_id);if(!media?.episodes||number>media.episodes)throw new Error("Episode count is unavailable or this episode exceeds it. Confirm the catalog data first.");const {error}=await client.rpc("open_club_episode",{target_club:club.id,episode_number:number});if(error)throw new Error("Couldn’t open this episode discussion.")})}
 return <div className="hikari-revamp min-h-screen"><Navigation/><main className="rv-container rv-main" style={{maxWidth:900}}><header className="rv-page-heading"><div><p className="rv-kicker" lang="ja">今週、いっしょに</p><h1>Same show. Same week.</h1><p>One curated watch club, with a separate conversation for each episode. Join by choice; no automatic messages or notifications.</p></div></header>{error?<p role="alert">{error} <button onClick={()=>setRevision(value=>value+1)}>Retry</button></p>:null}
 {loading?<p role="status">Opening the club…</p>:club?<section className="hk-related-stories"><h2>{club.name}</h2><Link href={`/media/${club.media_id}`}>About this anime ↗</Link>{user?<Button disabled={busy} variant="outline" onClick={membership}>{member?"Leave club":"Join club"}</Button>:<Link href="/login?next=%2Fclubs">Sign in to join</Link>}<p>Opening a discussion means spoilers through that episode. Keep future episodes and source-material spoilers out; report rule-breaking replies in the discussion.</p><div>{episodes.map(item=><Link key={item.episode} href={`/community/${item.post_id}`}><strong>Episode {item.episode}</strong><span>Open discussion · spoilers through this episode ↗</span></Link>)}</div>{!episodes.length?<p>The curator hasn’t opened an episode yet.</p>:null}
 {isMod?<><form onSubmit={openEpisode} className="hk-collection-tools"><label htmlFor="club-episode">Episode to open</label><Input id="club-episode" type="number" min={1} max={1000} value={episode} onChange={event=>setEpisode(event.target.value)}/><Button disabled={busy}>Open episode discussion</Button></form><details><summary>Close this season’s club</summary><p>This preserves discussions and memberships but removes the club from the active slot.</p><Button disabled={busy} variant="outline" onClick={()=>act(async()=>{const {error}=await client.rpc("close_watch_club",{target_club:club.id});if(error)throw new Error("Couldn’t close the club.")})}>Confirm close club</Button></details></>:null}</section>:!error?<section className="hk-personal-updates"><h2>The next watch is still being picked.</h2><p>No club is active yet. Nothing has been created or joined for you.</p>{isMod?<form onSubmit={create} className="hk-collection-tools"><label htmlFor="club-media">AniList anime ID</label><Input id="club-media" value={mediaId} onChange={event=>setMediaId(event.target.value)} inputMode="numeric"/><Button disabled={busy}>Open curated club</Button></form>:null}</section>:null}</main></div>
}
