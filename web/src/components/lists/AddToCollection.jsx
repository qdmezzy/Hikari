"use client"

import { useCallback, useEffect, useState } from "react"
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

export function AddToCollection({ user, mediaId, mediaType = "ANIME", className }) {
  const [open, setOpen] = useState(false)
  const [lists, setLists] = useState([])
  const [memberOf, setMemberOf] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)

  const numericMediaId = Number(mediaId)

  const load = useCallback(async () => {
    if (!user || !Number.isFinite(numericMediaId)) return
    setLoading(true)
    const [{ data: listData }, { data: itemData }] = await Promise.all([
      client
        .from("custom_lists")
        .select("id, name, is_public")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      client.from("custom_list_items").select("list_id, media_id").eq("media_id", numericMediaId),
    ])
    setLists(listData || [])
    const owned = new Set((listData || []).map((l) => l.id))
    setMemberOf(new Set((itemData || []).filter((i) => owned.has(i.list_id)).map((i) => i.list_id)))
    setLoading(false)
  }, [user, numericMediaId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const toggleMembership = async (list) => {
    if (!user || busyId) return
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
      setBusyId(null)
    }
  }

  const handleCreateAndAdd = async (e) => {
    e.preventDefault()
    if (!user || creating) return
    const trimmed = newName.trim()
    if (!trimmed) return
    setCreating(true)
    try {
      const { data: list, error } = await client
        .from("custom_lists")
        .insert({ user_id: user.id, name: trimmed, is_public: false })
        .select("id, name, is_public")
        .single()
      if (error) throw error
      await client.from("custom_list_items").insert({
        list_id: list.id,
        media_id: numericMediaId,
        media_type: mediaType || "ANIME",
      })
      setLists((prev) => [list, ...prev])
      setMemberOf((prev) => new Set(prev).add(list.id))
      setNewName("")
      toast.success(`Added to ${list.name}`)
    } catch (err) {
      console.error("Failed to create collection:", err)
      toast.error("Couldn't create that collection.")
    } finally {
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

      <Dialog open={open} onOpenChange={setOpen}>
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
            ) : lists.length ? (
              lists.map((list) => {
                const isMember = memberOf.has(list.id)
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => toggleMembership(list)}
                    disabled={busyId === list.id}
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
              maxLength={80}
            />
            <Button type="submit" disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
