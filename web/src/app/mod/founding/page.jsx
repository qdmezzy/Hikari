"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Clipboard, Crown, Loader2, Plus, RefreshCw, Search, Ticket, UserCheck, UserX, Vote, X } from "lucide-react"
import { toast } from "sonner"
import RequireAuth from "@/components/common/RequireAuth"
import { ModNavigation } from "@/components/layout/ModNavigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { foundingFetch } from "@/lib/founding-api"

export default function FoundingManagementPage() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [forbidden, setForbidden] = useState(false)
  const [query, setQuery] = useState("")
  const [working, setWorking] = useState("")
  const [proposal, setProposal] = useState({ title: "", description: "" })
  const [latestInvite, setLatestInvite] = useState(null)

  const loadDashboard = useCallback(async (searchQuery = "") => {
    setLoading(true)
    setError("")
    try {
      const response = await foundingFetch(`/api/mod/founding${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}`)
      const body = await response.json().catch(() => ({}))
      if (response.status === 403) {
        setForbidden(true)
        return
      }
      if (!response.ok) throw new Error(body?.error || "Could not load Founding 25 management.")
      setDashboard(body)
      setForbidden(false)
    } catch (requestError) {
      setError(requestError?.message || "Could not load Founding 25 management.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const runAction = async (payload, key) => {
    setWorking(key)
    setError("")
    try {
      const response = await foundingFetch("/api/mod/founding", { method: "POST", body: JSON.stringify(payload) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || "The action could not be completed.")
      if (["full", "duplicate_member", "user_not_found", "forbidden"].includes(body.state)) {
        throw new Error(String(body.state).replaceAll("_", " "))
      }
      toast.success(body.memberNumber ? `Founding member #${body.memberNumber} granted` : "Founding program updated")
      await loadDashboard(query)
      return body
    } catch (requestError) {
      setError(requestError?.message || "The action could not be completed.")
      return null
    } finally {
      setWorking("")
    }
  }

  const createInvite = async () => {
    setWorking("create-invite")
    try {
      const response = await foundingFetch("/api/founding/invites", { method: "POST", body: JSON.stringify({ expiresInDays: 30 }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.state === "full" ? "All positions are filled." : body?.error || "Could not create invitation.")
      setLatestInvite(body)
      await navigator.clipboard.writeText(body.joinUrl).catch(() => {})
      toast.success("Invitation created and copied")
      await loadDashboard(query)
    } catch (requestError) {
      setError(requestError?.message || "Could not create invitation.")
    } finally {
      setWorking("")
    }
  }

  const revokeInvite = async (id) => {
    setWorking(`revoke-${id}`)
    try {
      const response = await foundingFetch("/api/founding/invites", { method: "DELETE", body: JSON.stringify({ inviteId: id }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || "Could not revoke invitation.")
      toast.success("Invitation revoked")
      await loadDashboard(query)
    } catch (requestError) {
      setError(requestError?.message || "Could not revoke invitation.")
    } finally {
      setWorking("")
    }
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <ModNavigation />
        <main className="pb-24 md:pb-8">
          <div className="px-4 py-6 md:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700 dark:text-amber-300">Moderator-only</p><h1 className="mt-2 text-3xl font-bold">Founding 25 management</h1><p className="mt-2 text-muted-foreground">Grant permanent numbers, manage single-use invitations, and run feature votes.</p></div>
                <Button variant="outline" onClick={() => loadDashboard(query)} disabled={loading}><RefreshCw className="mr-2 size-4" /> Refresh</Button>
              </div>

              {loading ? <div className="flex min-h-60 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" /> Loading protected founding data…</div> : null}
              {forbidden ? <Card className="border-red-500/25"><CardContent className="p-8 text-center"><UserX className="mx-auto mb-4 size-8 text-red-500" /><h2 className="text-xl font-semibold">Moderator access required</h2><p className="mt-2 text-muted-foreground">This page also verifies your immutable Supabase moderator metadata on the server.</p></CardContent></Card> : null}
              {error ? <div role="alert" className="flex items-start justify-between rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-red-800 dark:text-red-200"><span>{error}</span><Button variant="ghost" size="icon" aria-label="Dismiss error" onClick={() => setError("")}><X className="size-4" /></Button></div> : null}

              {dashboard && !forbidden ? <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Claimed positions</p><p className="mt-2 font-mono text-4xl font-black text-amber-700 dark:text-amber-300">{dashboard.claimedCount} / 25</p></CardContent></Card>
                  <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Available positions</p><p className="mt-2 font-mono text-4xl font-black">{25 - dashboard.claimedCount}</p></CardContent></Card>
                  <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Active proposals</p><p className="mt-2 font-mono text-4xl font-black">{dashboard.proposals.filter((item) => item.status === "active").length}</p></CardContent></Card>
                </div>

                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Search className="size-5" /> Grant membership</CardTitle><CardDescription>Search only by a safe Hikari public handle. No email or UUID search is exposed.</CardDescription></CardHeader>
                  <CardContent>
                    <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void loadDashboard(query) }}><Label htmlFor="founder-search" className="sr-only">Hikari handle</Label><Input id="founder-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by handle…" /><Button type="submit">Search</Button></form>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {dashboard.searchResults.map((result) => <div key={result.handle} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="flex min-w-0 items-center gap-3"><Avatar className="size-9"><AvatarImage src={result.avatarUrl || undefined} alt={`${result.displayName}'s avatar`} /><AvatarFallback>{result.displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate font-medium">{result.displayName}</p><p className="truncate text-xs text-muted-foreground">@{result.handle}</p></div></div><Button size="sm" disabled={working === `grant-${result.handle}` || dashboard.claimedCount >= 25} onClick={() => runAction({ action: "grant", handle: result.handle }, `grant-${result.handle}`)}><UserCheck className="mr-1 size-4" /> Grant</Button></div>)}
                      {query && !dashboard.searchResults.length ? <p className="text-sm text-muted-foreground">No safe handle matched that search.</p> : null}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Crown className="size-5 text-amber-600" /> Permanent numbers</CardTitle><CardDescription>Inactive numbers remain occupied and are never automatically reused.</CardDescription></CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {Array.from({ length: 25 }, (_, index) => index + 1).map((number) => { const member = dashboard.members.find((item) => item.memberNumber === number); return <div key={number} className="rounded-xl border p-3"><div className="flex items-center justify-between"><span className="font-mono font-bold">#{number}</span>{member ? <Badge variant={member.active ? "default" : "secondary"}>{member.active ? "Active" : "Inactive"}</Badge> : <Badge variant="outline">Open</Badge>}</div>{member ? <><p className="mt-3 truncate text-sm font-medium">{member.profile?.displayName || "Profile unavailable"}</p><p className="truncate text-xs text-muted-foreground">{member.profile?.handle ? `@${member.profile.handle}` : "No public handle"}</p><Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => runAction({ action: "set-member-active", memberNumber: number, active: !member.active }, `member-${number}`)} disabled={working === `member-${number}`}>{member.active ? "Deactivate" : "Reactivate"}</Button></> : <p className="mt-5 text-xs text-muted-foreground">Available for the next atomic grant or claim.</p>}</div> })}
                  </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card><CardHeader><CardTitle className="flex items-center gap-2"><Ticket className="size-5" /> Invitations</CardTitle><CardDescription>Codes are hashed in the database and the raw invitation is shown only once.</CardDescription></CardHeader><CardContent className="space-y-3"><Button onClick={createInvite} disabled={working === "create-invite" || dashboard.claimedCount >= 25}><Plus className="mr-2 size-4" /> Generate 30-day invitation</Button>{latestInvite ? <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3"><p className="text-sm font-medium">Copy this invitation now</p><Button className="mt-2" size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(latestInvite.joinUrl).then(() => toast.success("Copied"))}><Clipboard className="mr-2 size-4" /> Copy secure link</Button></div> : null}<div className="max-h-96 space-y-2 overflow-y-auto">{dashboard.invites.map((invite) => <div key={invite.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"><div><p className="font-medium capitalize">{invite.state.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">Created by {invite.creator?.handle ? `@${invite.creator.handle}` : "Hikari team"} · {new Date(invite.createdAt).toLocaleDateString()}</p>{invite.claimant?.handle ? <p className="text-xs text-muted-foreground">Claimed by @{invite.claimant.handle}</p> : null}</div>{invite.state === "valid" ? <Button size="icon" variant="ghost" aria-label="Revoke invitation" disabled={working === `revoke-${invite.id}`} onClick={() => revokeInvite(invite.id)}><X className="size-4" /></Button> : null}</div>)}</div></CardContent></Card>

                  <Card><CardHeader><CardTitle className="flex items-center gap-2"><Vote className="size-5" /> Feature proposals</CardTitle><CardDescription>Draft privately, activate voting, then close or archive the result.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-3 rounded-xl border p-4"><Label htmlFor="proposal-title">Proposal title</Label><Input id="proposal-title" value={proposal.title} onChange={(event) => setProposal((current) => ({ ...current, title: event.target.value }))} maxLength={120} /><Label htmlFor="proposal-description">Description</Label><Textarea id="proposal-description" value={proposal.description} onChange={(event) => setProposal((current) => ({ ...current, description: event.target.value }))} maxLength={2000} /><Button disabled={working === "create-proposal" || proposal.title.trim().length < 3} onClick={async () => { const result = await runAction({ action: "create-proposal", ...proposal }, "create-proposal"); if (result) setProposal({ title: "", description: "" }) }}><Plus className="mr-2 size-4" /> Create draft</Button></div><div className="space-y-3">{dashboard.proposals.map((item) => <div key={item.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.description}</p></div><Badge className="capitalize" variant="secondary">{item.status}</Badge></div><p className="mt-3 text-xs text-muted-foreground">{item.supportCount} support · {item.opposeCount} not yet</p><div className="mt-3 flex flex-wrap gap-2">{["draft", "active", "closed", "archived"].filter((status) => status !== item.status).map((status) => <Button key={status} size="sm" variant="outline" disabled={working === `proposal-${item.id}`} onClick={() => runAction({ action: "update-proposal", proposalId: item.id, status }, `proposal-${item.id}`)}>{status === "active" ? <Check className="mr-1 size-3" /> : null}{status}</Button>)}</div></div>)}</div></CardContent></Card>
                </div>
              </> : null}
            </div>
          </div>
        </main>
      </div>
    </RequireAuth>
  )
}
