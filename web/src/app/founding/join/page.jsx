"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Crown, Loader2, ShieldAlert, Sparkles, Ticket, Vote } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"
import { foundingFetch } from "@/lib/founding-api"
import { normalizeFoundingInviteCode } from "@/lib/founding-domain.mjs"
import { buildLoginPath } from "@/lib/safe-navigation.mjs"

const STORAGE_KEY = "hikari:founding-invite"
const stateCopy = {
  invalid: ["Invitation not recognized", "This invitation code is incomplete or invalid."],
  expired: ["Invitation expired", "Ask the person who invited you whether they still have another referral available."],
  revoked: ["Invitation revoked", "This invitation is no longer active."],
  already_used: ["Invitation already used", "Founding invitations can only be claimed once."],
  duplicate_member: ["You are already a founder", "Your Hikari account already owns a permanent Founding 25 number."],
  full: ["The Founding 25 is complete", "All 25 permanent positions have been filled. Founding numbers are never recycled."],
  unavailable: ["Invitation service unavailable", "Please try again in a moment."],
}

export default function FoundingJoinPage() {
  const { user, loading: authLoading, logout } = useAuth()
  const [code, setCode] = useState("")
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimResult, setClaimResult] = useState(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""))
    const incoming = normalizeFoundingInviteCode(url.searchParams.get("code") || hashParams.get("code"))
    const saved = normalizeFoundingInviteCode(window.sessionStorage.getItem(STORAGE_KEY))
    const resolved = incoming || saved
    if (incoming) window.sessionStorage.setItem(STORAGE_KEY, incoming)
    window.history.replaceState(null, "", "/founding/join")
    setCode(resolved)
    if (!resolved) {
      setPreview({ state: "invalid" })
      setLoading(false)
      return
    }
    void fetch("/api/founding/invites/preview", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: resolved }),
    })
      .then(async (response) => response.json().catch(() => ({ state: "unavailable" })))
      .then(setPreview)
      .catch(() => setPreview({ state: "unavailable" }))
      .finally(() => setLoading(false))
  }, [])

  const claim = async () => {
    if (!confirmed || !code) return
    setClaiming(true)
    try {
      const response = await foundingFetch("/api/founding/invites/claim", {
        method: "POST",
        body: JSON.stringify({ code }),
      })
      const body = await response.json().catch(() => ({ state: "unavailable" }))
      if (body.state === "claimed") {
        window.sessionStorage.removeItem(STORAGE_KEY)
        window.history.replaceState(null, "", "/founding/join")
      }
      setClaimResult(body)
    } catch {
      setClaimResult({ state: "unavailable" })
    } finally {
      setClaiming(false)
    }
  }

  const headerUser = user ? { name: user.user_metadata?.display_name || user.user_metadata?.username || "Hikari User", avatar: user.user_metadata?.avatar_url, username: user.user_metadata?.username || "user" } : null
  const resultState = claimResult?.state || preview?.state
  const resultMessage = stateCopy[resultState]
  const continuation = "/founding/join?resume=1"

  return (
    <main className="min-h-screen bg-background">
      <Header user={headerUser} authUser={user} authLoading={authLoading} onLogout={logout} />
      <div className="container mx-auto flex min-h-screen max-w-4xl items-center px-4 pb-16 pt-28">
        <div className="w-full">
          <div className="mb-8 text-center"><Crown className="mx-auto mb-4 size-10 text-amber-600" /><p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-700 dark:text-amber-300">Private invitation</p><h1 className="mt-3 text-4xl font-black">Join the Founding 25</h1><p className="mx-auto mt-3 max-w-xl text-muted-foreground">Review what membership means, then confirm it for the Hikari account you control.</p></div>

          {loading || authLoading ? <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" /> Checking your invitation…</div> : null}

          {!loading && claimResult?.state === "claimed" ? (
            <Card className="border-amber-500/35 bg-amber-500/10"><CardContent className="p-8 text-center"><Sparkles className="mx-auto mb-4 size-10 text-amber-600" /><h2 className="text-2xl font-bold">Welcome, Founding Member #{claimResult.memberNumber}</h2><p className="mt-3 text-muted-foreground">Your permanent number is secured. Your badge, voting area, referral tools, and Discord instructions are ready.</p><Button asChild className="mt-6"><Link href="/founding">Open your member area</Link></Button></CardContent></Card>
          ) : null}

          {!loading && !claimResult?.state && preview?.state === "valid" ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <Card><CardHeader><CardTitle>Your invitation</CardTitle><CardDescription>Single use · expires {new Date(preview.expiresAt).toLocaleDateString()}</CardDescription></CardHeader><CardContent>{preview.inviter ? <div className="flex items-center gap-3"><Avatar><AvatarImage src={preview.inviter.avatarUrl || undefined} alt={`${preview.inviter.displayName}'s avatar`} /><AvatarFallback>{preview.inviter.displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div><p className="font-medium">Invited by {preview.inviter.displayName}</p><p className="text-sm text-muted-foreground">@{preview.inviter.handle}</p></div></div> : <p className="text-sm text-muted-foreground">Invited by {preview.invitedByTeam ? "the Hikari team" : "a Hikari founding member"}.</p>}<div className="mt-5 rounded-xl bg-muted/40 p-4 text-sm"><strong>{preview.claimedCount} of 25</strong> positions are currently claimed.</div></CardContent></Card>
              <Card><CardHeader><CardTitle>What you’re accepting</CardTitle><CardDescription>This number is personal, permanent, and cannot be transferred.</CardDescription></CardHeader><CardContent className="space-y-3">{[{ icon: Sparkles, text: "A numbered Founding 25 badge and username identity" }, { icon: Vote, text: "One vote on active founding feature proposals" }, { icon: Ticket, text: "Up to two thoughtful referral invitations" }, { icon: Check, text: "Private Discord role and channel access after secure linking" }].map((benefit) => <div key={benefit.text} className="flex items-start gap-3 text-sm"><benefit.icon className="mt-0.5 size-4 shrink-0 text-amber-600" /><span>{benefit.text}</span></div>)}
                {user ? <><label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm"><input type="checkbox" className="mt-1 size-4 accent-amber-600" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I understand that I am claiming one of 25 permanent positions for this Hikari account.</span></label><Button className="w-full" disabled={!confirmed || claiming} onClick={claim}>{claiming ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Crown className="mr-2 size-4" />} Claim my founding number</Button></> : <div className="mt-5 grid gap-2"><Button asChild><Link href={buildLoginPath(continuation)}>Sign in to accept</Link></Button><Button asChild variant="outline"><Link href={`/register?next=${encodeURIComponent(continuation)}`}>Create a Hikari account</Link></Button><p className="text-center text-xs text-muted-foreground">Your invitation stays in this browser and is not added to the login URL.</p></div>}
              </CardContent></Card>
            </div>
          ) : null}

          {!loading && resultMessage && claimResult?.state !== "claimed" ? <Card className="border-amber-500/25"><CardContent className="p-8 text-center"><ShieldAlert className="mx-auto mb-4 size-9 text-amber-600" /><h2 className="text-2xl font-bold">{resultMessage[0]}</h2><p className="mx-auto mt-3 max-w-lg text-muted-foreground">{resultMessage[1]}</p><Button asChild variant="outline" className="mt-6"><Link href="/founding">View the Founding 25</Link></Button></CardContent></Card> : null}
        </div>
      </div>
    </main>
  )
}
