"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { BookMarked, Check, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import client from "@/lib/client"
import { createCollectionWithTitle } from "@/lib/collection-save.mjs"
import { readAllRows } from "@/lib/read-all-rows.mjs"

export function AddToCollection(props) {
  return <CollectionPicker key={`${props.user?.id}:${props.mediaId}`} {...props} />
}

function CollectionPicker({ user, mediaId, mediaType = "ANIME", className }) {
  const [open, setOpen] = useState(false)
  const [lists, setLists] = useState([])
  const [memberOf, setMemberOf] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [loadError, setLoadError] = useState("")
  const requestId = useRef(0)
  const writeLock = useRef(false)

  const numericMediaId = Number(mediaId)
  const userId = user?.id

  const load = useCallback(async () => {
    if (!userId || !Number.isSafeInteger(numericMediaId) || numericMediaId <= 0) return
    const request = ++requestId.current
    setLoading(true)
    setLoadError("")
    try {
    const { data: listData, error: listError } = await readAllRows(() => client
        .from("custom_lists")
        .select("id, name, is_public, updated_at")
        .eq("user_id", userId), { isActive: () => request === requestId.current })
    if (listError) throw new Error("Collection loading failed")
    const itemData = []
    // Query only owned collections, not every public collection containing this title.
    for (let offset = 0; offset < listData.length; offset += 100) {
      if (request !== requestId.current) return
      const ids = listData.slice(offset, offset + 100).map(list => list.id)
      const { data, error } = await readAllRows(() => client.from("custom_list_items")
        .select("id, list_id, media_id").eq("media_id", numericMediaId).in("list_id", ids),
        { isActive: () => request === requestId.current })
      if (error) throw new Error("Collection membership loading failed")
      itemData.push(...data)
    }
    if (request !== requestId.current) return
    setLists([...(listData || [])].sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
    const owned = new Set((listData || []).map((l) => l.id))
    setMemberOf(new Set((itemData || []).filter((i) => owned.has(i.list_id)).map((i) => i.list_id)))
    } catch {
      if (request === requestId.current) setLoadError("Couldn't load your collections. Try again.")
    } finally {
      if (request === requestId.current) setLoading(false)
    }
  }, [userId, numericMediaId])

  useEffect(() => {
    if (open) load()
    return () => { requestId.current++ }
  }, [open, load])

  const toggleMembership = async (list) => {
    if (!user || writeLock.current || loading || loadError) return
    writeLock.current = true
    const isMember = memberOf.has(list.id)
    setBusyId(list.id)
    try {
      if (isMember) {
        const { error } = await client
          .from("custom_list_items")
          .delete()
          .eq("list_id", list.id)
          .eq("media_id", numericMediaId)
        if (error) throw error
        setMemberOf((prev) => {
          const next = new Set(prev)
          next.delete(list.id)
          return next
        })
        toast.success(`Removed from ${list.name}`)
      } else {
        const { error } = await client.from("custom_list_items").insert({
          list_id: list.id,
          media_id: numericMediaId,
          media_type: mediaType || "ANIME",
        })
        if (error) throw error
        setMemberOf((prev) => new Set(prev).add(list.id))
        toast.success(`Added to ${list.name}`)
      }
    } catch (err) {
      console.error("Failed to update collection:", err)
      toast.error("Couldn't update that collection.")
    } finally {
      writeLock.current = false
      setBusyId(null)
    }
  }

  const handleCreateAndAdd = async (e) => {
    e.preventDefault()
    if (!user || writeLock.current || loading || loadError) return
    const trimmed = newName.trim()
    if (!trimmed) return
    writeLock.current = true
    setCreating(true)
    try {
      const { list, added } = await createCollectionWithTitle(client, user.id, trimmed, numericMediaId, mediaType)
      setLists((prev) => [list, ...prev])
      if (added) setMemberOf((prev) => new Set(prev).add(list.id))
      setNewName("")
      if (added) toast.success(`Added to ${list.name}`)
      else toast.error(`Created ${list.name}, but the title wasn't added. Select the collection to retry.`)
    } catch (err) {
      console.error("Failed to create collection:", err)
      toast.error("Couldn't create that collection.")
    } finally {
      writeLock.current = false
      setCreating(false)
    }
  }

  if (!user) return null

  return (
    <>
      <Button
        variant="outline"
        className={cn("h-12 w-full", className)}
        onClick={() => setOpen(true)}
      >
        <BookMarked className="mr-2 h-5 w-5" />
        Add to Collection
      </Button>

      <Dialog open={open} onOpenChange={(value) => { if (!writeLock.current) setOpen(value) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to collection</DialogTitle>
            <DialogDescription>Pick a collection, or create a new one.</DialogDescription>
          </DialogHeader>

          <div className="max-h-64 space-y-2 overflow-y-auto py-2">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : loadError ? (
              <div role="alert" className="space-y-3 py-4 text-sm"><p>{loadError}</p><Button variant="outline" onClick={load}>Retry</Button></div>
            ) : lists.length ? (
              lists.map((list) => {
                const isMember = memberOf.has(list.id)
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => toggleMembership(list)}
                    disabled={Boolean(busyId) || creating}
                    aria-pressed={isMember}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors",
                      isMember ? "border-accent/50 bg-accent/10" : "border-border/50 hover:border-accent/40",
                    )}
                  >
                    <span className="truncate font-medium text-foreground">{list.name}</span>
                    {busyId === list.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : isMember ? (
                      <Check className="h-4 w-4 text-accent" />
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                )
              })
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No collections yet.</p>
            )}
          </div>

          <form onSubmit={handleCreateAndAdd} className="flex gap-2 border-t border-border/50 pt-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New collection name"
              aria-label="New collection name"
              maxLength={80}
            />
            <Button type="submit" aria-label="Create collection and add title" disabled={creating || Boolean(busyId) || loading || Boolean(loadError) || !newName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
