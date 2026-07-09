import React, { useState } from "react"
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

export default function ForgotPasswordScreen() {
  const { tokens } = useTheme()
  const router = useRouter()
  const { configured } = useAuth()
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    setError("")
    if (!email) {
      setError("Email is required")
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email")
      return
    }
    if (!configured) return

    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email)
      if (resetError) {
        setError(resetError.message || "Could not send reset email.")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
        return
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setSubmitted(true)
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="We'll email you a reset link">
      {submitted ? (
        <View style={{ alignItems: "center", gap: 16, paddingTop: spacing[6] }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: `${tokens.primary}1A`, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="mail" size={34} color={tokens.primary} />
          </View>
          <Text size="lg" weight="semibold" style={{ color: tokens.foreground, textAlign: "center" }}>
            Check your inbox
          </Text>
          <Text size="sm" muted style={{ textAlign: "center" }}>
            If an account exists for {email}, you'll receive a reset link shortly.
          </Text>
          <Button variant="gradient" onPress={() => router.replace("/login")}>Back to sign in</Button>
        </View>
      ) : (
        <View style={{ gap: spacing[5] }}>
          {error ? (
            <View style={{ backgroundColor: `${tokens.destructive}1A`, borderWidth: 1, borderColor: `${tokens.destructive}55`, borderRadius: 12, padding: spacing[4] }}>
              <Text size="sm" style={{ color: tokens.destructive }}>{error}</Text>
            </View>
          ) : null}

          <TextField
            label="Email address"
            icon="mail-outline"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            error={error}
          />

          <Button variant="gradient" size="lg" loading={loading} onPress={handleSubmit} disabled={!configured}>
            {!loading ? <><Ionicons name="send" size={18} color="#fff" /> Send reset link</> : null}
          </Button>

          <Pressable onPress={() => router.replace("/login")} style={{ alignSelf: "center", marginTop: spacing[2] }}>
            <Text size="sm" style={{ color: tokens.primary }}>Back to sign in</Text>
          </Pressable>
        </View>
      )}
    </AuthShell>
  )
}
