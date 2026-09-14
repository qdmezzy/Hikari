"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { useMotionPreference } from "@/hooks/useMotionPreference"
import { ArrowUpRight, ChevronDown, ChevronUp, Check, Eye, EyeOff, Heart, Plus, Play, Share2, Volume2, VolumeX } from "lucide-react"
import { Navigation } from "@/components/layout/Navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getMediaHref } from "@/lib/anilist"
import { AddToCollection } from "@/components/lists/AddToCollection"
import { RelatedTitleHiding } from "./RelatedTitleHiding"

export function DiscoverScreen({ model: m }: { model: any }) {
  const [showInfo,setShowInfo]=useState(true)
  const reduced=useMotionPreference()
  const [pageVisible,setPageVisible]=useState(true)
  const [hiddenOpen,setHiddenOpen]=useState(false)
  useEffect(()=>{const update=()=>setPageVisible(!document.hidden);update();document.addEventListener("visibilitychange",update);return()=>document.removeEventListener("visibilitychange",update)},[])
  const title=m.currentAnime
  return <div className="hk-discover-page">
    <Navigation />
    <main ref={m.containerRef} className="hk-discover-stage" aria-label="Discover anime">
      {title ? <>
        <AnimatePresence initial={false} mode="wait"><motion.div key={title.id} className="hk-discover-film" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced?0:.45}}>
          <Image src={title.banner} alt="" fill priority sizes="(min-width:1024px) calc(100vw - 216px),100vw" className="object-cover" />
          {title.trailerId && !m.spoilerSafe && pageVisible && !m.isTrailerPlayerOpen ? <div className={`hk-discover-video ${m.showTrailerFrame?'is-playing':''}`}><iframe key={`${title.trailerId}-${m.isMuted}`} title={`${title.title} background trailer`} src={m.getYouTubeUrl(title.trailerId)} onLoad={()=>m.setIsTrailerLoaded(true)} tabIndex={-1} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div> : null}
        </motion.div></AnimatePresence>
        <div className={`hk-discover-shade ${showInfo?'':'is-minimal'}`} />
        <header className="hk-discover-top"><h1>Discover <span lang="ja">発見</span></h1><div><label htmlFor="discover-selection">Your feed</label><select id="discover-selection" value={m.activeVibe} onChange={e=>{m.setActiveVibe(e.target.value);m.setCurrentIndex(0)}}>{m.vibeFilters.map((vibe:any)=><option key={vibe.id} value={vibe.id}>{vibe.label}</option>)}</select></div></header>
        <div key={title.id} className={`hk-discover-caption ${showInfo?'':'is-hidden'}`}>
          <div className="hk-discover-category">{title.genres.slice(0,3).join(' / ')}{title.rating ? <span>★ {title.rating}</span>:null}</div>
          <h2>{title.title}</h2>
          {m.spoilerSafe ? <p className="hk-discover-description">Trailers and summaries are hidden while spoiler-safe mode is on.</p> : <p className="hk-discover-description">{title.description}</p>}
          {m.pendingSaveId===title.id?<p className="hk-discover-resume" role="status">You’re back. Save this title when you’re ready.</p>:null}<div className="hk-discover-title-actions"><Button onClick={()=>m.toggleSave(title.id)}>{m.saved[title.id]?<Check size={16}/>:<Plus size={16}/>} {m.saved[title.id]?'In your list':'Add to my list'}</Button><Link href={getMediaHref(title.id,title.title)}>Title details <ArrowUpRight size={16}/></Link></div>
        </div>
        {m.saved[title.id]&&m.user?<div className="hk-discover-collection"><AddToCollection user={m.user} mediaId={title.id} mediaType="ANIME" className="text-xs" /></div>:null}
        <footer className="hk-discover-dock">
          <div className="hk-discover-tools">
            <button type="button" aria-label={m.liked[title.id]?'Unlike this title':'Like this title'} aria-pressed={Boolean(m.liked[title.id])} onClick={()=>{if(m.ensureSignedIn())m.toggleLike(title.id)}}><Heart size={18} fill={m.liked[title.id]?'currentColor':'none'}/></button>
            <button type="button" aria-label="Not interested in this title" onClick={()=>m.hideTitle(title)}><EyeOff size={18}/></button><button type="button" aria-label="Manage hidden titles" onClick={()=>setHiddenOpen(true)}>Hidden</button><button type="button" aria-label="Share this title" onClick={()=>void m.handleShare()}><Share2 size={17}/></button>
            {title.trailerId && !m.spoilerSafe ? <button type="button" aria-label="Open trailer player" onClick={()=>m.setIsTrailerPlayerOpen(true)}><Play size={17}/></button>:null}
            <button type="button" aria-label={m.isMuted?'Unmute trailer':'Mute trailer'} disabled={m.spoilerSafe} onClick={m.toggleMute}>{m.isMuted||m.spoilerSafe?<VolumeX size={18}/>:<Volume2 size={18}/>}</button>
            <button type="button" aria-label={showInfo?'Hide title information':'Show title information'} aria-pressed={!showInfo} onClick={()=>setShowInfo(value=>!value)}>{showInfo?<Eye size={18}/>:<EyeOff size={18}/>}</button>
          </div>
          <button type="button" className="hk-discover-spoilers" aria-pressed={m.spoilerSafe} onClick={m.toggleSpoilerSafe}>{m.spoilerSafe?<EyeOff size={14}/>:<Eye size={14}/>}Spoiler-safe: {m.spoilerSafe?'on':'off'}</button>
          <div className="hk-discover-paging"><span><small>{m.loadingMore ? "Finding more anime…" : m.currentIndex===m.filteredFeed.length-1&&!m.hasMore ? "You're all caught up" : "Scroll to explore"}</small></span><button type="button" aria-label="Previous anime" disabled={m.currentIndex===0} onClick={m.goToPrev}><ChevronUp size={18}/></button><button type="button" aria-label="Next anime" disabled={m.currentIndex===m.filteredFeed.length-1&&!m.hasMore&&!m.loadingMore} onClick={()=>{if(m.currentIndex>=m.filteredFeed.length-1){if(m.hasMore&&!m.loadingMore)m.loadFeedPage(m.page+1,true)}else m.goToNext()}}><ChevronDown size={18}/></button></div>
        </footer>
        {m.feedError?<p className="hk-discover-loading" role="alert">More titles couldn’t load. <button onClick={m.retryFeed}>Try again</button></p>:null}{m.loadingMore ? <p className="hk-discover-loading" role="status">Loading more titles…</p>:null}
      </> : <div className="hk-discover-empty"><h1>Discover</h1><p role={m.feedError?'alert':'status'}>{m.feedError?'The feed could not load. Please try again.':m.loadingMore?'Loading trailers…':'No visible titles in this selection.'}</p>{!m.loadingMore?<><Button onClick={m.retryFeed}>{m.feedError?'Try again':'Find more titles'}</Button><button onClick={()=>setHiddenOpen(true)}>Manage hidden titles</button></>:null}</div>}
    </main>
    <Dialog open={hiddenOpen} onOpenChange={setHiddenOpen}><DialogContent><DialogHeader><DialogTitle>Off your screen</DialogTitle><DialogDescription>{m.user?"Hidden titles are saved to your account and loaded on your other devices.":"As a guest, hidden titles are remembered in this browser only."} Restore any title to let it appear again.</DialogDescription></DialogHeader>{title?<RelatedTitleHiding title={title} onHide={m.hideRelatedTitles}/>:null}<div className="hk-hidden-titles">{m.hiddenTitles?.length?m.hiddenTitles.map((item:any)=><div key={item.id}><span>{item.title}</span><Button variant="outline" onClick={()=>m.restoreTitle(item.id)}>Restore</Button></div>):<p>You haven't hidden any titles.</p>}</div></DialogContent></Dialog>
    <Dialog open={m.isTrailerPlayerOpen} onOpenChange={m.setIsTrailerPlayerOpen}><DialogContent className="hk-trailer-dialog"><DialogHeader><DialogTitle>{title?.title || 'Trailer'}</DialogTitle><DialogDescription>Play, pause, or watch in fullscreen.</DialogDescription></DialogHeader>{title?.trailerId&&!m.spoilerSafe&&pageVisible&&m.isTrailerPlayerOpen?<iframe title={`${title.title} trailer player`} src={m.getControllableYouTubeUrl(title.trailerId)} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen/>:null}</DialogContent></Dialog>
  </div>
}
