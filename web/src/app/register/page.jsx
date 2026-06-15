"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  AtSign,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { FloatingDecorations, Sparkle, GlowOrb } from "@/components/common/anime-decorations"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import {
  checkHandleAvailability,
  normalizeHandle,
  upsertPublicProfile,
} from "@/lib/public-profile"

const steps = [
  { id: 1, name: "Account", description: "Email & password" },
  { id: 2, name: "Profile", description: "Your identity" },
  { id: 3, name: "Preferences", description: "Customize experience" },
]

const genreOptions = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
]

const passwordRequirements = [
  { label: "At least 8 characters", test: (value) => value.length >= 8 },
  { label: "One uppercase letter", test: (value) => /[A-Z]/.test(value) },
  { label: "One number", test: (value) => /[0-9]/.test(value) },
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

export default function RegisterPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    displayName: "",
    favoriteGenres: [],
    agreeToTerms: false,
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!loading && user) {
      router.push("/")
    }
  }, [loading, router, user])

  const validateStep = (step) => {
    const nextErrors = {}

    if (step === 1) {
      if (!formData.email) {
        nextErrors.email = "Email is required"
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        nextErrors.email = "Please enter a valid email"
      }

      if (!formData.password) {
        nextErrors.password = "Password is required"
      } else if (formData.password.length < 8) {
        nextErrors.password = "Password must be at least 8 characters"
      } else if (!/[A-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
        nextErrors.password = "Use at least one uppercase letter and one number"
      }

      if (!formData.confirmPassword) {
        nextErrors.confirmPassword = "Please confirm your password"
      } else if (formData.password !== formData.confirmPassword) {
        nextErrors.confirmPassword = "Passwords do not match"
      }
    }

    if (step === 2) {
      const normalizedHandle = normalizeHandle(formData.username)
      if (!normalizedHandle) {
        nextErrors.username = "Username is required"
      } else if (normalizedHandle.length < 3) {
        nextErrors.username = "Username must be at least 3 characters"
      } else if (!/^[a-z0-9_]+$/.test(normalizedHandle)) {
        nextErrors.username = "Username can only contain letters, numbers, and underscores"
      }

      if (!formData.displayName.trim()) {
        nextErrors.displayName = "Display name is required"
      }
    }

    if (step === 3 && !formData.agreeToTerms) {
      nextErrors.terms = "You must agree to the terms and conditions"
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleNext = () => {
    setSuccessMessage("")
    if (validateStep(currentStep)) {
      setCurrentStep((current) => Math.min(current + 1, steps.length))
    }
  }

  const handleBack = () => {
    setSuccessMessage("")
    setCurrentStep((current) => Math.max(current - 1, 1))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!validateStep(3)) return

    setIsLoading(true)
    setErrors({})
    setSuccessMessage("")

    try {
      const handleValue = normalizeHandle(formData.username)
      if (!handleValue) {
        setErrors({ username: "Please choose a username." })
        return
      }

      const { available, error: availabilityError } = await checkHandleAvailability(handleValue)
      if (availabilityError) {
        setErrors({ form: availabilityError.message || "Could not validate username." })
        return
      }
      if (!available) {
        setErrors({ username: `@${handleValue} is already taken.` })
        setCurrentStep(2)
        return
      }

      const { data, error: signUpError } = await client.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            display_name: formData.displayName.trim() || null,
            username: handleValue,
            handle: handleValue,
            favorite_genres: formData.favoriteGenres,
            oauth_setup_complete: true,
            oauth_password_set: true,
          },
        },
      })

      if (signUpError) {
        setErrors({ form: signUpError.message || "Failed to create account. Please try again." })
        return
      }

      if (data?.session && data?.user) {
        const { error: profileError } = await upsertPublicProfile(data.user, {
          handle: handleValue,
          display_name: formData.displayName.trim(),
        })

        if (profileError) {
          console.warn("Failed to create public profile during signup:", profileError)
        }

        router.push("/onboarding")
        return
      }

      setSuccessMessage("Account created! Check your email to confirm your account, then sign in.")
      setTimeout(() => {
        router.push("/login")
      }, 2500)
    } catch (error) {
      setErrors({ form: error?.message || "An error occurred during registration." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider) => {
    setErrors({})
    setSuccessMessage("")
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
        setErrors({ form: "This email already has an account. Sign in from the login page to link this provider." })
      } else {
        setErrors({ form: error.message || "Could not start social sign in." })
      }
      setOauthLoading("")
    }
  }

  const toggleGenre = (genre) => {
    setFormData((current) => ({
      ...current,
      favoriteGenres: current.favoriteGenres.includes(genre)
        ? current.favoriteGenres.filter((item) => item !== genre)
        : [...current.favoriteGenres, genre],
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-page-in text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-accent animate-pulse" />
          <p className="text-muted-foreground">Loading sign up...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-accent/20 via-primary/10 to-background overflow-hidden">
        <GlowOrb className="-top-20 -right-20" size="lg" color="accent" />
        <GlowOrb className="bottom-10 left-10" size="md" color="primary" />
        <GlowOrb className="top-1/2 left-1/3" size="sm" color="aurora" />

        <FloatingDecorations density="normal" />

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <Sparkles className="h-10 w-10 text-primary" />
                <Sparkle className="absolute -top-1 -right-1" size={12} />
              </div>
              <span className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Hikari
              </span>
            </Link>

            <div className="space-y-4 max-w-md">
              <h1 className="text-4xl xl:text-5xl font-bold text-foreground leading-tight text-balance">
                Start your anime journey today
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Join thousands of anime fans tracking their watchlists and discovering new favorites.
              </p>
            </div>

            <div className="pt-8 space-y-4">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-4 transition-all duration-300",
                    currentStep >= step.id ? "opacity-100" : "opacity-50",
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                      currentStep > step.id
                        ? "bg-primary text-primary-foreground"
                        : currentStep === step.id
                          ? "bg-primary/20 text-primary border-2 border-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
                  </div>
                  <div>
                    <p className={cn("font-medium", currentStep >= step.id ? "text-foreground" : "text-muted-foreground")}>
                      {step.name}
                    </p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        <FloatingDecorations density="sparse" className="lg:hidden" />

        <div className="w-full max-w-md space-y-8 relative z-10">
          <div className="lg:hidden text-center">
            <Link href="/" className="inline-flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Hikari
              </span>
            </Link>
          </div>

          <div className="lg:hidden">
            <div className="flex items-center justify-center gap-2 mb-4">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={cn("w-3 h-3 rounded-full transition-all", currentStep >= step.id ? "bg-primary" : "bg-muted")}
                />
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Step {currentStep} of {steps.length}: {steps[currentStep - 1].name}
            </p>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground">
              {currentStep === 1 && "Create your account"}
              {currentStep === 2 && "Set up your profile"}
              {currentStep === 3 && "Customize your experience"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {currentStep === 1 && (
                <>
                  Already have an account?{" "}
                  <Link href="/login" className="text-primary hover:text-primary/80 font-medium">
                    Sign in
                  </Link>
                </>
              )}
              {currentStep === 2 && "Choose how you want to be known"}
              {currentStep === 3 && "Pick a few favorite genres for a more personal feed"}
            </p>
          </div>

          {errors.form ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errors.form}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
              {successMessage}
            </div>
          ) : null}

          {currentStep === 1 ? (
            <>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-12 glass hover:bg-muted/50"
                  disabled={isLoading || Boolean(oauthLoading)}
                  onClick={() => handleOAuthSignIn("google")}
                  type="button"
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {oauthLoading === "google" ? "Connecting..." : "Continue with Google"}
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-12 glass hover:bg-muted/50"
                  disabled={isLoading || Boolean(oauthLoading)}
                  onClick={() => handleOAuthSignIn("discord")}
                  type="button"
                >
                  <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.3698A19.7913 19.7913 0 0 0 15.8857 3c-.1914.3289-.4133.771-.565 1.1167a18.2676 18.2676 0 0 0-5.6415 0c-.1517-.3457-.3783-.7878-.5717-1.1167a19.7363 19.7363 0 0 0-4.4337 1.3698C1.8693 8.3458.1103 12.2264.9961 16.0528A19.9352 19.9352 0 0 0 6.0586 18.555c.4056-.5552.7665-1.146.1078-1.758-.5535-.2098-1.0792-.4662-1.579-.7594.1326-.0972.2625-.1998.3886-.3029 3.0466 1.4306 6.3563 1.4306 9.3665 0 .1277.1045.2576.2071.3902.3029-.4998.2932-1.0271.5496-1.5822.7594.463.6119.8239 1.2027 1.228 1.758a19.886 19.886 0 0 0 5.0641-2.5022c1.0385-4.4358-1.7721-8.281-4.1241-11.683zM8.02 13.33c-.9366 0-1.701-0.8474-1.701-1.885 0-1.0376.7499-1.885 1.701-1.885.9594 0 1.7166.8552 1.701 1.885 0 1.0376-.7499 1.885-1.701 1.885zm7.96 0c-.9366 0-1.701-0.8474-1.701-1.885 0-1.0376.7499-1.885 1.701-1.885.9594 0 1.7166.8552 1.701 1.885 0 1.0376-.7416 1.885-1.701 1.885z" />
                  </svg>
                  {oauthLoading === "discord" ? "Connecting..." : "Continue with Discord"}
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-background px-4 text-muted-foreground">or continue with email</span>
                </div>
              </div>
            </>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            {currentStep === 1 ? (
              <div className="space-y-5 animate-fade-in-up">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                      className={cn(
                        "pl-10 h-12 bg-muted/30 border-border/50 focus:border-primary/50",
                        errors.email && "border-destructive",
                      )}
                    />
                  </div>
                  {errors.email ? <p className="text-sm text-destructive">{errors.email}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))}
                      className={cn(
                        "pl-10 pr-10 h-12 bg-muted/30 border-border/50 focus:border-primary/50",
                        errors.password && "border-destructive",
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password ? <p className="text-sm text-destructive">{errors.password}</p> : null}

                  {formData.password.length > 0 ? (
                    <div className="space-y-1.5 pt-2">
                      {passwordRequirements.map((requirement) => {
                        const passed = requirement.test(formData.password)
                        return (
                          <div
                            key={requirement.label}
                            className={cn(
                              "flex items-center gap-2 text-xs transition-colors",
                              passed ? "text-emerald-400" : "text-muted-foreground",
                            )}
                          >
                            <div className={cn("h-4 w-4 rounded-full flex items-center justify-center transition-colors", passed ? "bg-emerald-500/20" : "bg-secondary")}>
                              {passed ? <Check className="h-3 w-3" /> : null}
                            </div>
                            {requirement.label}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(event) => setFormData((current) => ({ ...current, confirmPassword: event.target.value }))}
                      className={cn(
                        "pl-10 h-12 bg-muted/30 border-border/50 focus:border-primary/50",
                        errors.confirmPassword && "border-destructive",
                      )}
                    />
                  </div>
                  {errors.confirmPassword ? <p className="text-sm text-destructive">{errors.confirmPassword}</p> : null}
                </div>
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div className="space-y-5 animate-fade-in-up">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="username"
                      placeholder="your_username"
                      value={formData.username}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, username: normalizeHandle(event.target.value) }))
                      }
                      className={cn(
                        "pl-10 h-12 bg-muted/30 border-border/50 focus:border-primary/50",
                        errors.username && "border-destructive",
                      )}
                    />
                  </div>
                  {errors.username ? <p className="text-sm text-destructive">{errors.username}</p> : null}
                  <p className="text-xs text-muted-foreground">This becomes your public @handle.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="displayName"
                      placeholder="Your Name"
                      value={formData.displayName}
                      onChange={(event) => setFormData((current) => ({ ...current, displayName: event.target.value }))}
                      className={cn(
                        "pl-10 h-12 bg-muted/30 border-border/50 focus:border-primary/50",
                        errors.displayName && "border-destructive",
                      )}
                    />
                  </div>
                  {errors.displayName ? <p className="text-sm text-destructive">{errors.displayName}</p> : null}
                  <p className="text-xs text-muted-foreground">This is how other people will see your name.</p>
                </div>
              </div>
            ) : null}

            {currentStep === 3 ? (
              <div className="space-y-5 animate-fade-in-up">
                <div className="space-y-3">
                  <Label>Favorite Genres (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {genreOptions.map((genre) => (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => toggleGenre(genre)}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm font-medium transition-all",
                          formData.favoriteGenres.includes(genre)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selected: {formData.favoriteGenres.length}/{genreOptions.length}
                  </p>
                </div>

                <div className="space-y-3 pt-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms"
                      checked={formData.agreeToTerms}
                      onCheckedChange={(checked) =>
                        setFormData((current) => ({ ...current, agreeToTerms: Boolean(checked) }))
                      }
                      className="mt-0.5"
                    />
                    <Label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                      I agree to the{" "}
                      <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
                      {" "}and{" "}
                      <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                    </Label>
                  </div>
                  {errors.terms ? <p className="text-sm text-destructive">{errors.terms}</p> : null}
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-3 pt-4">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1 h-12"
                  disabled={isLoading}
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back
                </Button>
              ) : null}

              {currentStep < steps.length ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 h-12 bg-primary hover:bg-primary/90 group"
                  disabled={isLoading}
                >
                  Continue
                  <ArrowRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="flex-1 h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Creating account...
                    </div>
                  ) : (
                    <span className="flex items-center gap-2">
                      Create Account
                      <Sparkles className="h-5 w-5" />
                    </span>
                  )}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
