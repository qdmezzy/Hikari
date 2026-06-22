"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Lock, Check, Loader2, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import client from "@/lib/client"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  // Supabase sets a recovery session from the email link (detectSessionInUrl).
  useEffect(() => {
    let active = true
    const check = async () => {
      const { data } = await client.auth.getSession()
      if (active && data?.session) setReady(true)
    }
    check()
    const { data: sub } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true)
    })
    return () => {
      active = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (password.length < 8) return setError("Password must be at least 8 characters.")
    if (password !== confirm) return setError("Passwords do not match.")

    setIsLoading(true)
    try {
      const { error: updateError } = await client.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message || "Could not reset your password.")
        return
      }
      setDone(true)
      setTimeout(() => router.replace("/login"), 2200)
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute -left-1/3 -top-1/3 size-[70%] animate-pulse rounded-full bg-gradient-to-br from-primary/25 via-accent/15 to-transparent blur-3xl"
          style={{ animationDuration: "9s" }}
        />
        <div
          className="absolute -bottom-1/3 -right-1/3 size-[65%] animate-pulse rounded-full bg-gradient-to-tl from-accent/20 to-transparent blur-3xl"
          style={{ animationDuration: "11s", animationDelay: "2s" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <Link href="/" className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/hikari-wordmark.svg" alt="Hikari" className="h-14 w-auto" />
        </Link>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-8 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          {done ? (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
              >
                <Check className="size-7" />
              </motion.div>
              <h1 className="text-2xl font-bold tracking-tight">Password updated</h1>
              <p className="mt-2 text-sm text-muted-foreground">Taking you to sign in…</p>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Lock className="size-6" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
                <p className="mt-2 text-sm text-muted-foreground">Choose a strong password you don&apos;t use elsewhere.</p>
              </div>

              {!ready ? (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-300">
                  Open this page from the reset link in your email. If you got here another way,{" "}
                  <Link href="/forgot-password" className="font-medium underline">
                    request a new link
                  </Link>
                  .
                </div>
              ) : null}

              {error ? (
                <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={show ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-12 rounded-xl px-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      aria-label={show ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm"
                      type={show ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      className="h-12 rounded-xl pl-10"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !ready}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-accent text-base font-semibold text-white transition-opacity hover:opacity-90"
                >
                  {isLoading ? <Loader2 className="size-5 animate-spin" /> : "Update password"}
                </Button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
