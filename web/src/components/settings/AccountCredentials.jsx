"use client"

import { useState } from "react"
import { toast } from "sonner"
import { KeyRound, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import client from "@/lib/client"

function Panel({ title, description, children }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

export function AccountCredentials({ currentEmail }) {
  const [email, setEmail] = useState("")
  const [emailBusy, setEmailBusy] = useState(false)

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [passwordBusy, setPasswordBusy] = useState(false)

  const submitEmail = async (e) => {
    e.preventDefault()
    const next = email.trim()
    if (!next || emailBusy) return
    if (next.toLowerCase() === String(currentEmail || "").toLowerCase()) {
      toast.error("That's already your email.")
      return
    }
    setEmailBusy(true)
    const { error } = await client.auth.updateUser({ email: next })
    setEmailBusy(false)
    if (error) {
      toast.error(error.message || "Couldn't update your email.")
      return
    }
    setEmail("")
    toast.success("Check your inbox — confirm the change from both your old and new email.")
  }

  const submitPassword = async (e) => {
    e.preventDefault()
    if (passwordBusy) return
    if (password.length < 8) {
      toast.error("Use at least 8 characters.")
      return
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.")
      return
    }
    setPasswordBusy(true)
    const { error } = await client.auth.updateUser({ password })
    setPasswordBusy(false)
    if (error) {
      toast.error(error.message || "Couldn't update your password.")
      return
    }
    setPassword("")
    setConfirm("")
    toast.success("Password updated.")
  }

  return (
    <Panel
      title="Sign-in & Security"
      description="Update the email and password you use to sign in."
    >
      <div className="space-y-6">
        <form onSubmit={submitEmail} className="space-y-3">
          <Label htmlFor="change-email" className="flex items-center gap-2 font-medium">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Change email
          </Label>
          <p className="text-xs text-muted-foreground">
            Current: <span className="text-foreground">{currentEmail || "No email on file"}</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="change-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="new@email.com"
              className="flex-1"
            />
            <Button type="submit" disabled={emailBusy || !email.trim()} className="rounded-xl">
              {emailBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Update email
            </Button>
          </div>
        </form>

        <div className="h-px bg-border/50" />

        <form onSubmit={submitPassword} className="space-y-3">
          <Label className="flex items-center gap-2 font-medium">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Change password
          </Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
            />
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
            />
          </div>
          <Button
            type="submit"
            disabled={passwordBusy || !password || !confirm}
            className={cn("rounded-xl")}
          >
            {passwordBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Update password
          </Button>
        </form>
      </div>
    </Panel>
  )
}
