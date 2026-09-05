"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, BookMarked, Globe, Lock, Plus, Pencil, Share2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Navigation } from "@/components/layout/Navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { CollectionTitlePicker } from "@/components/lists/CollectionTitlePicker"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { fetchAniListMediaByIds, getMediaTitle, getMediaHref } from "@/lib/anilist"

export default function CustomListPage() {
  const params = useParams()
  const listId = typeof params?.id === "string" ? params.id : ""
  const { user, loading: authLoading } = useAuth()
  const [list, setList] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [metadataError, setMetadataError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState({ name: "", description: "", is_public: false })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState("")
  const [removeTarget, setRemoveTarget] = useState<any>(null)
  const [removing, setRemoving] = useState(false)
  const [sort, setSort] = useState("newest")
  const [query, setQuery] = useState("")
  const owner = Boolean(user?.id && list?.user_id === user.id)

  useEffect(() => {
    if (!listId || authLoading) return
    let active = true
    setLoading(true)
    setError("")
    setMetadataError(false)
    const load = async () => {
      try {
        const { data: collection, error: listError } = await client.from("custom_lists").select("id, user_id, name, description, is_public, created_at").eq("id", listId).single()
        if (listError || !collection) throw new Error("This collection is private, unavailable, or no longer exists.")
        const { data, error: itemsError } = await client.from("custom_list_items").select("id, list_id, media_id, media_type, added_at").eq("list_id", listId).order("added_at", { ascending: false })
        if (itemsError) throw new Error("We couldn’t load the titles in this collection.")
        let media = new Map()
        try { media = await fetchAniListMediaByIds((data || []).map(item => Number(item.media_id))) }
        catch { if (active) setMetadataError(true) }
        if (!active) return
        setList(collection)
        setItems((data || []).map(item => ({ ...item, media: media.get(Number(item.media_id)) })))
      } catch (err) { if (active) setError(err instanceof Error ? err.message : "This collection couldn’t be loaded.") }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [listId, authLoading, user?.id, revision])

  useEffect(() => {
    if (owner && new URLSearchParams(window.location.search).get("add") === "1") {
      setAddOpen(true)
      const url = new URL(window.location.href)
      url.searchParams.delete("add")
      window.history.replaceState(null, "", url)
    }
  }, [owner])

  const editCollection = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!owner || saving || !draft.name.trim()) return
    setSaving(true)
    setEditError("")
    try {
      const values = { name: draft.name.trim(), description: draft.description.trim() || null, is_public: draft.is_public, updated_at: new Date().toISOString() }
      const { data, error: updateError } = await client.from("custom_lists").update(values).eq("id", listId).eq("user_id", user.id).select("id").single()
      if (updateError || !data) throw updateError || new Error("No collection updated")
      setList(current => ({ ...current, ...values }))
      setEditOpen(false)
      toast.success("Collection updated.")
    } catch { setEditError("We couldn’t save your changes. Please try again.") }
    finally { setSaving(false) }
  }

  const removeTitle = async () => {
    if (!owner || !removeTarget || removing) return
    setRemoving(true)
    try {
      const { error: removeError } = await client.from("custom_list_items").delete().eq("id", removeTarget.id).eq("list_id", listId)
      if (removeError) throw removeError
      setItems(current => current.filter(item => item.id !== removeTarget.id))
      setRemoveTarget(null)
      toast.success("Removed from this collection. Your tracking progress is unchanged.")
    } catch { toast.error("Couldn’t remove that title. Try again.") }
    finally { setRemoving(false) }
  }
  const visibleItems = items.filter(item => getMediaTitle(item.media).toLowerCase().includes(query.trim().toLowerCase())).sort((a,b) => sort === "title" ? getMediaTitle(a.media).localeCompare(getMediaTitle(b.media)) : new Date(b.added_at).getTime() - new Date(a.added_at).getTime())
  const share = async () => {
    if (!list?.is_public) return
    try { await navigator.clipboard.writeText(window.location.origin + "/lists/" + listId); toast.success("Public collection link copied.") }
    catch { toast.error("Couldn’t copy the link. You can copy this page’s address instead.") }
  }

  return <div className="hikari-revamp min-h-screen">
    <Navigation />
    <main className="rv-container rv-main" style={{ maxWidth: 1040 }}>
      <Link href="/lists?view=collections" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={15} />Collections</Link>
      {loading ? <div className="rv-empty" role="status">Opening your collection…</div> : error ? <div className="rv-empty"><h1 className="mb-3 text-2xl">Collection unavailable</h1><p role="alert">{error}</p><div className="flex justify-center gap-2"><Button variant="outline" onClick={() => setRevision(value => value + 1)}>Try again</Button>{!user ? <Button asChild><Link href={`/login?next=${encodeURIComponent("/lists/" + listId)}`}>Sign in</Link></Button> : null}</div></div> : <>
        <header className="rv-page-heading">
          <div><p className="rv-kicker">{list.is_public ? "A public collection" : "Private collection"}</p><h1>{list.name}</h1>{list.description ? <p>{list.description}</p> : null}<div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">{list.is_public ? <Globe size={13} /> : <Lock size={13} />}{list.is_public ? "Public" : "Private"}<span>·</span>{items.length} {items.length === 1 ? "title" : "titles"}</div></div>
          <div className="flex flex-wrap gap-2">
            {list.is_public ? <Button variant="outline" size="icon" aria-label="Copy public collection link" onClick={share}><Share2 size={16} /></Button> : null}
            {owner ? <><Button variant="outline" onClick={() => { setDraft({ name: list.name, description: list.description || "", is_public: list.is_public }); setEditError(""); setEditOpen(true) }}><Pencil size={15} />Edit</Button><Button onClick={() => setAddOpen(true)}><Plus size={16} />Add titles</Button></> : null}
          </div>
        </header>
        {metadataError ? <p role="status" className="mb-4 text-sm text-muted-foreground">Cover art and title details are temporarily unavailable. Your saved collection is intact.</p> : null}
        {items.length ? <>
          <div className="rv-library-search border-y border-border py-4">
            <Input aria-label="Search this collection" placeholder="Find a title in this collection…" value={query} onChange={event => setQuery(event.target.value)} />
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><span className="hidden sm:inline">Sort</span><select aria-label="Sort collection" value={sort} onChange={event => setSort(event.target.value)} className="rounded-md border border-border bg-card px-3 py-2 text-foreground"><option value="newest">Recently added</option><option value="title">Title A–Z</option></select></label>
          </div>
          {visibleItems.map((item, index) => <article className="rv-collection-row" key={item.id}>
            <span className="hidden w-6 text-xs text-muted-foreground sm:block">{String(index + 1).padStart(2, "0")}</span>
            <img src={item.media?.coverImage?.large || "/placeholder.svg"} alt="" loading="lazy" />
            <div className="min-w-0 flex-1"><h3><Link href={getMediaHref(item.media_id, getMediaTitle(item.media))}>{item.media ? getMediaTitle(item.media) : `Title #${item.media_id}`}</Link></h3><p>{item.media_type === "MANGA" ? "Manga" : "Anime"}{item.media?.averageScore ? ` · ${item.media.averageScore / 10} average score` : ""}</p></div>
            {owner ? <Button variant="ghost" size="icon" aria-label={`Remove ${getMediaTitle(item.media)} from this collection`} onClick={() => setRemoveTarget(item)}><Trash2 size={15} /></Button> : null}
          </article>)}
          {!visibleItems.length ? <p className="py-12 text-center text-muted-foreground">No titles match “{query}”.</p> : null}
        </> : <div className="rv-empty"><BookMarked className="mx-auto mb-5 text-muted-foreground" size={36} strokeWidth={1.2} /><h2>No titles yet</h2><p>{owner ? "Choose titles from your library. They’ll stay in your tracking list, too." : "The curator hasn’t added any titles yet."}</p>{owner ? <Button onClick={() => setAddOpen(true)}><Plus size={16} />Choose titles</Button> : null}</div>}
      </>}
    </main>
    {owner ? <>
      <CollectionTitlePicker open={addOpen} onOpenChange={setAddOpen} userId={user.id} listId={listId} existingIds={items.map(item => Number(item.media_id))} onAdded={() => setRevision(value => value + 1)} />
      <Dialog open={editOpen} onOpenChange={value => { if (!saving) setEditOpen(value) }}>
        <DialogContent className="hikari-revamp"><form onSubmit={editCollection}><DialogHeader><DialogTitle>Edit collection</DialogTitle><DialogDescription>Update the name, description, and visibility.</DialogDescription></DialogHeader><div className="space-y-5 py-6">
          <div className="space-y-2"><Label htmlFor="edit-name">Name</Label><Input id="edit-name" required maxLength={80} value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /></div>
          <div className="space-y-2"><Label htmlFor="edit-description">Description</Label><Textarea id="edit-description" maxLength={300} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} /></div>
          <div className="flex items-center justify-between gap-6"><div><Label htmlFor="edit-public">Public collection</Label><p className="mt-1 text-xs text-muted-foreground">Anyone with the link can view it.</p></div><Switch id="edit-public" checked={draft.is_public} onCheckedChange={value => setDraft(current => ({ ...current, is_public: value }))} /></div>
          {editError ? <p role="alert" className="text-sm text-destructive">{editError}</p> : null}
        </div><DialogFooter><Button variant="outline" type="button" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving || !draft.name.trim()}>{saving ? "Saving…" : "Save collection"}</Button></DialogFooter></form></DialogContent>
      </Dialog>
      <Dialog open={Boolean(removeTarget)} onOpenChange={value => { if (!value && !removing) setRemoveTarget(null) }}>
        <DialogContent className="hikari-revamp" role="alertdialog"><DialogHeader><DialogTitle>Remove this title?</DialogTitle><DialogDescription>{getMediaTitle(removeTarget?.media)} will leave this collection. It will stay in your tracking list.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={removing} onClick={() => setRemoveTarget(null)}>Keep title</Button><Button variant="destructive" disabled={removing} onClick={removeTitle}>{removing ? "Removing…" : "Remove from collection"}</Button></DialogFooter></DialogContent>
      </Dialog>
    </> : null}
  </div>
}
