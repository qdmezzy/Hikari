"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Sparkles,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Download,
  Compass,
  ListChecks,
  BookMarked,
  Coffee,
  PartyPopper,
} from "lucide-react"
import RequireAuth from "@/components/common/RequireAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { cn } from "@/lib/utils"
import { needsAuthOnboarding, getUserHandle } from "@/lib/auth-onboarding"
import { checkHandleAvailability, normalizeHandle, upsertPublicProfile } from "@/lib/public-profile"
import { importFromAniListUsername, importFromMal } from "@/lib/import-service"

const VIBES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Romance",
  "Sci-Fi", "Slice of Life", "Horror", "Mystery", "Supernatural",
  "Sports", "Psychological", "Isekai", "Shounen", "Shoujo",
]

const GOALS = [
  { id: "discover", label: "Discover new anime", desc: "A feed tuned to your taste", icon: Compass, route: "/search" },
  { id: "track", label: "Track what I watch", desc: "Progress + continue watching", icon: ListChecks, route: "/lists" },
  { id: "lists", label: "Build & organize lists", desc: "Custom lists, your way", icon: BookMarked, route: "/lists" },
  { id: "browse", label: "Just browsing", desc: "Keep it light and simple", icon: Coffee, route: "/" },
]

const resolveNext = (raw) => (raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/")

export default function OnboardingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = useMemo(() => resolveNext(searchParams?.get("next")), [searchParams])

  const needsAccount = useMemo(() => needsAuthOnboarding(user), [user])
  const steps = useMemo(
    () => ["welcome", ...(needsAccount ? ["account"] : []), "vibe", "import", "goal"],
    [needsAccount],
  )

  const [stepIndex, setStepIndex] = useState(0)
  const step = steps[stepIndex]

  // shared data
  const [genres, setGenres] = useState([])
  const [goal, setGoal] = useState("")
  const [imported, setImported] = useState(false)
  const [finishing, setFinishing] = useState(false)

  // account step
  const [displayName, setDisplayName] = useState("")
  const [handle, setHandle] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [accountError, setAccountError] = useState("")
  const [savingAccount, setSavingAccount] = useState(false)

  // import step
  const [malConnected, setMalConnected] = useState(false)
  const [anilistName, setAnilistName] = useState("")
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importError, setImportError] = useState("")
  const [importSummary, setImportSummary] = useState(null)
  const resumedToImport = useRef(false)

  // Skip onboarding entirely if already complete.
  useEffect(() => {
    if (!loading && user?.user_metadata?.onboarding_complete === true) {
      router.replace(nextPath)
    }
  }, [loading, user, nextPath, router])

  // Prefill from existing metadata.
  useEffect(() => {
    if (!user) return
    setDisplayName(user.user_metadata?.display_name || "")
    setHandle(getUserHandle(user) || (user.email ? user.email.split("@")[0] : ""))
    const existing = user.user_metadata?.preferred_genres || user.user_metadata?.favorite_genres
    if (Array.isArray(existing) && existing.length) setGenres(existing)
  }, [user])

  // Resume on the import step after a MAL OAuth round-trip.
  useEffect(() => {
    if (resumedToImport.current) return
    if (searchParams?.get("mal") === "connected" && steps.includes("import")) {
      resumedToImport.current = true
      setMalConnected(true)
      setStepIndex(steps.indexOf("import"))
    }
  }, [searchParams, steps])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading…
      </div>
    )
  }

  if (!user) {
    // Not signed in — RequireAuth redirects to login.
    return (
      <RequireAuth>
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Redirecting…
        </div>
      </RequireAuth>
    )
  }

  const progress = ((stepIndex + 1) / steps.length) * 100

  const persistGenres = async (list) => {
    try {
      await client.auth.updateUser({ data: { preferred_genres: list, favorite_genres: list } })
    } catch {
      /* non-blocking */
    }
  }

  const goNext = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1))
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0))

  const toggleGenre = (g) =>
    setGenres((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]))

  /* ---- account step ---- */
  const submitAccount = async () => {
    setAccountError("")
    const nextHandle = normalizeHandle(handle)
    if (!nextHandle) return setAccountError("Please choose a username.")
    if (password.length < 8) return setAccountError("Password must be at least 8 characters.")
    if (password !== confirmPassword) return setAccountError("Passwords do not match.")

    setSavingAccount(true)
    const { available, error: availErr } = await checkHandleAvailability(nextHandle, user.id)
    if (availErr) {
      setSavingAccount(false)
      return setAccountError(availErr.message || "Could not validate username.")
    }
    if (!available) {
      setSavingAccount(false)
      return setAccountError(`@${nextHandle} is already taken.`)
    }

    const { error: updateErr } = await client.auth.updateUser({
      password,
      data: {
        display_name: displayName.trim() || null,
        username: nextHandle,
        handle: nextHandle,
        oauth_setup_complete: true,
        oauth_password_set: true,
      },
    })
    if (updateErr) {
      setSavingAccount(false)
      return setAccountError(updateErr.message || "Could not finish setup.")
    }
    await upsertPublicProfile(user, { handle: nextHandle, display_name: displayName.trim() || null })
    setSavingAccount(false)
    goNext()
  }

  /* ---- import step ---- */
  const runImport = async (fn) => {
    setImportError("")
    setImportSummary(null)
    setImportProgress(0)
    setImporting(true)
    try {
      const summary = await fn({ userId: user.id, onProgress: setImportProgress })
      setImportSummary(summary)
      setImported(true)
    } catch (e) {
      setImportError(e?.message || "Import failed.")
    } finally {
      setImporting(false)
    }
  }

  const connectMal = async () => {
    await persistGenres(genres) // preserve selection across the OAuth round-trip
    window.location.href = "/api/mal/authorize?returnTo=/onboarding"
  }

  /* ---- finish ---- */
  const finish = async () => {
    setFinishing(true)
    try {
      await client.auth.updateUser({
        data: {
          preferred_genres: genres,
          favorite_genres: genres,
          primary_goal: goal || "discover",
          onboarding_complete: true,
        },
      })
    } catch {
      /* proceed regardless */
    }
    const goalRoute = GOALS.find((g) => g.id === goal)?.route || "/"
    router.replace(imported ? "/lists" : goalRoute)
  }

  return (
    <RequireAuth>
      <div className="relative min-h-screen overflow-hidden bg-background">
        {/* ambient background */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-1/4 -top-1/4 size-[60%] rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl" />
          <div className="absolute -bottom-1/4 -right-1/4 size-[55%] rounded-full bg-gradient-to-tl from-accent/15 to-transparent blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-xl flex-col px-4 py-8">
          {/* progress */}
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <Sparkles className="size-4 text-primary" /> Hikari
              </span>
              <span>
                Step {stepIndex + 1} of {steps.length}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div key={step} className="flex flex-1 flex-col animate-rise">
            {/* ---------- WELCOME ---------- */}
            {step === "welcome" && (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
                  <Sparkles className="size-8" />
                </div>
                <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
                  Welcome to Hikari
                </h1>
                <p className="mt-3 max-w-sm text-pretty text-muted-foreground">
                  Discover what to watch next, track your progress, and build lists you&apos;ll actually use. Let&apos;s set you up — it takes under a minute.
                </p>
                <Button size="lg" className="mt-8 w-full max-w-xs gap-2" onClick={goNext}>
                  Get started <ArrowRight className="size-4" />
                </Button>
              </div>
            )}

            {/* ---------- ACCOUNT (OAuth only) ---------- */}
            {step === "account" && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-2xl font-bold tracking-tight">Finish your account</h1>
                <p className="mt-2 text-muted-foreground">Pick a username and password so you can sign in anytime.</p>
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dn">Display name</Label>
                    <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ray" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="un">Username</Label>
                    <Input id="un" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="ray" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw">Password</Label>
                    <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpw">Confirm password</Label>
                    <Input id="cpw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
                  </div>
                  {accountError ? <p className="text-sm text-destructive">{accountError}</p> : null}
                </div>
                <div className="mt-auto pt-8">
                  <Button className="w-full gap-2" onClick={submitAccount} disabled={savingAccount}>
                    {savingAccount ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* ---------- VIBE ---------- */}
            {step === "vibe" && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-2xl font-bold tracking-tight">What are you into?</h1>
                <p className="mt-2 text-muted-foreground">Pick a few vibes — we&apos;ll tune your discover feed. Choose at least 3.</p>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {VIBES.map((g) => {
                    const active = genres.includes(g)
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGenre(g)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                      >
                        {active ? <Check className="size-3.5" /> : null}
                        {g}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-auto flex items-center gap-3 pt-8">
                  <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back">
                    <ArrowLeft className="size-4" />
                  </Button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Skip
                  </button>
                  <Button
                    className="ml-auto gap-2"
                    disabled={genres.length < 3}
                    onClick={async () => {
                      await persistGenres(genres)
                      goNext()
                    }}
                  >
                    Continue{genres.length ? ` (${genres.length})` : ""} <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ---------- IMPORT ---------- */}
            {step === "import" && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-2xl font-bold tracking-tight">Bring your anime with you</h1>
                <p className="mt-2 text-muted-foreground">
                  Import your list so Hikari instantly knows what you&apos;ve watched, rated, and plan to watch. Don&apos;t start from zero.
                </p>

                {importSummary ? (
                  <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
                    <PartyPopper className="mx-auto mb-2 size-7 text-emerald-500" />
                    <p className="text-lg font-semibold text-foreground">
                      Imported {importSummary.total} titles 🎉
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {importSummary.anime} anime · {importSummary.manga} manga
                      {importSummary.unmatched ? ` · ${importSummary.unmatched} unmatched` : ""}
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {/* MAL */}
                    {malConnected ? (
                      <Button className="w-full justify-between gap-2 py-6" disabled={importing} onClick={() => runImport(importFromMal)}>
                        <span className="flex items-center gap-2">
                          <Download className="size-4" /> Import my MyAnimeList
                        </span>
                        {importing ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full justify-between gap-2 py-6" onClick={connectMal} disabled={importing}>
                        <span className="flex items-center gap-2">
                          <span className="flex size-5 items-center justify-center rounded bg-[#2e51a2] text-[10px] font-bold text-white">M</span>
                          Import from MyAnimeList
                        </span>
                        <ArrowRight className="size-4" />
                      </Button>
                    )}

                    {/* AniList */}
                    <div className="rounded-xl border border-border bg-card p-3">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                        <span className="flex size-5 items-center justify-center rounded bg-[#02a9ff] text-[10px] font-bold text-white">A</span>
                        Import from AniList
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={anilistName}
                          onChange={(e) => setAnilistName(e.target.value)}
                          placeholder="AniList username"
                          disabled={importing}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") runImport(({ userId, onProgress }) => importFromAniListUsername({ userId, username: anilistName, onProgress }))
                          }}
                        />
                        <Button
                          disabled={importing || !anilistName.trim()}
                          onClick={() => runImport(({ userId, onProgress }) => importFromAniListUsername({ userId, username: anilistName, onProgress }))}
                        >
                          {importing ? <Loader2 className="size-4 animate-spin" /> : "Import"}
                        </Button>
                      </div>
                    </div>

                    {importing ? (
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${importProgress}%` }} />
                      </div>
                    ) : null}
                    {importError ? <p className="text-sm text-destructive">{importError}</p> : null}
                  </div>
                )}

                <div className="mt-auto flex items-center gap-3 pt-8">
                  <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back">
                    <ArrowLeft className="size-4" />
                  </Button>
                  {!importSummary ? (
                    <button type="button" onClick={goNext} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      I&apos;m new — skip import
                    </button>
                  ) : null}
                  <Button className="ml-auto gap-2" onClick={goNext}>
                    {importSummary ? "Continue" : "Next"} <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ---------- GOAL ---------- */}
            {step === "goal" && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-2xl font-bold tracking-tight">What&apos;s your goal?</h1>
                <p className="mt-2 text-muted-foreground">We&apos;ll put the right things front and center.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {GOALS.map((g) => {
                    const active = goal === g.id
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setGoal(g.id)}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                          active
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border bg-card hover:border-primary/40",
                        )}
                      >
                        <div className={cn("flex size-10 flex-shrink-0 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                          <g.icon className="size-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{g.label}</p>
                          <p className="text-xs text-muted-foreground">{g.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-auto flex items-center gap-3 pt-8">
                  <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back">
                    <ArrowLeft className="size-4" />
                  </Button>
                  <Button className="ml-auto gap-2" onClick={finish} disabled={finishing}>
                    {finishing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    Finish & explore
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </RequireAuth>
  )
}
