"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
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

  return <section className="hk-home-section">
    <div className="hk-section-title"><h2><small>From your watch history</small>More your kind of thing.</h2>{!loading ? <button type="button" onClick={handleShuffle} disabled={shuffling} className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw size={13} className={shuffling ? "animate-spin" : ""} />Shuffle</button> : null}</div>
    {subtitle && !loading ? <p className="mb-5 text-xs text-muted-foreground">{subtitle}</p> : null}
    <div className="hk-home-posters">{loading ? Array.from({length:6},(_,index) => <div key={index} className="hk-poster-art animate-pulse" />) : items.map(item => <AnimeCard key={item.id} id={String(item.id)} title={item.title} image={item.image} rating={item.score || undefined} episodes={item.episodes || undefined} type="anime" />)}</div>
  </section>
}
