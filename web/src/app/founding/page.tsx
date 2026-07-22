"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Crown, Loader2, MessageCircle, ShieldCheck, Sparkles, Ticket, Users, Vote } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FoundingGrid } from "@/components/founding/FoundingGrid"
import { FoundingMemberArea } from "@/components/founding/FoundingMemberArea"
import useAuth from "@/hooks/useAuth"
import { useFoundingMe } from "@/hooks/useFoundingMe"

type PublicFoundingData = {
  claimedCount: number
  claimedNumbers: number[]
  members: Array<{ memberNumber: number; displayName: string; handle: string; avatarUrl?: string | null }>
  setupRequired?: boolean
}

export default function FoundingPage() {
  const { user, loading: authLoading, logout } = useAuth()
  const founding = useFoundingMe(user)
  const [publicData, setPublicData] = useState<PublicFoundingData | null>(null)
  const [publicError, setPublicError] = useState("")

  const loadPublicData = useCallback(async () => {
    setPublicError("")
    try {
      const preview = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("preview") : ""
      const response = await fetch(`/api/founding/public${preview ? `?preview=${encodeURIComponent(preview)}` : ""}`, { cache: "no-store" })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || "The roster could not be loaded.")
      setPublicData(body)
    } catch (error: any) {
      setPublicError(error?.message || "The roster could not be loaded.")
    }
  }, [])

  useEffect(() => {
    void loadPublicData()
  }, [loadPublicData])

  const headerUser = user
    ? {
        name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.user_metadata?.username || "Hikari User",
        avatar: user.user_metadata?.avatar_url,
        username: user.user_metadata?.username || user.user_metadata?.handle || "user",
      }
    : null
  const claimedCount = publicData?.claimedCount || 0
  const isFull = claimedCount >= 25

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header user={headerUser} authUser={user} authLoading={authLoading} onLogout={logout} />

      <section className="relative overflow-hidden border-b border-border/50 pb-20 pt-32 sm:pt-36">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_48%)]" />
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-700 shadow-lg shadow-amber-500/10 dark:text-amber-300">
            <Crown className="size-8" aria-hidden="true" />
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-amber-700 dark:text-amber-300">Invitation only · permanently limited</p>
          <h1 className="text-balance text-4xl font-black tracking-tight sm:text-6xl">The Founding 25</h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg">
            Hikari’s first 25 approved community members have a permanent place in its story. They help choose what gets built, welcome thoughtful anime fans, and keep the community grounded as it grows.
          </p>
          <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-amber-500/25 bg-card/75 p-5 shadow-xl shadow-amber-950/5 backdrop-blur">
            <div className="flex items-end justify-center gap-2" aria-label={`${claimedCount} of 25 founding positions claimed`}>
              <span className="font-mono text-5xl font-black text-amber-700 dark:text-amber-300">{claimedCount}</span>
              <span className="pb-1 text-xl font-semibold text-muted-foreground">/ 25</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all" style={{ width: `${Math.min(100, claimedCount * 4)}%` }} /></div>
            <p className="mt-3 text-sm text-muted-foreground">{isFull ? "Every founding number now has an owner." : `${25 - claimedCount} carefully invited position${25 - claimedCount === 1 ? " remains" : "s remain"}.`}</p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16" aria-labelledby="founder-benefits-heading">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 id="founder-benefits-heading" className="text-3xl font-bold">A small group with a real voice</h2>
          <p className="mt-3 text-muted-foreground">Founding membership is recognition and responsibility—not a paid tier or a race to create an account.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Sparkles, title: "Permanent identity", text: "A numbered Founding 25 badge and accessible gold username treatment." },
            { icon: Vote, title: "Feature votes", text: "Vote on selected product decisions and change your vote while polls are open." },
            { icon: MessageCircle, title: "Private Discord", text: "A role and private channel for thoughtful feedback and early conversations." },
            { icon: Ticket, title: "Two referrals", text: "Invite up to two anime fans you trust while founding positions remain." },
          ].map((benefit) => (
            <Card key={benefit.title} className="border-border/70 bg-card/60">
              <CardContent className="p-5"><benefit.icon className="mb-4 size-6 text-amber-600 dark:text-amber-300" aria-hidden="true" /><h3 className="font-semibold">{benefit.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{benefit.text}</p></CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-border/50 bg-muted/15 py-16" aria-labelledby="founder-roster-heading">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700 dark:text-amber-300">The roster</p><h2 id="founder-roster-heading" className="mt-2 text-3xl font-bold">Twenty-five permanent numbers</h2></div>
            <p className="max-w-md text-sm text-muted-foreground">Members choose whether their public profile appears here. Reserved cards respect members who prefer not to be listed.</p>
          </div>
          {!publicData && !publicError ? <div className="flex min-h-52 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" /> Loading the roster…</div> : null}
          {publicError ? <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-5 text-red-800 dark:text-red-200">{publicError} <Button variant="link" onClick={loadPublicData}>Try again</Button></div> : null}
          {publicData ? <FoundingGrid members={publicData.members || []} claimedNumbers={publicData.claimedNumbers || []} /> : null}
          {publicData?.setupRequired ? <p className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">The program is ready in the application; the Founding 25 database migration still needs to be applied.</p> : null}
          {isFull ? <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center"><ShieldCheck className="mx-auto mb-3 size-7 text-amber-600" /><h3 className="font-semibold">The Founding 25 is complete</h3><p className="mt-2 text-sm text-muted-foreground">Thank you to the members who believed in Hikari early. Future community programs will be announced separately—these founding numbers will never be recycled.</p></div> : null}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        {founding.loading ? <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" /> Loading your membership…</div> : null}
        {!founding.loading && founding.data?.member ? <FoundingMemberArea data={founding.data} onRefresh={async () => { await founding.refresh(); await loadPublicData() }} /> : null}
        {!founding.loading && !founding.data?.member ? (
          <Card className="mx-auto max-w-3xl border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card to-card">
            <CardContent className="p-8 text-center sm:p-10"><Users className="mx-auto mb-4 size-8 text-amber-600" /><h2 className="text-2xl font-bold">Membership is personally invited</h2><p className="mx-auto mt-3 max-w-xl text-muted-foreground">Founding positions are granted by Ray or shared through a limited invitation from an active founding member. Creating an account alone does not reserve a number.</p>{user ? <p className="mt-5 text-sm text-muted-foreground">You’re signed in. Open the private invitation you received to continue.</p> : <Button asChild className="mt-6"><Link href="/login?next=%2Ffounding">Sign in to check membership</Link></Button>}</CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  )
}
