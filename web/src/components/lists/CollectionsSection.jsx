"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
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

export function CollectionsSection({ user }) {
  const [lists, setLists] = useState([])
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
    const { data, error } = await client
      .from("custom_lists")
      .select("id, name, description, is_public, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("Failed to load collections:", error)
      setLists([])
    } else {
      setLists(data || [])
    }
    setLoading(false)
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
    toast.success("Collection created")
  }

  const handleDelete = async (list) => {
    if (!list?.id || typeof window === "undefined") return
    if (!window.confirm(`Delete the collection "${list.name}"? This can't be undone.`)) return
    setDeletingId(list.id)
    const { error } = await client.from("custom_lists").delete().eq("id", list.id)
    setDeletingId(null)
    if (error) {
      toast.error("Couldn't delete that collection.")
      return
    }
    setLists((current) => current.filter((item) => item.id !== list.id))
    toast.success("Collection deleted")
  }

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Collections</h2>
          <p className="text-sm text-muted-foreground">Curate your own playlists of anime &amp; manga.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-full">
          <Plus className="h-4 w-4" />
          New collection
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card h-24 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : lists.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <div key={list.id} className="glass-card group relative flex flex-col gap-2 p-4 transition-all hover:border-accent/50">
              <Link href={`/lists/${list.id}`} className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <BookMarked className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground group-hover:text-accent">{list.name}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {list.description || "No description"}
                  </p>
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {list.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {list.is_public ? "Public" : "Private"}
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(list)}
                disabled={deletingId === list.id}
                className="absolute right-2 top-2 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                aria-label="Delete collection"
              >
                {deletingId === list.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="glass-card flex w-full items-center justify-center gap-2 border-dashed py-8 text-sm text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Create your first collection
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>New collection</DialogTitle>
              <DialogDescription>
                Build a custom playlist. Add titles to it from any anime or manga page.
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
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
