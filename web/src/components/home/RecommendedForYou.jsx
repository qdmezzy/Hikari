"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw, Sparkles } from "lucide-react"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { AnimeCard } from "@/components/media/AnimeCard"
import { buildAiRecommendations } from "@/lib/ai-recommendations"

export function RecommendedForYou() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [subtitle, setSubtitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [shuffling, setShuffling] = useState(false)
  const entriesRef = useRef([])

  // Build recommendations from already-loaded list entries with a given seed.
  const build = useCallback(async (seed) => {
    const data = entriesRef.current
    if (!data.length) return
    const excludeIds = new Set(data.map((entry) => Number(entry.media_id)))
    try {
      const result = await buildAiRecommendations({
        listEntries: data,
        excludeIds,
        limit: 12,
        sessionSeed: seed,
      })
      setItems(result?.items || [])
      setSubtitle(result?.subtitle || "")
    } catch (err) {
      console.error("Failed to build recommendations:", err)
      setItems([])
    }
  }, [])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!user) {
        entriesRef.current = []
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
        entriesRef.current = []
        setItems([])
        setLoading(false)
        return
      }
      entriesRef.current = data
      // Seed with user + today's date: stable while you browse, fresh each day.
      const dayKey = new Date().toISOString().slice(0, 10)
      await build(`${user.id}:${dayKey}`)
      if (active) setLoading(false)
    }
    run()
    return () => {
      active = false
    }
  }, [user, build])

  const handleShuffle = async () => {
    if (shuffling || !entriesRef.current.length) return
    setShuffling(true)
    await build(`${user.id}:${Date.now()}:${Math.random()}`)
    setShuffling(false)
  }

  // Hidden for signed-out users and when there's nothing to recommend yet.
  if (!user) return null
  if (!loading && !items.length) return null

  return (
    <section className="px-4 py-16 relative">
      <div className="max-w-7xl mx-auto relative">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <div>
              <p className="font-jp text-xs font-medium tracking-[0.3em] text-primary/70">おすすめ</p>
              <h2 className="text-2xl font-bold text-foreground">Recommended for you</h2>
              <p className="text-sm text-muted-foreground">
                {loading ? "Reading your taste…" : subtitle || "Picked from your ratings & watch history"}
              </p>
            </div>
          </div>

          {!loading ? (
            <button
              type="button"
              onClick={handleShuffle}
              disabled={shuffling}
              className="group flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 transition-transform ${shuffling ? "animate-spin" : "group-hover:rotate-90"}`} />
              <span className="hidden sm:inline">Shuffle</span>
            </button>
          ) : null}
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
