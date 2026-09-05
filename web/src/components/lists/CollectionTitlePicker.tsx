"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import client from "@/lib/client"
import { fetchAniListMediaByIds, getMediaTitle } from "@/lib/anilist"

export function CollectionTitlePicker({ open, onOpenChange, userId, listId, existingIds, onAdded }: {
  open: boolean; onOpenChange: (open: boolean) => void; userId: string; listId: string;
  existingIds: number[]; onAdded: () => void;
}) {
  const [entries, setEntries] = useState<any[]>([])
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!open || !userId) return
    let active = true
    setSelected([])
    setQuery("")
    setLoading(true)
    setError("")
    const load = async () => {
      try {
        const { data, error: loadError } = await client.from("list_entries").select("media_id, media_type").eq("user_id", userId)
        if (loadError) throw loadError
        const media = await fetchAniListMediaByIds((data || []).map(item => Number(item.media_id)))
        if (active) setEntries((data || []).map(item => ({ ...item, media_id: Number(item.media_id), media: media.get(Number(item.media_id)) })))
      } catch {
        if (active) setError("We couldn’t load your library. Try again.")
      } finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [open, userId, retry])
  const existing = useMemo(() => new Set(existingIds), [existingIds])
  const visible = entries.filter(entry => getMediaTitle(entry.media).toLowerCase().includes(query.trim().toLowerCase()))
  const addSelected = async () => {
    if (saving || !selected.length) return
    setSaving(true)
    setError("")
    try {
      const rows = entries.filter(entry => selected.includes(entry.media_id) && !existing.has(entry.media_id)).map(entry => ({
        list_id: listId, media_id: entry.media_id, media_type: entry.media_type || entry.media?.type || "ANIME",
      }))
      if (rows.length) {
        const { error: insertError } = await client.from("custom_list_items").upsert(rows, { onConflict: "list_id,media_id", ignoreDuplicates: true })
        if (insertError) throw insertError
      }
      toast.success("Titles added to your collection.")
      onAdded()
      onOpenChange(false)
    } catch { setError("Your titles couldn’t be added. Your selection is still here—please try again.") }
    finally { setSaving(false) }
  }
  return <Dialog open={open} onOpenChange={value => { if (!saving) onOpenChange(value) }}>
    <DialogContent className="hikari-revamp">
      <DialogHeader><DialogTitle>Add from your library</DialogTitle><DialogDescription>Choose as many as you like. Adding to a collection doesn’t change your watch progress.</DialogDescription></DialogHeader>
      <Input aria-label="Find a title in your library" placeholder="Find a title…" value={query} onChange={event => setQuery(event.target.value)} />
      {error ? <p role="alert" className="text-sm text-destructive">{error} {!saving ? <button className="underline" onClick={() => setRetry(value => value + 1)}>Reload library</button> : null}</p> : null}
      <div className="rv-picker-list" aria-busy={loading}>
        {loading ? <p className="py-8 text-center text-sm text-muted-foreground" role="status">Loading your library…</p> : visible.length ? visible.map(entry =>
          <label key={entry.media_id} className="rv-picker-item">
            <input type="checkbox" checked={existing.has(entry.media_id) || selected.includes(entry.media_id)} disabled={saving || existing.has(entry.media_id)} onChange={event => setSelected(current => event.target.checked ? [...current, entry.media_id] : current.filter(id => id !== entry.media_id))} />
            <img src={entry.media?.coverImage?.large || "/placeholder.svg"} alt="" />
            <span className="flex-1">{entry.media ? getMediaTitle(entry.media) : `Title #${entry.media_id}`}</span>
            {existing.has(entry.media_id) ? <small className="text-muted-foreground">Added</small> : null}
          </label>
        ) : !error ? <p className="py-8 text-center text-sm text-muted-foreground">{query ? "No matching titles." : "Your tracking library is empty. Browse a title and add it to your list or directly to this collection."}</p> : null}
      </div>
      <DialogFooter><Button variant="ghost" asChild><Link href="/search">Browse more titles</Link></Button><Button disabled={saving || loading || !selected.length} onClick={addSelected}>{saving ? "Adding…" : `Add ${selected.length || ""} title${selected.length === 1 ? "" : "s"}`}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
