"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import RequireAuth from "@/components/RequireAuth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { getUserHandle, needsAuthOnboarding } from "@/lib/auth-onboarding"
import { checkHandleAvailability, normalizeHandle, upsertPublicProfile } from "@/lib/public-profile"

const resolveNextPath = (raw) => {
  if (!raw || typeof raw !== "string") return "/"
  if (!raw.startsWith("/")) return "/"
  if (raw.startsWith("//")) return "/"
  return raw
}

export default function OnboardingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [displayName, setDisplayName] = useState("")
  const [handle, setHandle] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [handleStatus, setHandleStatus] = useState({ state: "idle", message: "" })

  const nextPath = useMemo(() => resolveNextPath(searchParams?.get("next")), [searchParams])

  useEffect(() => {
    if (!user) return
    setDisplayName(user?.user_metadata?.display_name || "")
    const existingHandle = getUserHandle(user)
    const fallbackHandle = user?.email ? user.email.split("@")[0] : ""
    setHandle(existingHandle || fallbackHandle)
  }, [user])

  useEffect(() => {
    if (!loading && user && !needsAuthOnboarding(user)) {
      router.replace(nextPath)
    }
  }, [loading, user, nextPath, router])

  useEffect(() => {
    if (!user) return
    const candidate = normalizeHandle(handle)
    if (!candidate) {
      setHandleStatus({ state: "idle", message: "" })
      return
    }
    let active = true
    const timer = setTimeout(async () => {
      setHandleStatus({ state: "checking", message: "Checking..." })
      const { available, error: availabilityError } = await checkHandleAvailability(candidate, user.id)
      if (!active) return
      if (availabilityError) {
        setHandleStatus({ state: "error", message: availabilityError.message || "Could not check username." })
        return
      }
      if (!available) {
        setHandleStatus({ state: "taken", message: `@${candidate} is taken.` })
        return
      }
      setHandleStatus({ state: "ok", message: `@${candidate} is available.` })
    }, 350)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [handle, user?.id])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!user) return

    setError("")
    const nextHandle = normalizeHandle(handle)
    if (!nextHandle) {
      setError("Please choose a username.")
      return
    }
    const { available, error: availabilityError } = await checkHandleAvailability(nextHandle, user.id)
    if (availabilityError) {
      setError(availabilityError.message || "Could not validate username.")
      return
    }
    if (!available) {
      setError(`@${nextHandle} is already taken.`)
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setSaving(true)
    const metadata = {
      display_name: displayName.trim() || null,
      username: nextHandle,
      handle: nextHandle,
      oauth_setup_complete: true,
      oauth_password_set: true,
    }

    const { error: updateError } = await client.auth.updateUser({
      password,
      data: metadata,
    })

    if (updateError) {
      setError(updateError.message || "Could not finish setup.")
      setSaving(false)
      return
    }

    const { error: publicProfileError } = await upsertPublicProfile(user, {
      handle: nextHandle,
      display_name: displayName.trim() || null,
    })
    if (publicProfileError) {
      console.error("Failed to sync public profile during onboarding:", publicProfileError)
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("hikari:auth:pending-oauth-link")
    }
    router.replace(nextPath)
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="bg-card/90 border-border/60">
            <CardHeader>
              <CardTitle>Finish your account setup</CardTitle>
              <CardDescription>
                Set a username and password so you can sign in with email anytime.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="display-name">Display name</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Ray"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={handle}
                    onChange={(event) => setHandle(event.target.value)}
                    placeholder="ray"
                    required
                  />
                  {handleStatus.state === "ok" ? (
                    <p className="text-xs text-emerald-400">{handleStatus.message}</p>
                  ) : null}
                  {handleStatus.state === "taken" ? (
                    <p className="text-xs text-amber-400">{handleStatus.message}</p>
                  ) : null}
                  {handleStatus.state === "error" ? (
                    <p className="text-xs text-red-400">{handleStatus.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter password"
                    required
                  />
                </div>
                {error ? <p className="text-sm text-red-400">{error}</p> : null}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={saving || handleStatus.state === "checking" || handleStatus.state === "taken"}
                >
                  {saving ? "Saving..." : "Continue"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAuth>
  )
}
