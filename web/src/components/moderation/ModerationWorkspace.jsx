"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowUpRight, Flag, Users, Inbox, Megaphone, MessagesSquare, History, BarChart3, Settings, Shield, RefreshCw, Search } from "lucide-react"
import useAuth from "@/hooks/useAuth"
import { DecisionNotes } from "./DecisionNotes"
import RequireAuth from "@/components/common/RequireAuth"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { fetchReports, resolveReport, fetchFeedback, setFeedbackResolved, fetchAllUsers, setUserMod, banUserAccount, unbanUserAccount, fetchBanAppeals, reviewBanAppeal } from "@/lib/admin-service"
import { fetchAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, fetchForumThreads, createForumThread, updateForumThread, deleteForumThread } from "@/lib/community-content-service"

const sections = [
  { id: "reports", label: "Report queue", jp: "通報", icon: Flag, description: "Review the context. Choose the right response." },
  { id: "appeals", label: "Appeals", jp: "再審査", icon: Shield, description: "Review account appeals and escalated reports." },
  { id: "feedback", label: "Feedback", jp: "ご意見", icon: Inbox, description: "Bugs, ideas, and messages from the community." },
  { id: "users", label: "People", jp: "メンバー", icon: Users, description: "Find a member and manage their account access." },
  { id: "announcements", label: "Announcements", jp: "お知らせ", icon: Megaphone, description: "Write, preview, and publish community updates." },
  { id: "threads", label: "Forum threads", jp: "話題", icon: MessagesSquare, description: "Keep community discussions organized." },
  { id: "history", label: "Decision log", jp: "記録", icon: History, description: "Past report decisions, including escalations." },
  { id: "stats", label: "Insights", jp: "動向", icon: BarChart3, description: "A transparent snapshot of the latest 300 reports—not lifetime totals." },
  { id: "settings", label: "Workspace", jp: "設定", icon: Settings, description: "Local preferences for this browser. Not community policy." },
]
const hrefFor = (id) => ["appeals", "history", "stats", "settings"].includes(id) ? `/mod/${id}` : `/mod?view=${id}`
const stamp = (value) => value ? new Date(value).toLocaleString() : "Not recorded"
const stateOf = (row) => row.kind === "feedback" ? row.resolved ? "resolved" : "pending" : row.kind === "users" ? !row.rolesAvailable ? "role unavailable" : row.isBanned ? "banned" : row.isMod ? "moderator" : "member" : row.kind === "announcements" ? row.is_published ? "published" : "draft" : row.kind === "threads" ? row.is_pinned ? "pinned" : "thread" : row.status || "pending"
const titleOf = (row) => row.displayName || row.title || row.target_label || row.target_user_display_name || row.social_posts?.user_display_name || (row.kind === "appeal" ? "Account appeal" : row.kind === "feedback" ? `${row.category || "General"} feedback` : "Reported content")
const bodyOf = (row) => row.message || row.body || row.social_posts?.content || row.reason || "No additional text provided."
const safeLink = (url) => typeof url === "string" && /^\/(?!\/)/.test(url) && !url.includes("\\") ? url : null

export default function ModerationWorkspace({ initialSection = "reports" }) {
  const { user, loading } = useAuth()
  const allowed = user?.app_metadata?.is_mod === true || user?.app_metadata?.isMod === true
  if (loading) return <div className="mod-access" role="status">Checking moderator access…</div>
  if (!user) return <RequireAuth><span /></RequireAuth>
  if (!allowed) return <div className="mod-access"><span lang="ja">管理室</span><h1>Moderators only.</h1><p>This workspace requires a moderator account.</p><Link href="/">Return to Hikari</Link></div>
  return <RequireAuth><Workspace user={user} initialSection={initialSection} /></RequireAuth>
}

