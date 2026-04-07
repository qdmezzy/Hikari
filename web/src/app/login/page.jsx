"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
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

  useEffect(() => {
    if (!loading && user) {
      router.push("/")
    }
  }, [loading, router, user])

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
            redirectTo: `${window.location.origin}/onboarding`,
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
      router.push("/")
    } catch (error) {
      setErrors({ form: error?.message || "Login failed. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider) => {
    setErrors({})
    setOauthLoading(provider)

    const redirectTo = `${window.location.origin}/onboarding`

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
    <div className="min-h-screen flex relative overflow-hidden bg-background">
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full bg-gradient-to-br from-primary/30 via-accent/20 to-transparent blur-3xl animate-pulse"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full bg-gradient-to-tl from-accent/20 via-primary/10 to-transparent blur-3xl animate-pulse"
          style={{ animationDuration: "10s", animationDelay: "3s" }}
        />
      </div>

      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-3 gap-2 p-4 opacity-40">
          {[...showcaseAnime, ...showcaseAnime, ...showcaseAnime].map((cover, index) => (
            <motion.div
              key={`${cover}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="relative aspect-[3/4] rounded-xl overflow-hidden"
            >
              <Image src={cover} alt="" fill className="object-cover" />
            </motion.div>
          ))}
        </div>

        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-transparent to-background" />

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8 max-w-lg"
          >
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
              </div>
              <span className="text-3xl font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Hikari
              </span>
            </Link>

            <div className="space-y-4">
              <h1 className="text-5xl xl:text-6xl font-black text-foreground leading-[1.1]">
                Welcome back,
                <span className="block bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Otaku
                </span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Continue your anime adventure. Your watchlist is waiting for you.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: Play, value: "50K+", label: "Anime Titles" },
                { icon: Heart, value: "2M+", label: "Users" },
                { icon: Star, value: "4.9", label: "Rating" },
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                  className="text-center p-4 rounded-2xl bg-card/30 backdrop-blur-sm border border-border/30"
                >
                  <stat.icon className="w-5 h-5 text-accent mx-auto mb-2" />
                  <div className="text-2xl font-black text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            <div className="space-y-3 pt-4">
              {[
                "Sync with AniList & MyAnimeList instantly",
                "AI-powered personalized recommendations",
                "Track episodes, scores & watch time",
              ].map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                  className="flex items-center gap-3 text-muted-foreground"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-3 h-3 text-accent" />
                  </div>
                  <span>{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-8 relative z-10"
        >
          <div className="lg:hidden text-center">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="text-2xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Hikari
              </span>
            </Link>
          </div>

          <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl">
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
                  <p className="text-muted-foreground">Redirecting to your dashboard...</p>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-foreground">Sign in to your account</h2>
                    <p className="mt-2 text-muted-foreground">
                      {"Don't have an account? "}
                      <Link href="/register" className="text-primary hover:text-primary/80 font-semibold transition-colors">
                        Create one
                      </Link>
                    </p>
                  </div>

                  {errors.form ? (
                    <div className="mb-6 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
                        <path d="M20.317 4.3698A19.7913 19.7913 0 0 0 15.8857 3c-.1914.3289-.4133.771-.565 1.1167a18.2676 18.2676 0 0 0-5.6415 0c-.1517-.3457-.3783-.7878-.5717-1.1167a19.7363 19.7363 0 0 0-4.4337 1.3698C1.8693 8.3458.1103 12.2264.9961 16.0528A19.9352 19.9352 0 0 0 6.0586 18.555c.4056-.5552.7665-1.146.1078-1.758-.5535-.2098-1.0792-.4662-1.579-.7594.1326-.0972.2625-.1998.3886-.3029 3.0466 1.4306 6.3563 1.4306 9.3665 0 .1277.1045.2576.2071.3902.3029-.4998.2932-1.0271.5496-1.5822.7594.463.6119.8239 1.2027 1.228 1.758a19.886 19.886 0 0 0 5.0641-2.5022c1.0385-4.4358-1.7721-8.281-4.1241-11.683zM8.02 13.33c-.9366 0-1.701-0.8474-1.701-1.885 0-1.0376.7499-1.885 1.701-1.885.9594 0 1.7166.8552 1.701 1.885 0 1.0376-.7499 1.885-1.701 1.885zm7.96 0c-.9366 0-1.701-0.8474-1.701-1.885 0-1.0376.7499-1.885 1.701-1.885.9594 0 1.7166.8552 1.701 1.885 0 1.0376-.7416 1.885-1.701 1.885z" />
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
                        <Link href="/forgot-password" className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
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
                      className="w-full h-14 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold text-base rounded-xl shadow-lg shadow-primary/25 transition-all group"
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
