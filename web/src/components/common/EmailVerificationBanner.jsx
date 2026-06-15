"use client"

import { useState } from "react"
import { toast } from "sonner"
import { MailWarning, X } from "lucide-react"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"

export function EmailVerificationBanner() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)

  // Only show for email/password users who haven't confirmed yet.
  const needsVerification =
    !!user &&
    !user.email_confirmed_at &&
    !user.confirmed_at &&
    !!user.email

  if (!needsVerification || dismissed) return null

  const resend = async () => {
    if (sending) return
    setSending(true)
    const { error } = await client.auth.resend({ type: "signup", email: user.email })
    setSending(false)
    if (error) {
      toast.error(error.message || "Couldn't resend the verification email.")
      return
    }
    toast.success("Verification email sent — check your inbox.")
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[60] border-b border-amber-500/30 bg-amber-500/10 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 text-sm">
        <MailWarning className="h-4 w-4 shrink-0 text-amber-400" />
        <p className="flex-1 text-amber-100/90">
          Please verify your email to unlock posting and the full community.
        </p>
        <button
          type="button"
          onClick={resend}
          disabled={sending}
          className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-400/30 disabled:opacity-60"
        >
          {sending ? "Sending…" : "Resend email"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-full p-1 text-amber-100/70 transition-colors hover:bg-amber-400/20 hover:text-amber-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
