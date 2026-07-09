import React, { useEffect, useState } from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import * as Haptics from "expo-haptics"
import { useTheme } from "@/theme/ThemeProvider"
import { spacing } from "@/theme/tokens"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { AuthShell } from "@/components/auth/AuthShell"
import { Text, Button, TextField } from "@/components/primitives"

export default function LoginScreen() {
  const { tokens } = useTheme()
  const router = useRouter()
  const { user, loading, configured } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [oauthLoading, setOauthLoading] = useState("")
  const [success, setSuccess] = useState(false)

  // Signed-in users don't need to see this screen.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/(tabs)")
    }
  }, [loading, user, router])

  const validate = () => {
    const next: Record<string, string> = {}
    if (!email) next.email = "Email is required"
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = "Please enter a valid email"
    if (!password) next.password = "Password is required"
    else if (password.length < 6) next.password = "Password must be at least 6 characters"
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate() || !configured) return
    setSubmitting(true)
    setErrors({})
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setErrors({ form: error.message || "Login failed. Please try again." })
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
        return
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setSuccess(true)
      setTimeout(() => router.replace("/(tabs)"), 700)
    } catch (e: any) {
      setErrors({ form: e?.message || "Login failed. Please try again." })
    } finally {
      setSubmitting(false)
    }
  }

  const handleOAuth = async (provider: "google" | "discord") => {
    if (!configured) return
    setOauthLoading(provider)
    setErrors({})
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider })
      if (error) setErrors({ form: error.message || "Could not start social sign in." })
    } finally {
      setOauthLoading("")
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
      <View style={{ flex: 1, backgroundColor: tokens.background, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: tokens.success, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="checkmark-circle" size={48} color="#fff" />
        </View>
        <Text size="2xl" weight="bold" style={{ color: tokens.foreground }}>Welcome back!</Text>
        <Text muted>Redirecting to your dashboard...</Text>
      </View>
    )
  }

  return (
    <AuthShell title="Sign in to your account" subtitle="Welcome back, Otaku">
      {!configured ? (
        <View style={{ backgroundColor: `${tokens.warning}1A`, borderWidth: 1, borderColor: `${tokens.warning}55`, borderRadius: 12, padding: spacing[4], marginBottom: spacing[5] }}>
          <Text size="sm" style={{ color: tokens.warning }}>
            Supabase isn't configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable sign-in.
          </Text>
        </View>
      ) : null}

      {errors.form ? (
        <View style={{ backgroundColor: `${tokens.destructive}1A`, borderWidth: 1, borderColor: `${tokens.destructive}55`, borderRadius: 12, padding: spacing[4], marginBottom: spacing[5] }}>
          <Text size="sm" style={{ color: tokens.destructive }}>{errors.form}</Text>
        </View>
      ) : null}

      {/* OAuth buttons. */}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: spacing[5] }}>
        <OAuthButton
          provider="google"
          loading={oauthLoading === "google"}
          disabled={!configured || submitting || Boolean(oauthLoading)}
          onPress={() => handleOAuth("google")}
        />
        <OAuthButton
          provider="discord"
          loading={oauthLoading === "discord"}
          disabled={!configured || submitting || Boolean(oauthLoading)}
          onPress={() => handleOAuth("discord")}
        />
      </View>

      {/* Divider. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing[5] }}>
        <View style={{ flex: 1, height: 1, backgroundColor: tokens.border }} />
        <Text size="sm" muted>or</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: tokens.border }} />
      </View>

      <View style={{ gap: spacing[5] }}>
        <TextField
          label="Email"
          icon="mail-outline"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          error={errors.email}
        />

        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text size="sm" weight="medium" style={{ color: tokens.foreground, marginBottom: 6 }}>Password</Text>
            <Pressable onPress={() => router.push("/forgot-password")} hitSlop={8}>
              <Text size="sm" style={{ color: tokens.primary, marginBottom: 6 }}>Forgot?</Text>
            </Pressable>
          </View>
          <TextField
            icon="lock-closed-outline"
            placeholder="Enter your password"
            secure
            value={password}
            onChangeText={setPassword}
            error={errors.password}
          />
        </View>

        <Button variant="gradient" size="lg" loading={submitting} onPress={handleSubmit} disabled={!configured}>
          {!submitting ? <><Ionicons name="arrow-forward" size={18} color="#fff" /> Sign in to Hikari</> : null}
        </Button>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 4, marginTop: spacing[6] }}>
        <Text size="sm" muted>Don't have an account?</Text>
        <Pressable onPress={() => router.push("/register")}>
          <Text size="sm" weight="semibold" style={{ color: tokens.primary }}>Create one</Text>
        </Pressable>
      </View>

      <Text size="xs" muted style={{ textAlign: "center", marginTop: spacing[8] }}>
        By signing in, you agree to our Terms and Privacy Policy
      </Text>
    </AuthShell>
  )
}

function OAuthButton({
  provider,
  loading,
  disabled,
  onPress,
}: {
  provider: "google" | "discord"
  loading: boolean
  disabled: boolean
  onPress: () => void
}) {
  const { tokens } = useTheme()
  const icon = provider === "google" ? "logo-google" : "logo-discord"
  const color = provider === "google" ? "#ea4335" : tokens.discord

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        height: 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: `${tokens.card}99`,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={icon} size={20} color={color} />
      )}
      <Text size="sm" weight="semibold" style={{ color: tokens.foreground }}>
        {provider === "google" ? "Google" : "Discord"}
      </Text>
    </Pressable>
  )
}
