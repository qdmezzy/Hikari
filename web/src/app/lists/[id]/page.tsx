"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Navigation } from "@/components/layout/Navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookMarked, Globe, Lock } from "lucide-react"
import Link from "next/link"
import client from "@/lib/client"

const MEDIA_BY_IDS = `
query ($ids: [Int], $perPage: Int) {
  Page(perPage: $perPage) {
    media(id_in: $ids, sort: POPULARITY_DESC) {
      id
      type
      title { romaji english }
      coverImage { large }
      episodes
      chapters
    }
  }
}
`

const chunkIds = (ids: number[], size: number) => {
  const batches = []
  for (let i = 0; i < ids.length; i += size) {
    batches.push(ids.slice(i, i + size))
  }
  return batches
}

export default function CustomListPage() {
  const params = useParams()
  const listId = typeof params?.id === "string" ? params.id : ""
  const [list, setList] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    const loadList = async () => {
      if (!listId) return
      setLoading(true)
      setError("")

      const { data: listData, error: listError } = await client
        .from("custom_lists")
        .select("id, name, description, is_public, created_at")
        .eq("id", listId)
        .single()

      if (listError || !listData) {
        setError("List not found or not available.")
        setLoading(false)
        return
      }

      const { data: listItems, error: itemsError } = await client
        .from("custom_list_items")
        .select("id, list_id, media_id, media_type, added_at")
        .eq("list_id", listId)

      if (itemsError) {
        setError("Could not load list items.")
        setLoading(false)
        return
      }

      const ids = Array.from(new Set((listItems || []).map((item) => item.media_id).filter(Boolean)))
      const mediaById = new Map()

      try {
        const batches = chunkIds(ids, 50)
        for (const batch of batches) {
          const res = await fetch("/api/anilist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: MEDIA_BY_IDS,
              variables: { ids: batch, perPage: batch.length },
            }),
          })
          const json = await res.json()
          if (!res.ok || json?.errors) {
            throw new Error(json?.errors?.[0]?.message || "Failed to load AniList data")
          }
          const mediaList = json?.data?.Page?.media ?? []
          mediaList.forEach((media) => {
            mediaById.set(media.id, media)
          })
        }
      } catch (err) {
        console.error("Failed to hydrate custom list items:", err)
      }

      if (!active) return
      setList(listData)
      setItems(
        (listItems || []).map((item) => ({
          ...item,
          media: mediaById.get(item.media_id) || null,
        })),
      )
      setLoading(false)
    }

    loadList()

    return () => {
      active = false
    }
  }, [listId])

  const listTitle = list?.name || "Custom List"
  const listDescription = list?.description || "A curated Hikari playlist."

  return (
    <div className="min-h-screen bg-background noise-overlay">
      <Navigation />
      <main className="pb-24 pt-24 md:pb-8">
        <div className="px-4 py-8 md:px-8">
          <div className="mx-auto max-w-4xl">
            {loading ? (
              <Card className="bg-card/50 border-border/50">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BookMarked className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>Loading list...</p>
                </CardContent>
              </Card>
            ) : error ? (
              <Card className="bg-card/50 border-border/50">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BookMarked className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>{error}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground md:text-3xl">{listTitle}</h1>
                    <p className="text-muted-foreground">{listDescription}</p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    {list?.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {list?.is_public ? "Public" : "Private"}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {items.length ? (
                    items.map((item) => {
                      const title =
                        item?.media?.title?.english ||
                        item?.media?.title?.romaji ||
                        "Unknown title"
                      const coverImage = item?.media?.coverImage?.large || "/placeholder.svg"
                      const isManga = item?.media_type === "MANGA"
                      const totalUnits = isManga
                        ? item?.media?.chapters ?? null
                        : item?.media?.episodes ?? null
                      return (
                        <Card key={item.id} className="bg-card/50 border-border/50">
                          <CardContent className="flex items-center gap-4 p-4">
                            <img
                              src={coverImage}
                              alt={title}
                              className="h-16 w-12 rounded-lg object-cover"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{title}</p>
                              <p className="text-xs text-muted-foreground">
                                {isManga ? "Manga" : "Anime"}
                                {totalUnits ? ` · ${totalUnits} ${isManga ? "chapters" : "episodes"}` : ""}
                              </p>
                            </div>
                            <Link href={`/media/${item.media_id}`}>
                              <Button size="sm" variant="secondary">
                                Open
                              </Button>
                            </Link>
                          </CardContent>
                        </Card>
                      )
                    })
                  ) : (
                    <Card className="bg-card/50 border-border/50">
                      <CardContent className="py-10 text-center text-muted-foreground">
                        <BookMarked className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                        <p>No titles yet.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
