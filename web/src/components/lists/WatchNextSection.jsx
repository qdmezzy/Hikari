"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react"
import { buildWatchNext } from "@/lib/ai-recommendations"

// "Watch next" row for the Plan to Watch tab: the next season of anime you just
// finished, plus your backlog ranked by taste.
export function WatchNextSection({ entries = [] }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  // Key the fetch on which completed/planned titles exist, so it re-runs when
  // the list changes but not on every unrelated re-render.
  const signature = entries
    .filter((entry) => entry.status === "completed" || entry.status === "plan_to_watch")
    .map((entry) => `${entry.media_id}:${entry.status}`)
    .sort()
    .join(",")

  useEffect(() => {
    let active = true
    if (!signature) {
      setItems([])
      setLoading(false)
      return
    }

    const run = async () => {
      setLoading(true)
      try {
        const result = await buildWatchNext({ listEntries: entries, limit: 10 })
        if (active) setItems(result?.items || [])
      } catch {
        if (active) setItems([])
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const scrollerRef = useRef(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    updateArrows()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener("scroll", updateArrows, { passive: true })
    window.addEventListener("resize", updateArrows)
    return () => {
      el.removeEventListener("scroll", updateArrows)
      window.removeEventListener("resize", updateArrows)
    }
  }, [updateArrows, items.length, loading])

  const scrollByDir = (dir) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(el.clientWidth - 160, 320), behavior: "smooth" })
  }

  if (!loading && !items.length) return null

  return <section className="hk-next-up" aria-label="Watch next">
    <header><div><span className="hk-page-jp" lang="ja">次に観る</span><h2>Watch next</h2></div><div className="hk-next-navigation">{canLeft || canRight ? <><button type="button" aria-label="Previous suggestions" disabled={!canLeft} onClick={()=>scrollByDir(-1)}><ChevronLeft size={17}/></button><button type="button" aria-label="More suggestions" disabled={!canRight} onClick={()=>scrollByDir(1)}><ChevronRight size={17}/></button></>:null}</div></header>
    {loading ? <p className="hk-next-loading" role="status">Finding follow-up seasons and titles from your planned list…</p> : <div ref={scrollerRef} className="hk-next-shelf">{items.map((item,index)=><Link key={item.id} href={"/media/"+item.id} className="hk-next-title"><div className="hk-next-art"><Image src={item.image || "/placeholder.svg"} alt="" fill sizes="90px"/></div><div><small>{item.kind==="sequel" ? "Next season" : "From your list"}</small><h3>{item.title}</h3><p>{item.kind==="sequel" ? item.reason : item.episodes ? item.episodes+" "+(item.type==="manga" ? "chapters" : "episodes") : item.type==="manga" ? "Manga" : "Anime"}</p><span>View title <ArrowUpRight size={12}/></span></div></Link>)}</div>}
  </section>
}
