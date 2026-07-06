"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Sparkles, PlayCircle } from "lucide-react"
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

  if (!loading && !items.length) return null

  return (
    <section className="mb-8 rounded-2xl border border-border/50 bg-card/40 p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <Sparkles className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-bold text-foreground">Watch next</h2>
          <p className="text-xs text-muted-foreground">
            Next seasons of what you finished, and your best plan-to-watch picks.
          </p>
        </div>
      </div>

      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-60 w-36 flex-shrink-0 animate-pulse rounded-xl border border-white/5 bg-white/5"
              />
            ))
          : items.map((item) => (
              <Link
                key={item.id}
                href={`/media/${item.id}`}
                className="group w-36 flex-shrink-0"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-secondary ring-1 ring-border/40 transition-shadow group-hover:ring-primary/40">
                  <Image
                    src={item.image || "/placeholder.svg"}
                    alt={item.title}
                    fill
                    sizes="144px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
                  {item.kind === "sequel" ? (
                    <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm backdrop-blur-sm">
                      <PlayCircle className="h-3 w-3" />
                      Next season
                    </span>
                  ) : null}
                  {item.score ? (
                    <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                      ★ {item.score.toFixed(1)}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
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
    </section>
  )
}
