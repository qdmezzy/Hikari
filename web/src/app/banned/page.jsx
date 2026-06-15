"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Ban, Check, Loader2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { fetchActiveBan, fetchLatestAppeal, submitAppeal } from "@/lib/moderation"

const formatDate = (value) => {
  if (!value) return null
  try {
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
  } catch {
    return null
  }
}

export default function BannedPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [ban, setBan] = useState(null)
  const [appeal, setAppeal] = useState(null)
  const [checking, setChecking] = useState(true)
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/login?next=%2Fbanned")
      return
    }
    let active = true
    ;(async () => {
      const [activeBan, latestAppeal] = await Promise.all([
        fetchActiveBan(user.id),
        fetchLatestAppeal(user.id),
      ])
      if (!active) return
      if (!activeBan) {
        router.replace("/")
        return
      }
      setBan(activeBan)
      setAppeal(latestAppeal)
      setChecking(false)
    })()
    return () => {
      active = false
    }
  }, [user, loading, router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user || submitting) return
    const trimmed = message.trim()
    if (trimmed.length < 20) {
      toast.error("Please write at least a couple of sentences.")
      return
    }
    setSubmitting(true)
    const { error } = await submitAppeal({ userId: user.id, banId: ban?.id, message: trimmed })
    setSubmitting(false)
    if (error) {
      toast.error(error.message?.includes("duplicate") ? "You already have a pending appeal." : "Couldn't submit your appeal.")
      return
    }
    setAppeal({ status: "pending", message: trimmed, created_at: new Date().toISOString() })
    setMessage("")
    toast.success("Appeal submitted — a moderator will review it.")
  }

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  const pending = appeal?.status === "pending"
  const denied = appeal?.status === "denied"
  const expiresLabel = formatDate(ban?.expires_at)

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-lg rounded-3xl border border-destructive/30 bg-card/60 p-8 backdrop-blur-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <Ban className="h-8 w-8" />
          </div>
          <p className="font-jp text-sm font-medium tracking-[0.3em] text-destructive/70">アクセス制限</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Your account is suspended</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {expiresLabel
              ? `Access is restricted until ${expiresLabel}.`
              : "This is a permanent suspension unless overturned on appeal."}
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-border/50 bg-background/40 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reason</p>
          <p className="mt-1 text-sm text-foreground">{ban?.reason || "Violation of community guidelines"}</p>
        </div>

        {pending ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
            <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-amber-400" />
            <p className="text-sm font-semibold text-foreground">Appeal under review</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We&apos;ve received your appeal and a moderator will get back to you.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {denied ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-muted-foreground">
                Your previous appeal was denied
                {appeal?.review_note ? `: "${appeal.review_note}"` : "."} You may submit another.
              </div>
            ) : null}
            <label className="text-sm font-medium text-foreground">Submit an appeal</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain why you think this suspension should be lifted…"
              className="min-h-32"
              maxLength={1500}
            />
            <Button type="submit" disabled={submitting || message.trim().length < 20} className="w-full gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Submit appeal
            </Button>
          </form>
        )}

        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={async () => {
              await client.auth.signOut().catch(() => {})
              router.replace("/")
            }}
            className="hover:text-foreground"
          >
            Sign out
          </button>
          <span className="text-border">·</span>
          <Link href="/feedback" className="hover:text-foreground">Contact us</Link>
        </div>
      </div>
    </div>
  )
}
