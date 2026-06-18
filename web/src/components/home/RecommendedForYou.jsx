"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Sparkles, Star } from "lucide-react"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { getMediaHref } from "@/lib/anilist"
import { buildAiRecommendations } from "@/lib/ai-recommendations"

export function RecommendedForYou() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [subtitle, setSubtitle] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!user) {
        setItems([])
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await client
        .from("list_entries")
        .select("media_id, status, score, media_type, updated_at")
        .eq("user_id", user.id)

      if (!active) return
      if (error || !data?.length) {
        setItems([])
        setLoading(false)
        return
      }
      try {
        const excludeIds = new Set(data.map((entry) => Number(entry.media_id)))
        const result = await buildAiRecommendations({
          listEntries: data,
          excludeIds,
          limit: 12,
          sessionSeed: user.id,
        })
        if (!active) return
        setItems(result?.items || [])
        setSubtitle(result?.subtitle || "")
      } catch (err) {
        console.error("Failed to build recommendations:", err)
        if (active) setItems([])
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [user])

  // Hidden for signed-out users and when there's nothing to recommend yet.
  if (!user) return null
  if (!loading && !items.length) return null

  return (
    <section className="px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Recommended for you</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? "Reading your taste…" : subtitle || "Picked from your ratings and watch history"}
            </p>
          </div>
        </div>

        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:thin]">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-[150px] flex-shrink-0 sm:w-[170px]">
                  <div className="aspect-[2/3] animate-pulse rounded-xl border border-white/5 bg-card/60" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-card/60" />
                </div>
              ))
            : items.map((item) => (
                <Link
                  key={item.id}
                  href={getMediaHref(item.id, item.title)}
                  className="group w-[150px] flex-shrink-0 sm:w-[170px]"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/5 shadow-lg">
                    <Image
                      src={item.image || "/placeholder.svg"}
                      alt={item.title}
                      fill
                      sizes="170px"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    {item.score ? (
                      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                        <Star className="h-3 w-3 fill-current text-amber-400" />
                        <span className="text-xs font-bold text-white">{item.score.toFixed(1)}</span>
                      </div>
                    ) : null}
                    <p className="absolute inset-x-0 bottom-0 line-clamp-2 p-2 text-xs font-semibold text-white">
                      {item.title}
                    </p>
                  </div>
                  {item.matchedGenres?.length ? (
                    <p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">
                      {item.matchedGenres.slice(0, 2).join(" • ")}
                    </p>
                  ) : null}
                </Link>
              ))}
        </div>
      </div>
    </section>
  )
}
