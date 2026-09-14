"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BookMarked, Globe, Loader2, Lock, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import client from "@/lib/client"
import { fetchAniListMediaByIds } from "@/lib/anilist"

export function CollectionsSection({ user }) {
  const router = useRouter()
  const [loadError, setLoadError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [lists, setLists] = useState([])
  const [listMeta, setListMeta] = useState({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const loadLists = useCallback(async () => {
    if (!user) {
      setLists([])
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError("")
    const { data, error } = await client
      .from("custom_lists")
      .select("id, name, description, is_public, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (error) {
      setLoadError("Your collections couldn’t be loaded. Please try again.")
      setLists([])
      setLoading(false)
      return
    }
    setLists(data || [])
    setLoading(false)

    // Cover stacks + counts: first three items of each list, newest first.
    const listIds = (data || []).map((list) => list.id)
    if (!listIds.length) {
      setListMeta({})
      return
    }
    try {
      const { data: items, error: itemsError } = await client
        .from("custom_list_items")
        .select("list_id, media_id, added_at")
        .in("list_id", listIds)
        .order("added_at", { ascending: false })
      if (itemsError) throw itemsError
      const grouped = Object.fromEntries(listIds.map(id => [id, {count: 0, mediaIds: []}]))
      ;(items || []).forEach((item) => {
        const group = grouped[item.list_id] || (grouped[item.list_id] = { count: 0, mediaIds: [] })
        group.count += 1
        if (group.mediaIds.length < 3) group.mediaIds.push(Number(item.media_id))
      })
      const coverIds = Object.values(grouped).flatMap((group) => group.mediaIds)
      let mediaById = new Map()
      if (coverIds.length) {
        try {
          mediaById = await fetchAniListMediaByIds(coverIds)
        } catch {
          /* covers are decoration — counts still render */
        }
      }
      const meta = {}
      Object.entries(grouped).forEach(([listId, group]) => {
        meta[listId] = {
          count: group.count,
          covers: group.mediaIds
            .map((id) => {
              const media = mediaById.get(id)
              return media?.coverImage?.large || media?.coverImage?.extraLarge || null
            })
            .filter(Boolean),
        }
      })
      setListMeta(meta)
    } catch {
      setListMeta({})
    }
  }, [user])

  useEffect(() => {
    loadLists()
  }, [loadLists])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!user || creating) return
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Give your collection a name.")
      return
    }
    setCreating(true)
    const { data, error } = await client
      .from("custom_lists")
      .insert({
        user_id: user.id,
        name: trimmed,
        description: description.trim() || null,
        is_public: isPublic,
      })
      .select("id, name, description, is_public, updated_at")
      .single()

    setCreating(false)
    if (error) {
      console.error("Failed to create collection:", error)
      toast.error("Couldn't create that collection. Please try again.")
      return
    }
    setLists((current) => [data, ...current])
    setName("")
    setDescription("")
    setIsPublic(false)
    setOpen(false)
    toast.success("Collection created — now add some titles.")
    router.push(`/lists/${data.id}?add=1`)
  }

  const handleDelete = async (list) => {
    if (!list?.id || !user || deletingId) return
    setDeletingId(list.id)
    const { error } = await client.from("custom_lists").delete().eq("id", list.id).eq("user_id", user.id)
    setDeletingId(null)
    if (error) {
      toast.error("Couldn't delete that collection.")
      return
    }
    setLists((current) => current.filter((item) => item.id !== list.id))
    setDeleteTarget(null)
    toast.success("Collection deleted. Your tracked titles are unchanged.")
  }

  return (
    <section className="rv-collections">
      <div className="rv-collection-toolbar">
        <div><span className="hk-shelf-note" lang="ja">本棚 / YOUR OWN LITTLE ARCHIVE</span><h2>Collections</h2><p>Comfort watches. Beautiful disasters. Whatever belongs together to you.</p></div>
        <Button onClick={() => setOpen(true)}><Plus size={16} />New collection</Button>
      </div>
      {loading ? <div className="rv-collection-grid" role="status" aria-label="Loading collections">{[1,2,3].map(i => <div key={i} className="rv-collection-cover animate-pulse" />)}</div> : loadError ? (
        <div className="rv-error" role="alert"><p>{loadError}</p><Button variant="outline" onClick={loadLists}>Try again</Button></div>
      ) : lists.length ? <div className="rv-collection-grid">{lists.map((list, shelfIndex) => {
        const meta = listMeta[list.id]
        return <article key={list.id} className="rv-collection-card" data-shelf={shelfIndex % 3}>
          <Link href={`/lists/${list.id}`} aria-label={`Open ${list.name}`}>
            <div className="rv-collection-cover"><span className="hk-shelf-spine" aria-hidden="true">{list.name}</span>{meta?.covers?.length ? meta.covers.map((cover, i) => <img key={i} src={cover} alt="" loading="lazy" />) : <span className="hk-shelf-blank" lang="ja">余白</span>}<span className="hk-shelf-label">{list.is_public ? "OPEN SHELF" : "PERSONAL COPY"}</span></div>
          </Link>
          <div className="rv-collection-card-footer">
            <div className="min-w-0"><h3><Link href={`/lists/${list.id}`}>{list.name}</Link></h3><small>{list.is_public ? <Globe size={12} /> : <Lock size={12} />}{list.is_public ? "Public" : "Only you"}<span>·</span>{meta ? `${meta.count} titles` : "Collection"}</small></div>
            <Button size="icon" variant="ghost" aria-label={`Delete ${list.name}`} onClick={() => setDeleteTarget(list)}><Trash2 size={15} /></Button>
          </div>
          {list.description ? <p className="line-clamp-2">{list.description}</p> : null}
        </article>
      })}</div> : <div className="rv-empty"><BookMarked className="mx-auto mb-5 text-muted-foreground" size={36} strokeWidth={1.2} /><h3>No collections yet</h3><p>Create a collection, add titles from your library, and choose whether to make it public.</p><Button onClick={() => setOpen(true)}><Plus size={16} />Make your first collection</Button></div>}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={value => { if (!value && !deletingId) setDeleteTarget(null) }}>
        <DialogContent role="alertdialog"><DialogHeader><DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle><DialogDescription>This removes the collection and its contents. Your watch progress and tracked titles will stay in My List. This can’t be undone.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={Boolean(deletingId)} onClick={() => setDeleteTarget(null)}>Keep collection</Button><Button variant="destructive" disabled={Boolean(deletingId)} onClick={() => handleDelete(deleteTarget)}>{deletingId ? "Deleting…" : "Delete collection"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>New collection</DialogTitle>
              <DialogDescription>
                Start with a name, then choose titles from your library. You can also add titles from any anime or manga page.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="collection-name">Name</Label>
                <Input
                  id="collection-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Comfort watches"
                  maxLength={80}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-desc">Description (optional)</Label>
                <Textarea
                  id="collection-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this collection about?"
                  maxLength={300}
                  className="min-h-20"
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/50 p-3">
                <div>
                  <Label htmlFor="collection-public" className="font-medium">Public collection</Label>
                  <p className="text-xs text-muted-foreground">Anyone with the link can view it.</p>
                </div>
                <Switch id="collection-public" checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create & choose titles
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
