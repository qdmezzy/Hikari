"use client"

import Image from "next/image"
import Link from "next/link"
import { useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useMotionPreference } from "@/hooks/useMotionPreference"
import { ArrowUpRight, Plus, Star } from "lucide-react"
import { FEATURED_ROTATION_MS } from "@/lib/featured-rotation.mjs"
import { Button } from "@/components/ui/button"
import { getMediaHref } from "@/lib/anilist"

type FeaturedTitle = { id: number; title: string; nativeTitle?: string; heroTitle?: string; banner?: string; cover: string; rating?: number; genres?: string[]; heroDescription?: string; description?: string; studio?: string; episodes?: number }
type Props = {
  items: FeaturedTitle[]; index: number; onSelect: (index: number) => void; onAdd: () => void;
  adding: boolean; loading: boolean; error: string; onRetry: () => void;
  paused: boolean; running: boolean; onPause: () => void; onFocus: (value: boolean) => void;
}
export function FeaturedCinema({ items, index, onSelect, onAdd, adding, loading, error, onRetry, paused, running, onPause, onFocus }: Props) {
  const title = items[index]
  const reduced = useMotionPreference()
  const touch = useRef<{ x: number; y: number } | null>(null)
  const move = (delta: number) => { if (items.length) onSelect((index + delta + items.length) % items.length) }
  return <section className="hk-cinema" aria-label="Featured anime" aria-roledescription="carousel"
    onFocusCapture={event => onFocus(event.target.matches(":focus-visible"))} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) onFocus(false) }}
    onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY } }}
    onTouchEnd={event => { const start = touch.current; touch.current = null; if (!start) return; const end = event.changedTouches[0]; const dx = end.clientX - start.x; if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(end.clientY - start.y)) move(dx < 0 ? 1 : -1) }}>
    <div className="hk-cinema-stage">
      {title ? <AnimatePresence initial={false} mode="sync"><motion.div className="hk-cinema-art" key={title.id} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced ? 0 : 1.1}}><Image className="hk-cinema-drift" src={title.banner || title.cover} alt="" fill priority sizes="(min-width: 1180px) calc(100vw - 216px), 100vw" /></motion.div></AnimatePresence> : null}
      <div className="hk-cinema-shade" />
      <div className="hk-cinema-top"><span>Hikari <i>/</i> Home</span><Link href="/lists">Your library <ArrowUpRight size={15} /></Link></div>
      <div className="hk-cinema-content">
        {loading ? <div className="hk-cinema-skeleton" role="status"><div /><div /><p>Loading featured anime…</p></div> : title ? <>
          <div className="hk-cinema-overline"><span>In the spotlight</span><span lang="ja">今週の注目</span></div>
          {title.nativeTitle ? <p className="hk-cinema-native" key={`native-${title.id}`} lang="ja">{title.nativeTitle}</p> : null}
          <motion.h1 key={title.id} title={title.title} initial={{opacity:0,y:reduced ? 0 : 15}} animate={{opacity:1,y:0}} transition={{duration:.4}}>{title.heroTitle || title.title}</motion.h1>
          <div className="hk-cinema-meta" key={`meta-${title.id}`}>{title.rating ? <span><Star size={13} fill="currentColor" />{title.rating}</span> : null}<span>{title.genres?.slice(0,3).join(" / ")}</span>{title.episodes ? <span>{title.episodes} episodes</span> : null}</div>
          <p className="hk-cinema-description" key={`description-${title.id}`}>{title.heroDescription || title.description}</p>
          <div className="hk-cinema-actions"><Button onClick={onAdd} disabled={adding}><Plus size={17} />{adding ? "Adding…" : "Add to my list"}</Button><Link href={getMediaHref(title.id,title.title)}>Explore this title <ArrowUpRight size={17} /></Link></div>
        </> : <><h1>Find your next watch.</h1><p role={error ? "alert" : undefined}>{error || "The featured titles are temporarily unavailable."}</p><Button onClick={onRetry} variant="outline">Try again</Button></>}
      </div>
      {items.length ? <div className="hk-cinema-counter" aria-hidden="true"><strong>{String(index+1).padStart(2,"0")}</strong><span>/ {String(items.length).padStart(2,"0")}</span></div> : null}
    </div>
    <div className="hk-cinema-bottom">
      <div className="hk-cinema-picks">{items.map((item,i) => <button type="button" key={item.id} aria-pressed={i===index} aria-label={"Feature "+item.title} onClick={() => onSelect(i)}><Image src={item.cover} width={42} height={60} alt="" /><span><small>{i===index ? "Now showing" : "Up next"}</small><strong>{item.title}</strong></span>{i===index ? <i key={`${index}-${running}`} className="hk-cinema-timer" data-running={running} style={{animationDuration: `${FEATURED_ROTATION_MS}ms`}} aria-hidden="true" /> : null}</button>)}</div>
      <button type="button" className="hk-cinema-motion-toggle" onClick={onPause} aria-pressed={paused}>{paused ? "Resume automatic rotation" : "Pause automatic rotation"}</button>
    </div>
  </section>
}
