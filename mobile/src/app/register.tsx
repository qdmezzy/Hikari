import React, { useEffect, useState } from "react"
import { View, Pressable, ActivityIndicator, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import * as Haptics from "expo-haptics"
import { useTheme } from "@/theme/ThemeProvider"
import { spacing, radii } from "@/theme/tokens"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { AuthShell } from "@/components/auth/AuthShell"
import { Text, Button, TextField } from "@/components/primitives"

const STEPS = [
  { id: 1, name: "Account", description: "Email & password" },
  { id: 2, name: "Profile", description: "Your identity" },
  { id: 3, name: "Preferences", description: "Customize" },
]

const GENRE_OPTIONS = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy",
  "Horror", "Mystery", "Romance", "Sci-Fi", "Slice of Life",
]

const PASSWORD_REQS = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One number", test: (v: string) => /[0-9]/.test(v) },
]

interface FormData {
  email: string
  password: string
  confirmPassword: string
  username: string
  displayName: string
  favoriteGenres: string[]
  agreeToTerms: boolean
}

export default function RegisterScreen() {
  const { tokens } = useTheme()
  const router = useRouter()
  const { user, loading, configured } = useAuth()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>({
    email: "", password: "", confirmPassword: "",
    username: "", displayName: "", favoriteGenres: [], agreeToTerms: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace("/(tabs)")
  }, [loading, user, router])

  const set = (key: keyof FormData, value: any) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: "", form: "" }))
  }

  const validateStep = (s: number) => {
    const next: Record<string, string> = {}

    if (s === 1) {
      if (!form.email) next.email = "Email is required"
      else if (!/\S+@\S+\.\S+/.test(form.email)) next.email = "Please enter a valid email"
      if (!form.password) next.password = "Password is required"
      else if (form.password.length < 8) next.password = "Password must be at least 8 characters"
      else if (!/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password))
        next.password = "Use at least one uppercase letter and one number"
      if (!form.confirmPassword) next.confirmPassword = "Please confirm your password"
      else if (form.password !== form.confirmPassword) next.confirmPassword = "Passwords do not match"
    }

    if (s === 2) {
      const handle = form.username.toLowerCase().replace(/[^a-z0-9_]/g, "")
      if (!handle) next.username = "Username is required"
      else if (handle.length < 3) next.username = "Username must be at least 3 characters"
      else if (!/^[a-z0-9_]+$/.test(handle)) next.username = "Only letters, numbers, and underscores"
      if (!form.displayName.trim()) next.displayName = "Display name is required"
    }

    if (s === 3 && !form.agreeToTerms) next.terms = "You must agree to the terms"

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    if (validateStep(step)) setStep((s) => Math.min(s + 1, 3))
  }
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setStep((s) => Math.max(s - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(3) || !configured) return
    setSubmitting(true)
    setErrors({})
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            username: form.username.toLowerCase(),
            display_name: form.displayName,
            favorite_genres: form.favoriteGenres,
          },
        },
      })
      if (error) {
        setErrors({ form: error.message || "Sign up failed. Please try again." })
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
        return
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setSuccess(true)
    } catch (e: any) {
      setErrors({ form: e?.message || "Sign up failed. Please try again." })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={tokens.primary} size="large" />
      </View>
    )
  }

  if (success) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.background, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing[8], gap: 16 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: tokens.success, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="mail-open" size={40} color="#fff" />
        </View>
        <Text size="2xl" weight="bold" style={{ color: tokens.foreground, textAlign: "center" }}>Check your inbox</Text>
        <Text muted style={{ textAlign: "center" }}>
          We sent a verification link to {form.email}. Tap it to activate your account.
        </Text>
        <Button variant="gradient" onPress={() => router.replace("/login")}>Back to sign in</Button>
      </View>
    )
  }

  return (
    <AuthShell title="Create your account" subtitle="Start your anime adventure">
      {/* Step indicator. */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: spacing[6] }}>
        {STEPS.map((s) => {
          const active = step === s.id
          const done = step > s.id
          return (
            <View key={s.id} style={{ flex: 1, gap: 4 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: done || active ? tokens.primary : tokens.muted }} />
              <Text size="xs" weight={active ? "semibold" : "regular"} style={{ color: active ? tokens.primary : tokens.mutedForeground }}>
                {s.name}
              </Text>
            </View>
          )
        })}
      </View>

      {errors.form ? (
        <View style={{ backgroundColor: `${tokens.destructive}1A`, borderWidth: 1, borderColor: `${tokens.destructive}55`, borderRadius: 12, padding: spacing[4], marginBottom: spacing[4] }}>
          <Text size="sm" style={{ color: tokens.destructive }}>{errors.form}</Text>
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: spacing[4] }}>
          <TextField
            label="Email"
            icon="mail-outline"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={form.email}
            onChangeText={(v) => set("email", v)}
            error={errors.email}
          />
          <TextField
            label="Password"
            icon="lock-closed-outline"
            placeholder="Create a password"
            secure
            value={form.password}
            onChangeText={(v) => set("password", v)}
            error={errors.password}
          />
          {/* Password requirements checklist. */}
          {form.password ? (
            <View style={{ gap: 6, paddingLeft: 4 }}>
              {PASSWORD_REQS.map((req) => {
                const met = req.test(form.password)
                return (
                  <View key={req.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name={met ? "checkmark-circle" : "ellipse-outline"} size={14} color={met ? tokens.success : tokens.mutedForeground} />
                    <Text size="xs" style={{ color: met ? tokens.success : tokens.mutedForeground }}>{req.label}</Text>
                  </View>
                )
              })}
            </View>
          ) : null}
          <TextField
            label="Confirm password"
            icon="lock-closed-outline"
            placeholder="Re-enter your password"
            secure
            value={form.confirmPassword}
            onChangeText={(v) => set("confirmPassword", v)}
            error={errors.confirmPassword}
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: spacing[4] }}>
          <TextField
            label="Username"
            icon="at-outline"
            placeholder="otaku_dev"
            autoCapitalize="none"
            autoCorrect={false}
            value={form.username}
            onChangeText={(v) => set("username", v)}
            error={errors.username}
            helper="Letters, numbers, underscores. 3+ characters."
          />
          <TextField
            label="Display name"
            icon="person-outline"
            placeholder="How others see you"
            value={form.displayName}
            onChangeText={(v) => set("displayName", v)}
            error={errors.displayName}
          />
        </View>
      ) : null}

      {step === 3 ? (
        <View style={{ gap: spacing[5] }}>
          <View style={{ gap: 10 }}>
            <Text size="sm" weight="semibold" style={{ color: tokens.foreground }}>Favorite genres</Text>
            <Text size="xs" muted>We'll use these to tune your recommendations.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {GENRE_OPTIONS.map((g) => {
                const selected = form.favoriteGenres.includes(g)
                return (
                  <Pressable
                    key={g}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                      set("favoriteGenres", selected
                        ? form.favoriteGenres.filter((x) => x !== g)
                        : [...form.favoriteGenres, g])
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: radii.full,
                      borderWidth: 1.5,
                      borderColor: selected ? tokens.primary : tokens.border,
                      backgroundColor: selected ? `${tokens.primary}1A` : `${tokens.muted}66`,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {selected ? <Ionicons name="checkmark" size={13} color={tokens.primary} /> : null}
                    <Text size="sm" weight={selected ? "semibold" : "regular"} style={{ color: selected ? tokens.primary : tokens.foreground }}>
                      {g}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <Pressable
            onPress={() => set("agreeToTerms", !form.agreeToTerms)}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
              borderColor: errors.terms ? tokens.destructive : form.agreeToTerms ? tokens.primary : tokens.border,
              backgroundColor: form.agreeToTerms ? tokens.primary : "transparent",
              alignItems: "center", justifyContent: "center", marginTop: 2,
            }}>
              {form.agreeToTerms ? <Ionicons name="checkmark" size={16} color={tokens.primaryForeground} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text size="sm" style={{ color: tokens.foreground }}>
                I agree to the{" "}
                <Text size="sm" style={{ color: tokens.primary }}>Terms</Text> and{" "}
                <Text size="sm" style={{ color: tokens.primary }}>Privacy Policy</Text>
              </Text>
              {errors.terms ? <Text size="xs" style={{ color: tokens.destructive, marginTop: 2 }}>{errors.terms}</Text> : null}
            </View>
          </Pressable>
        </View>
      ) : null}

      {/* Nav buttons. */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: spacing[6] }}>
        {step > 1 ? (
          <Button variant="outline" size="lg" onPress={handleBack}>
            <Ionicons name="arrow-back" size={18} color={tokens.foreground} /> Back
          </Button>
        ) : null}
        {step < 3 ? (
          <Button variant="gradient" size="lg" style={{ flex: 1 }} onPress={handleNext} disabled={!configured}>
            Continue <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Button>
        ) : (
          <Button variant="gradient" size="lg" style={{ flex: 1 }} loading={submitting} onPress={handleSubmit} disabled={!configured}>
            {!submitting ? <><Ionicons name="sparkles" size={18} color="#fff" /> Create account</> : null}
          </Button>
        )}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 4, marginTop: spacing[6] }}>
        <Text size="sm" muted>Already have an account?</Text>
        <Pressable onPress={() => router.push("/login")}>
          <Text size="sm" weight="semibold" style={{ color: tokens.primary }}>Sign in</Text>
        </Pressable>
      </View>
    </AuthShell>
  )
}
