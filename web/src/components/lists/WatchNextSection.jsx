"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Sparkles, PlayCircle, Star } from "lucide-react"
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
  const lastSignatureRef = useRef(null)

  useEffect(() => {
    let active = true
    if (!signature) {
      setItems([])
      setLoading(false)
      return
    }
    if (lastSignatureRef.current === signature) return
    lastSignatureRef.current = signature

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

  return (
    <section className="relative mb-10 overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-5 sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/8 blur-3xl"
      />

      <div className="relative mb-5 flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-jp text-[11px] font-medium tracking-[0.3em] text-primary/70">次に見る</p>
            <h2 className="text-xl font-bold text-foreground">Watch next</h2>
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
              Sequels to what you finished, plus your best backlog picks.
            </p>
          </div>
        </div>
        {canLeft || canRight ? (
          <div className="hidden items-center gap-1.5 sm:flex">
            <button
              type="button"
              aria-label="Scroll left"
              disabled={!canLeft}
              onClick={() => scrollByDir(-1)}
              className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-card text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-30 disabled:hover:border-border/60 disabled:hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Scroll right"
              disabled={!canRight}
              onClick={() => scrollByDir(1)}
              className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-card text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-30 disabled:hover:border-border/60 disabled:hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative">
        {canLeft ? (
          <div className="pointer-events-none absolute inset-y-0 -left-1 z-10 w-12 bg-gradient-to-r from-card/90 to-transparent" />
        ) : null}
        {canRight ? (
          <div className="pointer-events-none absolute inset-y-0 -right-1 z-10 w-12 bg-gradient-to-l from-card/90 to-transparent" />
        ) : null}
        <div
          ref={scrollerRef}
          className="-mx-1 flex snap-x gap-4 overflow-x-auto scroll-smooth px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="w-40 flex-shrink-0">
                  <div className="aspect-[3/4] animate-pulse rounded-2xl bg-muted/40" />
                  <div className="mt-2.5 h-3.5 w-4/5 animate-pulse rounded bg-muted/40" />
                  <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-muted/30" />
                </div>
              ))
            : items.map((item) => (
                <Link
                  key={item.id}
                  href={`/media/${item.id}`}
                  className="group w-40 flex-shrink-0 snap-start"
                >
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-secondary ring-1 ring-border/40 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:shadow-primary/10 group-hover:ring-primary/50">
                    <Image
                      src={item.image || "/placeholder.svg"}
                      alt={item.title}
                      fill
                      sizes="160px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                    {item.kind === "sequel" ? (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-md">
                        <PlayCircle className="h-3 w-3" />
                        Next season
                      </span>
                    ) : null}
                    {item.score ? (
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                        <Star className="h-2.5 w-2.5 fill-current text-primary" />
                        {item.score.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                    {item.title}
                  </h3>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                    {item.kind === "sequel"
                      ? item.reason
                      : [
                          item.type === "manga" ? "Manga" : null,
                          item.episodes ? `${item.episodes} ${item.type === "manga" ? "ch" : "eps"}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "On your list"}
                  </p>
                </Link>
              ))}
        </div>
      </div>
    </section>
  )
}