function Workspace({ user, initialSection }) {
  const [section, setSection] = useState(initialSection)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const [note, setNote] = useState("")
  const [editor, setEditor] = useState(null)
  const [compact, setCompact] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [preferencesReady, setPreferencesReady] = useState(false)
  const [revision, setRevision] = useState(0)
  const current = sections.find((item) => item.id === section) || sections[0]

  useEffect(() => {
    if (initialSection === "reports") {
      const view = new URLSearchParams(window.location.search).get("view")
      if (sections.some((item) => item.id === view)) setSection(view)
    }
    try {
      const prefs = JSON.parse(localStorage.getItem("hikari-mod-workspace-v1") || "{}")
      setCompact(prefs.compact === true)
      setAutoRefresh(prefs.autoRefresh === true)
    } catch { /* Invalid or unavailable local preferences use safe defaults. */ }
    setPreferencesReady(true)
  }, [initialSection])

  useEffect(() => {
    if (!preferencesReady) return
    try { localStorage.setItem("hikari-mod-workspace-v1", JSON.stringify({ compact, autoRefresh })) }
    catch { setNotice("Browser preferences could not be saved. They still apply for this visit.") }
  }, [compact, autoRefresh, preferencesReady])

  useEffect(() => {
    if (!autoRefresh || busy || editor || confirmation) return
    const timer = setInterval(() => { if (!document.hidden) setRevision((value) => value + 1) }, 60000)
    return () => clearInterval(timer)
  }, [autoRefresh, busy, editor, confirmation])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    const tagged = (items, kind) => items.map((row) => ({ ...row, kind, key: `${kind}:${row.id}` }))
    async function load() {
      if (section === "settings") return []
      if (section === "users") return tagged(await fetchAllUsers(), "users")
      if (section === "feedback") return tagged(await fetchFeedback(), "feedback")
      if (section === "announcements") return tagged(await fetchAnnouncements(200), "announcements")
      if (section === "threads") return tagged(await fetchForumThreads(200), "threads")
      if (section === "appeals") {
        const [appeals, reports] = await Promise.all([fetchBanAppeals(), fetchReports()])
        return [...tagged(appeals, "appeal"), ...tagged(reports.filter((row) => row.status === "escalated"), "report")]
      }
      const reports = await fetchReports()
      return tagged(section === "reports" ? reports.filter((row) => !row.status || row.status === "pending") : section === "history" ? reports.filter((row) => row.status && row.status !== "pending") : reports, "report")
    }
    load().then((data) => { if (active) setRows(data.sort((a, b) => new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime())) }).catch((err) => { if (active) { setRows([]); setError(err.message || "Could not load this view.") } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [section, revision])

  const filtered = useMemo(() => rows.filter((row) => (filter === "all" || stateOf(row) === filter) && `${titleOf(row)} ${bodyOf(row)} ${row.id} ${row.handle || ""} ${row.email || ""} ${row.user_id || ""}`.toLowerCase().includes(search.toLowerCase())), [rows, filter, search])
  const record = filtered.find((row) => row.key === selected)
  const statuses = [...new Set(rows.map(stateOf))]
  const navigate = (id) => { setRows([]); setSelected(null); setSearch(""); setFilter("all"); setEditor(null); setNotice(""); setSection(id); window.history.replaceState(null, "", hrefFor(id)) }
  const perform = useCallback(async (task) => {
    if (busy) return
    setBusy(true)
    setError("")
    try { await task(); setConfirmation(null); setEditor(null); setNotice("Change saved."); setRevision((value) => value + 1) }
    catch (err) { setError(err.message || "The change could not be saved. Nothing else was attempted."); setConfirmation(null) }
    finally { setBusy(false) }
  }, [busy])
  const confirm = (label, task, requireNote = false) => { setNote(""); setConfirmation({ label, task, requireNote }) }
  const reportAction = (action, label) => confirm(label, (value) => resolveReport({ report: record, action, note: value }), true)
  const openEditor = (row = null) => setEditor({ id: row?.id, title: row?.title || "", body: row?.body || "", category: row?.category || "general", isPublished: row?.is_published || false, isPinned: row?.is_pinned || false })
  const saveContent = () => perform(() => section === "announcements" ? editor.id ? updateAnnouncement(editor.id, editor) : createAnnouncement({ ...editor, user }) : editor.id ? updateForumThread(editor.id, editor) : createForumThread({ ...editor, user }))

  return <div className="mod-workspace" data-compact={compact}>
    <aside className="mod-rail"><Link className="mod-brand" href="/"><span lang="ja">光</span><strong>HIKARI<small>COMMUNITY DESK</small></strong></Link><div className="mod-rail-label">MODERATION / 管理</div><nav aria-label="Moderation">{sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={section === id ? "page" : undefined} onClick={() => navigate(id)}><Icon size={17} />{label}</button>)}</nav><footer><span><Shield size={14} /> Moderator access</span><Link href="/"><ArrowLeft size={14} /> Back to Hikari</Link></footer></aside>
    <main className="mod-main"><header className="mod-heading"><div><p lang="ja">{current.jp} <span>/ COMMUNITY DESK</span></p><h1>{current.label}<span>.</span></h1><p>{current.description}</p></div><button className="mod-button" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh</button></header>
      {error ? <div className="mod-message mod-error" role="alert">{error}<button onClick={() => setRevision((value) => value + 1)}>Try again</button></div> : null}
      {notice ? <div className="mod-message" role="status">{notice}<button onClick={() => setNotice("")}>Dismiss</button></div> : null}
      {section === "settings" ? <section className="mod-preferences"><h2>Your desk, your pace.</h2><label><span><strong>Compact queue</strong><small>Show more cases without changing the detail panel.</small></span><input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} /></label><label><span><strong>Refresh every minute</strong><small>Only while this tab is visible. Pauses during edits and confirmations.</small></span><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} /></label><div className="mod-policy"><Shield size={22} /><div><h3>Safety stays on.</h3><p>Content removals, account restrictions, and role changes always require confirmation. These preferences do not change server permissions or automatically penalize members.</p></div></div></section> : section === "stats" ? <Insights rows={rows} loading={loading} error={error} /> : <>
      <div className="mod-toolbar"><label className="mod-search"><Search size={16} /><input aria-label={`Search ${current.label}`} placeholder="Search names, text, or ID…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label="Filter by status" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><span>{loading ? "Loading…" : `${filtered.length} shown`}</span>{["threads", "announcements"].includes(section) ? <button className="mod-button mod-primary" onClick={() => openEditor()}>+ Write new</button> : null}</div>
      <div className="mod-split"><section className="mod-queue" aria-label={`${current.label} records`} aria-busy={loading}><div className="mod-queue-caption">{section === "reports" ? "AWAITING REVIEW" : "RECORDS"}<span>NEWEST FIRST</span></div>{loading ? <p className="mod-empty" role="status">Loading records…</p> : error ? <p className="mod-empty">Records unavailable. Try refreshing.</p> : !filtered.length ? <div className="mod-empty"><span lang="ja">静</span><h2>{search || filter !== "all" ? "No matches." : "Nothing waiting here."}</h2><p>{search || filter !== "all" ? "Try a different search or status." : "New records will appear here when they arrive."}</p></div> : filtered.map((row) => <button className="mod-case" key={row.key} aria-pressed={row.key === selected} onClick={() => { setSelected(row.key); setEditor(null) }}><div><span className="mod-status" data-status={stateOf(row)}>{stateOf(row)}</span><time>{stamp(row.created_at || row.createdAt)}</time></div><h2>{titleOf(row)}</h2><p>{bodyOf(row)}</p><small>{row.kind === "appeal" ? "ACCOUNT APPEAL" : row.target_type || row.category || row.handle || row.kind} <ArrowUpRight size={13} /></small></button>)}</section>
      <section className="mod-detail" aria-label="Selected record">{editor ? <form className="mod-editor" onSubmit={(event) => { event.preventDefault(); saveContent() }}><p className="mod-eyebrow">{editor.id ? "EDIT" : "NEW"} / {current.label}</p><h2>Make it worth reading.</h2><label>Title<input required maxLength={200} value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} /></label><label>Message<textarea required rows={12} maxLength={20000} value={editor.body} onChange={(event) => setEditor({ ...editor, body: event.target.value })} /></label>{section === "announcements" ? <label className="mod-check"><input type="checkbox" checked={editor.isPublished} onChange={(event) => setEditor({ ...editor, isPublished: event.target.checked })} />Publish to the community</label> : <><label>Category<select value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value })}>{[...new Set(["general", "anime", "manga", "recommendations", editor.category])].map((category) => <option key={category}>{category}</option>)}</select></label><label className="mod-check"><input type="checkbox" checked={editor.isPinned} onChange={(event) => setEditor({ ...editor, isPinned: event.target.checked })} />Pin this thread</label></>}<div className="mod-actions"><button className="mod-button mod-primary" disabled={busy || !editor.title.trim() || !editor.body.trim()}>{busy ? "Saving…" : section === "announcements" && !editor.isPublished ? "Save draft" : "Save & publish"}</button><button type="button" className="mod-button" disabled={busy} onClick={() => setEditor(null)}>Cancel</button></div></form> : loading ? <div className="mod-detail-empty">Loading case details…</div> : record ? <><p className="mod-eyebrow">CASE / {record.id}</p><span className="mod-status" data-status={stateOf(record)}>{stateOf(record)}</span><h2>{titleOf(record)}</h2><dl className="mod-facts"><div><dt>Received</dt><dd>{stamp(record.created_at || record.createdAt)}</dd></div><div><dt>Type</dt><dd>{record.target_type || record.kind}</dd></div>{record.resolution_action ? <div><dt>Decision</dt><dd>{record.resolution_action}</dd></div> : null}{record.user_id ? <div><dt>Account</dt><dd>{record.user_id}</dd></div> : null}</dl><div className="mod-evidence"><h3>{record.kind === "report" ? "Reported content" : "Message & context"}</h3><p>{bodyOf(record)}</p>{record.kind === "report" ? <><h3>Report reason</h3><p>{record.reason || "No reason supplied."}</p></> : null}{record.email ? <p>Contact: {record.email}</p> : null}{record.review_note ? <p>Review note: {record.review_note}</p> : null}{safeLink(record.target_url) ? <Link href={safeLink(record.target_url)} target="_blank" rel="noopener noreferrer">Open original content ↗</Link> : null}</div>
      {record.kind==="report"?<DecisionNotes key={`${record.id}-${record.resolved_at||"pending"}`} reportId={record.id}/>:null}
      <div className="mod-actions" aria-label="Record actions">
        {record.kind === "report" && section !== "history" ? <><button disabled={busy} className="mod-button" onClick={() => reportAction("dismiss", "Dismiss this report?")}>Dismiss</button><button disabled={busy} className="mod-button" onClick={() => reportAction("resolve", "Mark this report resolved?")}>Resolve</button>{record.status !== "escalated" ? <button disabled={busy} className="mod-button" onClick={() => reportAction("escalate", "Escalate for another review?")}>Escalate</button> : null}{(!record.target_type || record.target_type === "social_post") && (record.target_id || record.post_id) ? <button disabled={busy} className="mod-button" onClick={() => reportAction("spoiler", "Mark this post as a spoiler?")}>Mark spoiler</button> : null}{["social_post", "review", "clip_comment", "clip"].includes(record.target_type || "social_post") && (record.target_id || record.post_id) ? <button disabled={busy} className="mod-button mod-danger" onClick={() => reportAction("remove", "Remove this content from public view?")}>Remove content</button> : null}</> : null}
        {record.kind === "feedback" ? <button className="mod-button mod-primary" disabled={busy} onClick={() => perform(() => setFeedbackResolved(record.id, !record.resolved))}>{record.resolved ? "Reopen feedback" : "Mark resolved"}</button> : null}
        {record.kind === "appeal" && record.status === "pending" ? <><button className="mod-button" disabled={busy} onClick={() => confirm("Approve appeal and restore account access?", (value) => reviewBanAppeal(record.id, true, value), true)}>Approve appeal</button><button className="mod-button mod-danger" disabled={busy} onClick={() => confirm("Reject this appeal?", (value) => reviewBanAppeal(record.id, false, value), true)}>Reject appeal</button></> : null}
        {record.kind === "users" ? record.rolesAvailable && record.id !== user.id ? <><button className="mod-button" disabled={busy} onClick={() => confirm(record.isMod ? "Remove moderator access?" : "Grant moderator access?", () => setUserMod(record.id, !record.isMod))}>{record.isMod ? "Remove moderator" : "Make moderator"}</button><button className="mod-button mod-danger" disabled={busy} onClick={() => confirm(record.isBanned ? "Restore this account's access?" : "Ban this account indefinitely?", (value) => record.isBanned ? unbanUserAccount(record.id) : banUserAccount(record.id, { reason: value }), !record.isBanned)}>{record.isBanned ? "Unban account" : "Ban account"}</button></> : <p>{record.id === user.id ? "You cannot change your own access here." : "Role management is unavailable for this record."}</p> : null}
        {["announcements", "threads"].includes(record.kind) ? <><button className="mod-button" onClick={() => openEditor(record)}>Edit</button><button className="mod-button mod-danger" disabled={busy} onClick={() => confirm(`Permanently delete this ${record.kind === "threads" ? "thread" : "announcement"}?`, () => record.kind === "threads" ? deleteForumThread(record.id) : deleteAnnouncement(record.id))}>Delete</button></> : null}
      </div></> : <div className="mod-detail-empty"><span lang="ja">確認</span><h2>Context before action.</h2><p>Select a record to read the full details and choose a response.</p></div>}</section></div><p className="mod-footnote">Showing the latest available records, not a complete archive. {autoRefresh ? "Refreshes every minute while active." : "Refresh manually for new arrivals."}</p></>}
    </main>
    <Dialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open && !busy) setConfirmation(null) }}><DialogContent className="mod-confirm"><DialogHeader><DialogTitle>{confirmation?.label}</DialogTitle><DialogDescription>This changes the selected record: {record ? titleOf(record) : ""}. Review the context before confirming.</DialogDescription></DialogHeader>{confirmation?.requireNote ? <label>Reason or review note<textarea aria-label="Reason or review note" value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} /></label> : null}<DialogFooter><button className="mod-button" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button><button className="mod-button mod-primary" disabled={busy || (confirmation?.requireNote && !note.trim())} onClick={() => perform(() => confirmation.task(note))}>{busy ? "Saving…" : "Confirm change"}</button></DialogFooter></DialogContent></Dialog>
  </div>
}

function Insights({ rows, loading, error }) {
  if (loading) return <p className="mod-empty">Loading report snapshot…</p>
  if (error) return null
  const totals = ["pending", "resolved", "dismissed", "escalated"].map((status) => ({ status, count: rows.filter((row) => stateOf(row) === status).length }))
  return <section className="mod-insights"><div className="mod-insight-total"><span lang="ja">通報の状況</span><strong>{rows.length}</strong><p>reports in this snapshot</p></div><div className="mod-bars">{totals.map(({ status, count }) => <div key={status}><span>{status}<strong>{count}</strong></span><meter min="0" max={Math.max(rows.length, 1)} value={count} aria-label={`${status} reports`} /></div>)}</div><p>Based on the most recent {rows.length} reports (maximum 300). An empty result is not a lifetime total. No forecasts or estimated growth figures.</p></section>
}
