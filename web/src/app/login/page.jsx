"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AuthArtwork } from "@/components/layout/AuthArtwork"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Sparkles,
  ArrowRight,
  Zap,
  Heart,
  Play,
  Star,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { needsAuthOnboarding } from "@/lib/auth-onboarding"
import { getPostLoginDestination, getSafeNextPath } from "@/lib/safe-navigation.mjs"

const PENDING_OAUTH_LINK_KEY = "hikari:auth:pending-oauth-link"

const showcaseAnime = [
  "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1fmjRv4JQUd.jpg",
  "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iwfIsLu.png",
  "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx150672-2WWJVXIAOG11.png",
  "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-FlochcFsyoF4.png",
  "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145064-5fa4ZBbW4dqA.jpg",
  "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx131681-ODIRpBIbR5Eu.jpg",
]

const isExistingAccountOauthError = (message = "") => {
  const text = String(message).toLowerCase()
  return (
    text.includes("already") ||
    text.includes("exists") ||
    text.includes("registered") ||
    text.includes("identity")
  )
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  })
  const [errors, setErrors] = useState({})
  const nextPath = useMemo(() => getSafeNextPath(searchParams.get("next")), [searchParams])
  const onboardingPath = useMemo(
    () => `/onboarding?next=${encodeURIComponent(nextPath)}`,
    [nextPath],
  )

  useEffect(() => {
    if (!loading && user && !isLoading) {
      router.replace(getPostLoginDestination(nextPath, { requiresOnboarding: needsAuthOnboarding(user) }))
    }
  }, [isLoading, loading, nextPath, onboardingPath, router, user])

  const validateForm = () => {
    const nextErrors = {}

    if (!formData.email) {
      nextErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      nextErrors.email = "Please enter a valid email"
    }

    if (!formData.password) {
      nextErrors.password = "Password is required"
    } else if (formData.password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters"
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setErrors({})

    try {
      const { data, error: signInError } = await client.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (signInError) {
        setErrors({ form: signInError.message || "Login failed. Please try again." })
        return
      }

      const metadataUpdates = {
        oauth_password_set: true,
      }
      const currentHandle = data?.user?.user_metadata?.username || data?.user?.user_metadata?.handle
      if (currentHandle) {
        metadataUpdates.oauth_setup_complete = true
      }
      await client.auth.updateUser({ data: metadataUpdates })

      const pendingProvider =
        typeof window !== "undefined" ? window.localStorage.getItem(PENDING_OAUTH_LINK_KEY) : null

      if (pendingProvider === "google" || pendingProvider === "discord") {
        const { error: linkError } = await client.auth.linkIdentity({
          provider: pendingProvider,
          options: {
            redirectTo: `${window.location.origin}${onboardingPath}`,
          },
        })

        if (linkError) {
          setErrors({ form: linkError.message || `Could not link ${pendingProvider}.` })
          return
        }

        return
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(PENDING_OAUTH_LINK_KEY)
      }

      setLoginSuccess(true)
      await new Promise((resolve) => setTimeout(resolve, 800))
      router.replace(getPostLoginDestination(nextPath, { requiresOnboarding: needsAuthOnboarding(data?.user) }))
    } catch (error) {
      setErrors({ form: error?.message || "Login failed. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider) => {
    setErrors({})
    setOauthLoading(provider)

    const redirectTo = `${window.location.origin}${onboardingPath}`

    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        ...(provider === "google"
          ? {
              queryParams: {
                access_type: "offline",
                prompt: "consent",
              },
            }
          : {}),
      },
    })

    if (error) {
      if (isExistingAccountOauthError(error.message)) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PENDING_OAUTH_LINK_KEY, provider)
        }
        setErrors({
          form: `This email already has an account. Sign in with email/password once, and we'll link ${provider} automatically.`,
        })
      } else {
        setErrors({ form: error.message || "Could not start social sign in." })
      }
      setOauthLoading("")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-page-in text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-accent animate-pulse" />
          <p className="text-muted-foreground">Loading sign in...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="hikari-revamp rv-auth min-h-screen">
      <AuthArtwork />
      <div className="rv-auth-form flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-8 relative z-10"
        >
          <div className="lg:hidden flex justify-center">
            <Link href="/" className="inline-flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/hikari-wordmark.svg" alt="Hikari" className="h-12 w-auto" />
            </Link>
          </div>

          <div className="rv-auth-fields">
            <AnimatePresence mode="wait">
              {loginSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30"
                  >
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Welcome back!</h2>
                  <p className="text-muted-foreground">Opening your Hikari…</p>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="rv-auth-heading mb-8">
                    <h2 className="text-2xl font-bold text-foreground">Welcome back.</h2>
                    <p className="mt-2 text-muted-foreground">
                      {"Don't have an account? "}
                      <Link
                        href={`/register?next=${encodeURIComponent(nextPath)}`}
                        className="text-primary hover:text-primary/80 font-semibold transition-colors"
                      >
                        Create one
                      </Link>
                    </p>
                  </div>

                  {errors.form ? (
                    <div role="alert" className="mb-6 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {errors.form}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <Button
                      variant="outline"
                      className="h-12 bg-card/50 hover:bg-card border-border/50 hover:border-primary/50 transition-all group"
                      disabled={isLoading || Boolean(oauthLoading)}
                      onClick={() => handleOAuthSignIn("google")}
                      type="button"
                    >
                      <svg className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      {oauthLoading === "google" ? "Connecting..." : "Google"}
                    </Button>

                    <Button
                      variant="outline"
                      className="h-12 bg-card/50 hover:bg-card border-border/50 hover:border-primary/50 transition-all group"
                      disabled={isLoading || Boolean(oauthLoading)}
                      onClick={() => handleOAuthSignIn("discord")}
                      type="button"
                    >
                      <svg className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                      </svg>
                      {oauthLoading === "discord" ? "Connecting..." : "Discord"}
                    </Button>
                  </div>

                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-card px-4 text-muted-foreground">or</span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                      <div className="relative group">
                        <div
                          className={cn(
                            "absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary/50 to-accent/50 opacity-0 blur transition-opacity",
                            focusedField === "email" && "opacity-100",
                          )}
                        />
                        <div className="relative">
                          <Mail
                            className={cn(
                              "absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors",
                              focusedField === "email" ? "text-primary" : "text-muted-foreground",
                            )}
                          />
                          <Input
                            id="email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={formData.email}
                            onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                            onFocus={() => setFocusedField("email")}
                            onBlur={() => setFocusedField(null)}
                            className={cn(
                              "pl-12 h-14 bg-muted/30 border-border/50 rounded-xl text-base focus:border-primary/50 transition-all",
                              errors.email && "border-destructive focus:border-destructive",
                            )}
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                      {errors.email ? (
                        <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-destructive">
                          {errors.email}
                        </motion.p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                        <Link href={`/forgot-password?next=${encodeURIComponent(nextPath)}`} className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
                          Forgot?
                        </Link>
                      </div>
                      <div className="relative group">
                        <div
                          className={cn(
                            "absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary/50 to-accent/50 opacity-0 blur transition-opacity",
                            focusedField === "password" && "opacity-100",
                          )}
                        />
                        <div className="relative">
                          <Lock
                            className={cn(
                              "absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors",
                              focusedField === "password" ? "text-primary" : "text-muted-foreground",
                            )}
                          />
                          <Input
                            id="password"
                            autoComplete="current-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            value={formData.password}
                            onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))}
                            onFocus={() => setFocusedField("password")}
                            onBlur={() => setFocusedField(null)}
                            className={cn(
                              "pl-12 pr-12 h-14 bg-muted/30 border-border/50 rounded-xl text-base focus:border-primary/50 transition-all",
                              errors.password && "border-destructive focus:border-destructive",
                            )}
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>
                      {errors.password ? (
                        <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-destructive">
                          {errors.password}
                        </motion.p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="remember"
                        checked={formData.rememberMe}
                        onCheckedChange={(checked) =>
                          setFormData((current) => ({ ...current, rememberMe: Boolean(checked) }))
                        }
                        disabled={isLoading}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                        Keep me signed in for 30 days
                      </Label>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md transition-all group"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Signing in...
                        </div>
                      ) : (
                        <span className="flex items-center gap-2">
                          Sign in to Hikari
                          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </span>
                      )}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="text-primary hover:underline">Terms</Link>
            {" "}and{" "}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
