"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  LayoutDashboard,
  Users,
  MessagesSquare,
  Megaphone,
  Flag,
  Shield,
  Snowflake,
  ChevronLeft,
  Search,
  Plus,
  Pencil,
  Trash2,
  Pin,
  Loader2,
  ExternalLink,
  CheckCircle,
  EyeOff,
  AlertTriangle,
  ShieldCheck,
  UserCog,
  Ban,
} from "lucide-react"
import RequireAuth from "@/components/common/RequireAuth"
import useAuth from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  fetchAllUsers,
  setUserMod,
  fetchReports,
  resolveReport,
  fetchModStats,
  banUserAccount,
  unbanUserAccount,
} from "@/lib/admin-service"
import {
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  fetchForumThreads,
  createForumThread,
  updateForumThread,
  deleteForumThread,
} from "@/lib/community-content-service"

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "forms", label: "Forms", icon: MessagesSquare },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "reports", label: "Reports", icon: Flag },
]

function formatRelativeTime(value) {
  if (!value) return ""
  const ts = new Date(value).getTime()
  if (Number.isNaN(ts)) return ""
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

const initialOf = (name) => name?.slice(0, 1)?.toUpperCase() || "U"
const shortId = (v) => (v ? `${v.slice(0, 6)}…${v.slice(-4)}` : "")

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */
function StatCard({ icon: Icon, label, value, tone = "primary" }) {
  const tones = {
    primary: "from-primary/15 to-primary/5 text-primary",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-500",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-500",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-500",
  }
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-5 backdrop-blur-sm">
      <div className={cn("mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br", tones[tone])}>
        <Icon className="size-5" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function OverviewSection({ onNavigate }) {
  const [stats, setStats] = useState({ users: 0, pendingReports: 0, announcements: 0, forms: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchModStats()
      .then((s) => active && setStats(s))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={loading ? "—" : stats.users} tone="primary" />
        <StatCard icon={Flag} label="Pending reports" value={loading ? "—" : stats.pendingReports} tone="amber" />
        <StatCard icon={Megaphone} label="Announcements" value={loading ? "—" : stats.announcements} tone="emerald" />
        <StatCard icon={MessagesSquare} label="Forum threads" value={loading ? "—" : stats.forms} tone="violet" />
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/60 p-5">
        <h3 className="mb-4 font-semibold text-foreground">Quick actions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {NAV.filter((n) => n.id !== "overview").map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onNavigate(n.id)}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <n.icon className="size-5 text-primary" />
              <span className="text-sm font-medium text-foreground">Manage {n.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Users                                                              */
/* ------------------------------------------------------------------ */
function UsersSection({ currentUserId }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [workingId, setWorkingId] = useState("")
  const [rolesAvailable, setRolesAvailable] = useState(true)
  const [banTarget, setBanTarget] = useState(null)
  const [banReason, setBanReason] = useState("")
  const [banBusy, setBanBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await fetchAllUsers()
      setUsers(data)
      setRolesAvailable(data[0]?.rolesAvailable !== false)
    } catch (e) {
      setError(e?.message || "Could not load users.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) =>
      [u.displayName, u.handle, u.email, u.id].filter(Boolean).join(" ").toLowerCase().includes(q),
    )
  }, [users, search])

  const toggleMod = async (u) => {
    const makeMod = !u.isMod
    if (typeof window !== "undefined" && !window.confirm(`${makeMod ? "Grant" : "Remove"} moderator role for ${u.displayName}?`))
      return
    setWorkingId(u.id)
    try {
      await setUserMod(u.id, makeMod)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isMod: makeMod } : x)))
    } catch (e) {
      setError(e?.message || "Could not change role.")
    } finally {
      setWorkingId("")
    }
  }

  const handleBan = async () => {
    if (!banTarget) return
    setBanBusy(true)
    try {
      await banUserAccount(banTarget.id, { reason: banReason.trim() || undefined })
      setUsers((prev) => prev.map((x) => (x.id === banTarget.id ? { ...x, isBanned: true } : x)))
      setBanTarget(null)
      setBanReason("")
    } catch (e) {
      setError(e?.message || "Could not ban user.")
    } finally {
      setBanBusy(false)
    }
  }

  const handleUnban = async (u) => {
    if (typeof window !== "undefined" && !window.confirm(`Lift the suspension on ${u.displayName}?`)) return
    setWorkingId(u.id)
    try {
      await unbanUserAccount(u.id)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isBanned: false } : x)))
    } catch (e) {
      setError(e?.message || "Could not unban user.")
    } finally {
      setWorkingId("")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name, handle, email…"
            className="pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} users</span>
      </div>

      {!rolesAvailable && !loading ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-600 dark:text-amber-300">
          Role management is unavailable until the admin RPCs are installed (run <code>db/create-admin-rpcs.sql</code>).
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/60">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
            Loading users…
          </div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-destructive">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No users found.</div>
        ) : (
          filtered.map((u) => (
            <div
              key={u.id}
              className="flex flex-col gap-3 border-b border-border/30 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-10 ring-2 ring-border/30">
                  {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.displayName} /> : null}
                  <AvatarFallback className="text-xs">{initialOf(u.displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-foreground">{u.displayName}</p>
                    {u.isMod ? (
                      <Badge className="gap-1 bg-emerald-500/15 text-emerald-500">
                        <ShieldCheck className="size-3" /> Mod
                      </Badge>
                    ) : null}
                    {u.isBanned ? (
                      <Badge className="gap-1 bg-destructive/15 text-destructive">
                        <Ban className="size-3" /> Suspended
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.handle ? `@${u.handle}` : shortId(u.id)}
                    {u.email ? ` · ${u.email}` : ""}
                    {u.createdAt ? ` · joined ${formatRelativeTime(u.createdAt)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {u.handle ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/u/${encodeURIComponent(u.handle)}`}>
                      <ExternalLink className="mr-1.5 size-3.5" /> Profile
                    </Link>
                  </Button>
                ) : null}
                {rolesAvailable ? (
                  <Button
                    variant={u.isMod ? "outline" : "secondary"}
                    size="sm"
                    disabled={workingId === u.id || u.id === currentUserId}
                    onClick={() => toggleMod(u)}
                    title={u.id === currentUserId ? "You can't change your own role" : ""}
                  >
                    {workingId === u.id ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <UserCog className="mr-1.5 size-3.5" />
                    )}
                    {u.isMod ? "Remove mod" : "Make mod"}
                  </Button>
                ) : null}
                {rolesAvailable && u.id !== currentUserId ? (
                  u.isBanned ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={workingId === u.id}
                      onClick={() => handleUnban(u)}
                    >
                      {workingId === u.id ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-1.5 size-3.5" />
                      )}
                      Unban
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        setBanReason("")
                        setBanTarget(u)
                      }}
                    >
                      <Ban className="mr-1.5 size-3.5" />
                      Ban
                    </Button>
                  )
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!banTarget} onOpenChange={(open) => !open && setBanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {banTarget?.displayName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              They&apos;ll be signed out of the community and sent to the appeal page. You can lift this at any time.
            </p>
            <Textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Reason shown to the user (optional)"
              className="min-h-24"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanTarget(null)} disabled={banBusy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBan} disabled={banBusy}>
              {banBusy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Ban className="mr-1.5 size-3.5" />}
              Suspend account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Content editor (shared by Forms + Announcements)                   */
/* ------------------------------------------------------------------ */
function ContentEditorDialog({ open, onOpenChange, kind, initial, onSave }) {
  const isForm = kind === "form"
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [category, setCategory] = useState("general")
  const [isPinned, setIsPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setTitle(initial?.title || "")
    setBody(initial?.body || "")
    setCategory(initial?.category || "general")
    setIsPinned(Boolean(initial?.is_pinned))
    setError("")
  }, [open, initial])

  const save = async () => {
    if (!title.trim()) {
      setError("A title is required.")
      return
    }
    setSaving(true)
    setError("")
    try {
      await onSave(isForm ? { title, body, category, isPinned } : { title, body })
      onOpenChange(false)
    } catch (e) {
      setError(e?.message || "Could not save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit" : "New"} {isForm ? "forum thread" : "announcement"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          {isForm ? (
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category (e.g. anime, forum games)"
            />
          ) : null}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={isForm ? "Opening post…" : "Write the announcement…"}
            className="min-h-28"
          />
          {isForm ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="size-4 rounded border-border" />
              Pin to top
            </label>
          ) : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : initial ? "Save" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Forms (forum threads)                                              */
/* ------------------------------------------------------------------ */
function FormsSection({ user }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState({ open: false, initial: null })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchForumThreads(50))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const sortItems = (list) =>
    [...list].sort(
      (a, b) =>
        Number(b.is_pinned) - Number(a.is_pinned) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )

  const handleSave = async (values) => {
    if (editor.initial) {
      const updated = await updateForumThread(editor.initial.id, values)
      setItems((prev) => sortItems(prev.map((t) => (t.id === updated.id ? updated : t))))
    } else {
      const created = await createForumThread({ ...values, user })
      setItems((prev) => sortItems([created, ...prev]))
    }
  }

  const handleDelete = async (item) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this thread?")) return
    const prev = items
    setItems((p) => p.filter((t) => t.id !== item.id))
    try {
      await deleteForumThread(item.id)
    } catch {
      setItems(prev)
    }
  }

  return (
    <ManagedList
      title="Forum threads"
      description="Create and manage forum threads. Only moderators can post here."
      newLabel="New thread"
      loading={loading}
      items={items}
      onNew={() => setEditor({ open: true, initial: null })}
      onEdit={(i) => setEditor({ open: true, initial: i })}
      onDelete={handleDelete}
      renderMeta={(t) => (
        <>
          {t.is_pinned ? (
            <Badge className="gap-1 bg-primary/15 text-primary">
              <Pin className="size-3" /> Pinned
            </Badge>
          ) : null}
          {t.category ? <Badge variant="outline">{t.category}</Badge> : null}
          <span className="text-xs text-muted-foreground">{formatRelativeTime(t.created_at)}</span>
        </>
      )}
      editor={
        <ContentEditorDialog
          open={editor.open}
          onOpenChange={(open) => setEditor((p) => ({ ...p, open }))}
          kind="form"
          initial={editor.initial}
          onSave={handleSave}
        />
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Announcements                                                      */
/* ------------------------------------------------------------------ */
function AnnouncementsSection({ user }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState({ open: false, initial: null })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchAnnouncements(50))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const handleSave = async (values) => {
    if (editor.initial) {
      const updated = await updateAnnouncement(editor.initial.id, values)
      setItems((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    } else {
      const created = await createAnnouncement({ ...values, user })
      setItems((prev) => [created, ...prev])
    }
  }

  const handleDelete = async (item) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this announcement?")) return
    const prev = items
    setItems((p) => p.filter((a) => a.id !== item.id))
    try {
      await deleteAnnouncement(item.id)
    } catch {
      setItems(prev)
    }
  }

  return (
    <ManagedList
      title="Announcements"
      description="Post site-wide announcements. Visible to the community; editable only by mods."
      newLabel="New announcement"
      loading={loading}
      items={items}
      onNew={() => setEditor({ open: true, initial: null })}
      onEdit={(i) => setEditor({ open: true, initial: i })}
      onDelete={handleDelete}
      renderMeta={(a) => (
        <>
          {a.is_published === false ? <Badge variant="outline">Draft</Badge> : null}
          <span className="text-xs text-muted-foreground">{formatRelativeTime(a.created_at)}</span>
        </>
      )}
      editor={
        <ContentEditorDialog
          open={editor.open}
          onOpenChange={(open) => setEditor((p) => ({ ...p, open }))}
          kind="announcement"
          initial={editor.initial}
          onSave={handleSave}
        />
      }
    />
  )
}

/* Shared list shell for Forms + Announcements */
function ManagedList({ title, description, newLabel, loading, items, onNew, onEdit, onDelete, renderMeta, editor }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={onNew} className="gap-1.5 self-start">
          <Plus className="size-4" />
          {newLabel}
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/60">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nothing here yet. Create the first one.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 border-b border-border/30 px-4 py-3 last:border-0">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{item.title}</p>
                {item.body ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.body}</p> : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">{renderMeta(item)}</div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => onEdit(item)} aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(item)}
                  aria-label="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
      {editor}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Reports / moderation                                               */
/* ------------------------------------------------------------------ */
const STATUS_TABS = ["pending", "escalated", "resolved", "dismissed"]
const statusStyles = {
  pending: "bg-amber-500/15 text-amber-500",
  escalated: "bg-red-500/15 text-red-500",
  resolved: "bg-emerald-500/15 text-emerald-500",
  dismissed: "bg-secondary text-muted-foreground",
}

function ReportsSection({ user }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("pending")
  const [workingId, setWorkingId] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setReports(await fetchReports())
    } catch (e) {
      setError(e?.message || "Could not load reports.")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(
    () =>
      reports.reduce(
        (acc, r) => {
          const s = r.status || "pending"
          acc[s] = (acc[s] || 0) + 1
          return acc
        },
        { pending: 0, escalated: 0, resolved: 0, dismissed: 0 },
      ),
    [reports],
  )

  const filtered = useMemo(
    () => reports.filter((r) => (r.status || "pending") === statusFilter),
    [reports, statusFilter],
  )

  const act = async (report, action) => {
    setWorkingId(report.id)
    try {
      await resolveReport({ report, action, moderatorId: user.id })
      await load()
    } catch (e) {
      setError(e?.message || "Could not update report.")
    } finally {
      setWorkingId("")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              statusFilter === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s} <span className="ml-1 opacity-70">{counts[s] || 0}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-border/50 bg-card/60 p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
            Loading reports…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-border/50 bg-card/60 p-10 text-center text-sm text-destructive">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card/60 p-10 text-center text-sm text-muted-foreground">
            No {statusFilter} reports.
          </div>
        ) : (
          filtered.map((report) => {
            const post = report.social_posts || {}
            const targetType = report.target_type || (report.post_id ? "social_post" : "content")
            const targetUrl =
              report.target_url || (targetType === "social_post" && report.post_id ? `/community/${report.post_id}` : "")
            const author =
              report.target_user_handle ||
              report.target_user_display_name ||
              post.user_handle ||
              post.user_display_name ||
              "Unknown"
            const canRemove = ["social_post", "review", "clip_comment", "clip"].includes(targetType)
            return (
              <div key={report.id} className="rounded-2xl border border-border/50 bg-card/60 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={statusStyles[report.status || "pending"]}>{report.status || "pending"}</Badge>
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {String(targetType).replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(report.created_at)}</span>
                    </div>
                    <p className="line-clamp-2 text-sm text-foreground">
                      {post.content || report.target_label || "Content unavailable."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reason: <span className="text-foreground/80">{report.reason || "—"}</span> · Author: {author} · Reporter:{" "}
                      {shortId(report.reporter_id)}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap gap-2">
                    {targetUrl ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={targetUrl}>
                          <ExternalLink className="mr-1.5 size-3.5" /> Open
                        </Link>
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" disabled={workingId === report.id} onClick={() => act(report, "dismiss")}>
                      <CheckCircle className="mr-1.5 size-3.5" /> Dismiss
                    </Button>
                    {targetType === "social_post" && report.post_id ? (
                      <Button variant="outline" size="sm" disabled={workingId === report.id} onClick={() => act(report, "spoiler")}>
                        <EyeOff className="mr-1.5 size-3.5" /> Spoiler
                      </Button>
                    ) : null}
                    {canRemove ? (
                      <Button variant="destructive" size="sm" disabled={workingId === report.id} onClick={() => act(report, "remove")}>
                        <Trash2 className="mr-1.5 size-3.5" /> Remove
                      </Button>
                    ) : null}
                    <Button variant="secondary" size="sm" disabled={workingId === report.id} onClick={() => act(report, "escalate")}>
                      <AlertTriangle className="mr-1.5 size-3.5" /> Escalate
                    </Button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shell                                                              */
/* ------------------------------------------------------------------ */
function Dashboard({ user }) {
  const [active, setActive] = useState("overview")
  const ActiveIcon = NAV.find((n) => n.id === active)?.icon || LayoutDashboard
  const displayName =
    user?.user_metadata?.display_name || user?.user_metadata?.username || user?.email || "Moderator"
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || ""
  const brandInitial = displayName.slice(0, 1).toUpperCase()

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-60 flex-shrink-0 border-r border-border/50 lg:block">
          <div className="sticky top-0 flex h-screen flex-col p-4">
            <div className="mb-6 flex items-center gap-2.5 px-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Snowflake className="size-5" />
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-none text-foreground">Hikari</span>
                <span className="text-xs text-muted-foreground">Moderator</span>
              </div>
            </div>
            <nav className="space-y-1">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setActive(n.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active === n.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <n.icon className="size-4" />
                  {n.label}
                </button>
              ))}
            </nav>
            <div className="mt-auto space-y-2">
              <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 p-3">
                <Avatar className="size-9">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                  <AvatarFallback className="bg-primary/15 text-primary">{brandInitial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">Moderator</p>
                </div>
              </div>
              <Link
                href="/"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
                Back to Hikari
              </Link>
            </div>
          </div>
        </aside>

        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 border-b border-border/50 bg-background/90 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Snowflake className="size-4" />
              </span>
              <span className="font-semibold text-foreground">Hikari Moderator</span>
            </div>
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
              Back to app
            </Link>
          </div>
          <div className="flex gap-1 overflow-x-auto px-2 pb-2">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setActive(n.id)}
                className={cn(
                  "flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  active === n.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <n.icon className="size-3.5" />
                {n.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <header className="mb-6 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ActiveIcon className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold capitalize text-foreground">{active}</h1>
              <p className="text-sm text-muted-foreground">Moderator dashboard</p>
            </div>
          </header>

          {active === "overview" && <OverviewSection onNavigate={setActive} />}
          {active === "users" && <UsersSection currentUserId={user.id} />}
          {active === "forms" && <FormsSection user={user} />}
          {active === "announcements" && <AnnouncementsSection user={user} />}
          {active === "reports" && <ReportsSection user={user} />}
        </main>
      </div>
    </div>
  )
}

export default function ModDashboardPage() {
  const { user, loading } = useAuth()
  const isMod = user?.app_metadata?.is_mod === true || user?.app_metadata?.isMod === true

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading…
      </div>
    )
  }

  if (!isMod) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <Shield className="size-7" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Moderators only</h1>
          <p className="mt-1 text-sm text-muted-foreground">You don&apos;t have permission to view this page.</p>
        </div>
        <Button asChild>
          <Link href="/">Back to Hikari</Link>
        </Button>
      </div>
    )
  }

  return (
    <RequireAuth>
      <Dashboard user={user} />
    </RequireAuth>
  )
}
