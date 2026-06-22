"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowLeft, Mail, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import client from "@/lib/client"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const { error: resetError } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resetError) {
        setError(resetError.message)
        return
      }
      setSubmitted(true)
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Ambient background */}
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
        {/* Brand */}
        <Link href="/" className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/hikari-wordmark.svg" alt="Hikari" className="h-14 w-auto" />
        </Link>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-8 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          {!submitted ? (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Mail className="size-6" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter your email and we&apos;ll send you a link to reset it.
                </p>
              </div>

              {error ? (
                <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="h-12 rounded-xl pl-10"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-accent text-base font-semibold text-white transition-opacity hover:opacity-90"
                >
                  {isLoading ? <Loader2 className="size-5 animate-spin" /> : "Send reset link"}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
              >
                <Check className="size-7" />
              </motion.div>
              <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a reset link to <span className="font-medium text-foreground">{email}</span>.
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Didn&apos;t get it? Check your spam folder.
              </p>
              <Button
                variant="outline"
                className="mt-6 h-11 w-full rounded-xl"
                onClick={() => {
                  setSubmitted(false)
                  setError("")
                }}
              >
                Try another email
              </Button>
            </div>
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
