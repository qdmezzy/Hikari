"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, BookMarked, Globe, Lock, Plus, Pencil, Share2, Trash2 } from "lucide-react"
import { collectionExport, downloadJson } from "@/lib/export-library.mjs"
import { readAllRows } from "@/lib/read-all-rows.mjs"
import { toast } from "sonner"
import { Navigation } from "@/components/layout/Navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SiteSelect } from "@/components/ui/site-select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { CollectionTitlePicker } from "@/components/lists/CollectionTitlePicker"
import { CollectionPublishing } from "@/components/lists/CollectionPublishing"
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
  const [sort, setSort] = useState("shelf")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [toolBusy, setToolBusy] = useState(false)
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
        const { data: collection, error: listError } = await client.from("custom_lists").select("*").eq("id", listId).single()
        if (listError || !collection) throw new Error("This collection is private, unavailable, or no longer exists.")
        const { data, error: itemsError } = await readAllRows(() => client.from("custom_list_items").select("*").eq("list_id", listId), { isActive: () => active })
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
      const ids = removeTarget.batch ? removeTarget.ids : [removeTarget.id]
      const { data: removed, error: removeError } = await client.from("custom_list_items").delete().in("id", ids).eq("list_id", listId).select("id")
      if (removeError) throw removeError
      if (removed?.length !== ids.length) {
        setSelectedIds([])
        setRemoveTarget(null)
        setRevision(current => current + 1)
        toast.message("Some titles had already changed. Reloading the collection to show its current contents.")
        return
      }
      setItems(current => current.filter(item => !ids.includes(item.id)))
      setSelectedIds([])
      setRemoveTarget(null)
      toast.success("Removed from this collection. Your tracking progress is unchanged.")
    } catch { toast.error("Couldn’t remove that title. Try again.") }
    finally { setRemoving(false) }
  }
  const shelfItems = [...items].sort((a,b)=>(a.position ?? Number.MAX_SAFE_INTEGER)-(b.position ?? Number.MAX_SAFE_INTEGER) || new Date(b.added_at).getTime()-new Date(a.added_at).getTime() || String(a.id).localeCompare(String(b.id)))
  const duplicate = async () => {
    if (!owner || toolBusy) return
    setToolBusy(true)
    try {
      const {data,error:copyError}=await client.rpc("duplicate_own_collection",{source_id:listId})
      if(copyError) throw copyError
      toast.success("Private copy created.")
      window.location.assign("/lists/"+data)
    } catch { toast.error("Couldn’t duplicate. The collection-tools migration must be installed first. Your original is unchanged.") }
    finally { setToolBusy(false) }
  }
  const moveTitle = async (id:string,direction:number) => {
    if(!owner || toolBusy) return
    const before=shelfItems.map(item=>item.id)
    const index=before.indexOf(id), destination=index+direction
    if(destination<0 || destination>=before.length) return
    const after=[...before];[after[index],after[destination]]=[after[destination],after[index]]
    setToolBusy(true)
    try{
      const {error:orderError}=await client.rpc("reorder_own_collection",{collection_id:listId,ordered_ids:after,expected_ids:before})
      if(orderError) throw orderError
      setItems(current=>current.map(item=>({...item,position:after.indexOf(item.id)+1})))
    }catch{toast.error("Order wasn’t saved. Refresh and retry; collection tools require the database migration.")}
    finally{setToolBusy(false)}
  }
  const visibleItems = shelfItems.filter(item => getMediaTitle(item.media).toLowerCase().includes(query.trim().toLowerCase())).sort((a,b) => sort === "title" ? getMediaTitle(a.media).localeCompare(getMediaTitle(b.media)) : sort === "newest" ? new Date(b.added_at).getTime() - new Date(a.added_at).getTime() : 0)
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
        <header className="rv-page-heading hk-collection-heading">
          <div><p className="rv-kicker">{list.is_public ? "A public collection" : "Private collection"}</p><h1>{list.name}</h1>{list.description ? <p>{list.description}</p> : null}<div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">{list.is_public ? <Globe size={13} /> : <Lock size={13} />}{list.is_public ? "Public" : "Private"}<span>·</span>{items.length} {items.length === 1 ? "title" : "titles"}</div></div>
          <div className="flex flex-wrap gap-2">
            {list.is_public ? <Button variant="outline" size="icon" aria-label="Copy public collection link" onClick={share}><Share2 size={16} /></Button> : null}
            {owner ? <><Button variant="outline" onClick={() => { setDraft({ name: list.name, description: list.description || "", is_public: list.is_public }); setEditError(""); setEditOpen(true) }}><Pencil size={15} />Edit</Button><Button onClick={() => setAddOpen(true)}><Plus size={16} />Add titles</Button></> : null}
          </div>
        </header>
        <div className="hk-collection-panorama" aria-label="Collection cover">{[...shelfItems].sort((a,b)=>Number(Number(b.media_id)===list.cover_media_id)-Number(Number(a.media_id)===list.cover_media_id)).slice(0,5).map(item=><img key={item.id} src={item.media?.coverImage?.large || "/placeholder.svg"} alt="" />)}<span lang="ja">私の選集</span></div>
        {metadataError ? <p role="status" className="mb-4 text-sm text-muted-foreground">Cover art and title details are temporarily unavailable. Your saved collection is intact.</p> : null}
        {owner ? <div className="hk-collection-tools"><Button variant="outline" disabled={toolBusy} onClick={duplicate}>Duplicate as private</Button><Button variant="outline" onClick={()=>downloadJson("hikari-collection.json",collectionExport(list,shelfItems))}>Export JSON</Button><span>{list.is_public?"Anyone with the link can view this shelf.":"Only you can see this shelf."}</span></div>:null}
        {items.length ? <>
          <div className="rv-library-search border-y border-border py-4">
            <Input aria-label="Search this collection" placeholder="Find a title in this collection…" value={query} onChange={event => setQuery(event.target.value)} />
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><span className="hidden sm:inline">Sort</span><SiteSelect ariaLabel="Sort collection" value={sort} onValueChange={setSort} options={[{value:"shelf",label:"Shelf order"},{value:"newest",label:"Recently added"},{value:"title",label:"Title A–Z"}]} /></div>
          </div>
          {owner ? <div className="hk-collection-tools"><Button variant="outline" onClick={()=>setSelectedIds(selectedIds.length ? [] : visibleItems.map(item=>item.id))}>{selectedIds.length ? "Clear selection" : "Select visible titles"}</Button><Button variant="outline" disabled={!selectedIds.length} onClick={()=>setRemoveTarget({batch:true,ids:[...selectedIds],media:{title:{english:`${selectedIds.length} selected titles`}}})}>Remove selected ({selectedIds.length})</Button></div>:null}
          {visibleItems.map((item, index) => <article className="rv-collection-row" key={item.id}>
            {owner ? <input type="checkbox" aria-label={`Select ${getMediaTitle(item.media)}`} checked={selectedIds.includes(item.id)} onChange={()=>setSelectedIds(current=>current.includes(item.id)?current.filter(id=>id!==item.id):[...current,item.id])}/>:null}
            <span className="hidden w-6 text-xs text-muted-foreground sm:block">{String(index + 1).padStart(2, "0")}</span>
            <img src={item.media?.coverImage?.large || "/placeholder.svg"} alt="" loading="lazy" />
            <div className="min-w-0 flex-1"><h3><Link href={getMediaHref(item.media_id, getMediaTitle(item.media))}>{item.media ? getMediaTitle(item.media) : `Title #${item.media_id}`}</Link></h3><p>{item.media_type === "MANGA" ? "Manga" : "Anime"}{item.media?.averageScore ? ` · ${item.media.averageScore / 10} average score` : ""}</p></div>
            {owner && sort==="shelf" && !query ? <div className="hk-reorder"><button aria-label={`Move ${getMediaTitle(item.media)} earlier`} disabled={toolBusy || index===0} onClick={()=>moveTitle(item.id,-1)}>↑</button><button aria-label={`Move ${getMediaTitle(item.media)} later`} disabled={toolBusy || index===visibleItems.length-1} onClick={()=>moveTitle(item.id,1)}>↓</button></div>:null}
            {owner ? <Button variant="ghost" size="icon" aria-label={`Remove ${getMediaTitle(item.media)} from this collection`} onClick={() => setRemoveTarget(item)}><Trash2 size={15} /></Button> : null}
          </article>)}
          {!visibleItems.length ? <p className="py-12 text-center text-muted-foreground">No titles match “{query}”.</p> : null}
        </> : <div className="rv-empty"><BookMarked className="mx-auto mb-5 text-muted-foreground" size={36} strokeWidth={1.2} /><h2>No titles yet</h2><p>{owner ? "Choose titles from your library. They’ll stay in your tracking list, too." : "The curator hasn’t added any titles yet."}</p>{owner ? <Button onClick={() => setAddOpen(true)}><Plus size={16} />Choose titles</Button> : null}</div>}
        <CollectionPublishing collection={list} user={user} owner={owner} items={shelfItems} onCover={id=>setList(current=>({...current,cover_media_id:id}))} />
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
