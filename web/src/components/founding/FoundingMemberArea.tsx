"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, Clipboard, ExternalLink, Loader2, RefreshCw, ShieldCheck, Ticket, Vote, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FoundingBadge } from "@/components/founding/FoundingBadge"
import { foundingFetch } from "@/lib/founding-api"
import { cn } from "@/lib/utils"

type Proposal = {
  id: string
  title: string
  description: string
  status: string
  supportCount: number
  opposeCount: number
  totalVotes: number
  ownVote: boolean | null
}

type MemberData = {
  member: {
    memberNumber: number
    active: boolean
    showOnFoundersPage: boolean
  }
  proposals?: Proposal[]
  referralsRemaining?: number
  discordLinked?: boolean
}

type FoundingMemberAreaProps = {
  data: MemberData
  onRefresh: () => Promise<void> | void
}

export function FoundingMemberArea({ data, onRefresh }: FoundingMemberAreaProps) {
  const [invites, setInvites] = useState<any[]>([])
  const [loadingInvites, setLoadingInvites] = useState(true)
  const [working, setWorking] = useState("")
  const [latestInvite, setLatestInvite] = useState<{ joinUrl: string; expiresAt: string } | null>(null)
  const [error, setError] = useState("")
  const member = data.member

  const loadInvites = useCallback(async () => {
    if (!member.active) {
      setLoadingInvites(false)
      return
    }
    setLoadingInvites(true)
    try {
      const response = await foundingFetch("/api/founding/invites")
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || "Could not load invitations.")
      setInvites(body.invites || [])
    } catch (requestError: any) {
      setError(requestError?.message || "Could not load invitations.")
    } finally {
      setLoadingInvites(false)
    }
  }, [member.active])

  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success("Invitation copied")
    } catch {
      window.prompt("Copy this invitation:", value)
    }
  }

  const createInvite = async () => {
    setWorking("create-invite")
    setError("")
    try {
      const response = await foundingFetch("/api/founding/invites", {
        method: "POST",
        body: JSON.stringify({ expiresInDays: 14 }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = body?.state === "referral_limit" ? "Both of your referral invitations have already been created." : body?.state === "full" ? "All 25 positions are filled." : body?.error
        throw new Error(message || "Could not create an invitation.")
      }
      setLatestInvite({ joinUrl: body.joinUrl, expiresAt: body.invite.expiresAt })
      await copyText(body.joinUrl)
      await loadInvites()
      await onRefresh()
    } catch (requestError: any) {
      setError(requestError?.message || "Could not create an invitation.")
    } finally {
      setWorking("")
    }
  }

  const revokeInvite = async (inviteId: string) => {
    setWorking(`revoke-${inviteId}`)
    setError("")
    try {
      const response = await foundingFetch("/api/founding/invites", {
        method: "DELETE",
        body: JSON.stringify({ inviteId }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || "Could not revoke this invitation.")
      toast.success("Invitation revoked")
      await loadInvites()
    } catch (requestError: any) {
      setError(requestError?.message || "Could not revoke this invitation.")
    } finally {
      setWorking("")
    }
  }

  const setVote = async (proposalId: string, support: boolean | null) => {
    setWorking(`vote-${proposalId}`)
    setError("")
    try {
      const response = await foundingFetch("/api/founding/votes", {
        method: support === null ? "DELETE" : "PUT",
        body: JSON.stringify({ proposalId, ...(support === null ? {} : { support }) }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || "Could not save your vote.")
      toast.success(support === null ? "Vote removed" : "Vote updated")
      await onRefresh()
    } catch (requestError: any) {
      setError(requestError?.message || "Could not save your vote.")
    } finally {
      setWorking("")
    }
  }

  const updateListing = async (showOnFoundersPage: boolean) => {
    setWorking("listing")
    try {
      const response = await foundingFetch("/api/founding/settings", {
        method: "PATCH",
        body: JSON.stringify({ showOnFoundersPage }),
      })
      if (!response.ok) throw new Error("Could not update your listing preference.")
      toast.success(showOnFoundersPage ? "You are listed on the founders page" : "Your public listing is hidden")
      await onRefresh()
    } catch (requestError: any) {
      setError(requestError?.message || "Could not update your listing preference.")
    } finally {
      setWorking("")
    }
  }

  if (!member.active) {
    return (
      <Card className="border-amber-500/25">
        <CardHeader>
          <CardTitle>Membership inactive</CardTitle>
          <CardDescription>Your founding number remains reserved, but member voting and referrals are paused.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <section className="space-y-6" aria-labelledby="founder-area-heading">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-700 dark:text-amber-300">Your private member area</p>
          <h2 id="founder-area-heading" className="text-2xl font-bold">Help shape what Hikari becomes</h2>
        </div>
        <FoundingBadge memberNumber={member.memberNumber} />
      </div>

      {error ? (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-200">
          <span>{error}</span>
          <Button variant="ghost" size="icon" aria-label="Dismiss error" onClick={() => setError("")}><X className="size-4" /></Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Vote className="size-5 text-amber-600" /> Feature votes</CardTitle>
            <CardDescription>One founding member, one vote. You can change or remove your vote while a proposal is active.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!data.proposals?.length ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No active proposals yet. Ray will post the next product decision here.</div>
            ) : data.proposals.map((proposal) => {
              const percentage = proposal.totalVotes ? Math.round((proposal.supportCount / proposal.totalVotes) * 100) : 0
              const isWorking = working === `vote-${proposal.id}`
              return (
                <article key={proposal.id} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{proposal.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{proposal.description}</p>
                    </div>
                    <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium capitalize">{proposal.status}</span>
                  </div>
                  <div className="mt-4" aria-label={`${percentage}% support from ${proposal.totalVotes} votes`}>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{percentage}% support</span><span>{proposal.totalVotes} vote{proposal.totalVotes === 1 ? "" : "s"}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${percentage}%` }} /></div>
                  </div>
                  {proposal.status === "active" ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant={proposal.ownVote === true ? "default" : "outline"} disabled={isWorking} onClick={() => setVote(proposal.id, true)}><Check className="mr-1 size-4" /> Support</Button>
                      <Button size="sm" variant={proposal.ownVote === false ? "default" : "outline"} disabled={isWorking} onClick={() => setVote(proposal.id, false)}>Not yet</Button>
                      {proposal.ownVote !== null ? <Button size="sm" variant="ghost" disabled={isWorking} onClick={() => setVote(proposal.id, null)}>Remove vote</Button> : null}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Ticket className="size-5 text-amber-600" /> Your referrals</CardTitle>
              <CardDescription>You can create up to two single-use invitations while positions remain.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={createInvite} disabled={working === "create-invite" || Number(data.referralsRemaining || 0) <= 0}>
                {working === "create-invite" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Ticket className="mr-2 size-4" />}
                Create invitation ({data.referralsRemaining || 0} left)
              </Button>
              {latestInvite ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                  <p className="text-sm font-medium">Copy this now</p>
                  <p className="mt-1 text-xs text-muted-foreground">For privacy, the invitation code is only shown once.</p>
                  <Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => copyText(latestInvite.joinUrl)}><Clipboard className="mr-2 size-4" /> Copy invitation</Button>
                </div>
              ) : null}
              {loadingInvites ? <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading invitations…</div> : null}
              {!loadingInvites && !invites.length ? <p className="py-2 text-sm text-muted-foreground">No invitations created yet.</p> : null}
              {invites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div><p className="font-medium capitalize">{String(invite.state).replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">Expires {new Date(invite.expiresAt).toLocaleDateString()}</p></div>
                  {invite.state === "valid" ? <Button variant="ghost" size="icon" aria-label="Revoke invitation" disabled={working === `revoke-${invite.id}`} onClick={() => revokeInvite(invite.id)}><X className="size-4" /></Button> : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-[#5865F2]" /> Private Discord access</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{data.discordLinked ? "Your Discord account is linked. The Founding 25 role will sync automatically when configured." : "Link Discord from the bot with /account so Hikari can securely assign your Founding 25 role."}</p>
              <Button asChild variant="outline" className="w-full"><Link href="/discord-bot">Open Discord setup <ExternalLink className="ml-2 size-4" /></Link></Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div><p className="font-medium">Public founders listing</p><p className="text-xs text-muted-foreground">Your badge remains visible even if you hide your directory card.</p></div>
              <button
                type="button"
                role="switch"
                aria-checked={member.showOnFoundersPage}
                aria-label="Show me on the public Founding Members page"
                disabled={working === "listing"}
                onClick={() => updateListing(!member.showOnFoundersPage)}
                className={cn("relative h-7 w-12 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500", member.showOnFoundersPage ? "border-amber-600 bg-amber-500" : "border-border bg-secondary")}
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition", member.showOnFoundersPage ? "left-6" : "left-0.5")} />
              </button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Button variant="ghost" size="sm" onClick={() => onRefresh()}><RefreshCw className="mr-2 size-4" /> Refresh member area</Button>
    </section>
  )
}
