"use client"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/Navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, RefreshCw, Heart, ThumbsUp, ThumbsDown } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { buildAiRecommendations, fetchTrendingCards } from "@/lib/ai-recommendations"

export default function AIRecommendationsPage() {
  const { user } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [feedback, setFeedback] = useState({})
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [subtitle, setSubtitle] = useState("Trending right now")
  const [error, setError] = useState("")

  const handleFeedback = (id, type) => {
    setFeedback((prev) => ({
      ...prev,
      [id]: prev[id] === type ? null : type,
    }))
  }

  const loadRecommendations = async () => {
    setLoading(true)
    setError("")

    try {
      if (!user) {
        const trending = await fetchTrendingCards({ limit: 9 })
        setRecommendations(trending)
        setSubtitle("Trending right now")
        return
      }

      const { data, error } = await client
        .from("list_entries")
        .select("media_id, status, progress, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(2000)

      if (error || !data?.length) {
        const trending = await fetchTrendingCards({ limit: 9 })
        setRecommendations(trending)
        setSubtitle("Trending right now")
        return
      }

      const watchedIds = new Set(
        data.map((entry) => Number(entry.media_id)).filter(Number.isFinite),
      )

      const aiResult = await buildAiRecommendations({
        listEntries: data,
        excludeIds: watchedIds,
        limit: 9,
      })

      if (aiResult.items.length === 0) {
        const trending = await fetchTrendingCards({ excludeIds: watchedIds, limit: 9 })
        setRecommendations(trending)
        setSubtitle("Trending right now")
        return
      }

      setRecommendations(aiResult.items)
      setSubtitle(aiResult.subtitle)
    } catch (err) {
      setError(err.message || "Could not load recommendations.")
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadRecommendations()
    setIsRefreshing(false)
  }

  useEffect(() => {
    loadRecommendations()
  }, [user])

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="pb-24 pt-20 md:pb-8">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-violet-500/50 rounded-2xl blur-lg" />
                <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Brain className="h-7 w-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                  AI Recommendations
                  <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">Beta</Badge>
                </h1>
                <p className="text-muted-foreground">{subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" className="gap-2 rounded-xl bg-transparent" onClick={handleRefresh}>
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          {loading ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-16 text-center text-muted-foreground">
                Loading recommendations...
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-16 text-center text-muted-foreground">{error}</CardContent>
            </Card>
          ) : recommendations.length === 0 ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-16 text-center text-muted-foreground">
                No recommendations yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((item) => (
                <Card key={item.id} className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
                  <CardContent className="p-4 flex gap-4">
                    <Link href={`/media/${item.id}`} className="shrink-0">
                      <img
                        src={item.image || "/placeholder.svg"}
                        alt={item.title}
                        className="h-24 w-16 rounded-xl object-cover"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/media/${item.id}`}>
                        <h3 className="font-semibold text-foreground truncate">{item.title}</h3>
                      </Link>
                      <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                      {typeof item.score === "number" && (
                        <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          {item.score.toFixed(1)}/10
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <Link href={`/media/${item.id}`}>
                          <Button size="sm" variant="secondary" className="h-8">
                            Open
                          </Button>
                        </Link>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "h-8 w-8",
                            feedback[item.id] === "up" && "text-emerald-400",
                          )}
                          onClick={() => handleFeedback(item.id, "up")}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "h-8 w-8",
                            feedback[item.id] === "down" && "text-rose-400",
                          )}
                          onClick={() => handleFeedback(item.id, "down")}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
