"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { AnimeCard } from "@/components/media/AnimeCard"
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
        // Seed with the user + today's date so the lineup stays stable while you
        // browse, but refreshes to a new set each day (and whenever your list changes).
        const dayKey = new Date().toISOString().slice(0, 10)
        const result = await buildAiRecommendations({
          listEntries: data,
          excludeIds,
          limit: 12,
          sessionSeed: `${user.id}:${dayKey}`,
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
    <section className="px-4 py-16 relative">
      <div className="max-w-7xl mx-auto relative">
        <div className="mb-8 flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <div>
            <p className="font-jp text-xs font-medium tracking-[0.3em] text-primary/70">おすすめ</p>
            <h2 className="text-2xl font-bold text-foreground">Recommended for you</h2>
            <p className="text-sm text-muted-foreground">
              {loading ? "Reading your taste…" : subtitle || "Picked from your ratings & watch history"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="aspect-[3/4] rounded-2xl border border-white/5 bg-white/5 animate-pulse" />
              ))
            : items.map((item, index) => (
                <AnimeCard
                  key={item.id}
                  id={String(item.id)}
                  title={item.title}
                  image={item.image}
                  rating={item.score || undefined}
                  episodes={item.episodes || undefined}
                  type="anime"
                  index={index}
                />
              ))}
        </div>
      </div>
    </section>
  )
}
