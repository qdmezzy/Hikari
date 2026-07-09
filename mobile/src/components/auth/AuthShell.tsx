import React from "react"
import { View, Pressable, ScrollView, Dimensions } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useTheme } from "@/theme/ThemeProvider"
import { spacing } from "@/theme/tokens"
import { Text } from "../primitives/Text"
import { BrandGlow } from "../primitives/Decorations"

const SCREEN = Dimensions.get("window")

/**
 * Shared backdrop for auth screens — mirrors the web login/register layout:
 * gradient glow orbs top-left & bottom-right, brand wordmark, back button.
 */
export function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title: string
  subtitle?: string
}) {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      {/* Glow orbs. */}
      <View
        style={{
          position: "absolute",
          top: -SCREEN.height * 0.25,
          left: -SCREEN.width * 0.3,
          width: SCREEN.width,
          height: SCREEN.width,
          borderRadius: SCREEN.width,
          backgroundColor: `${tokens.primary}33`,
          opacity: 0.5,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: -SCREEN.height * 0.2,
          right: -SCREEN.width * 0.3,
          width: SCREEN.width * 0.9,
          height: SCREEN.width * 0.9,
          borderRadius: SCREEN.width,
          backgroundColor: `${tokens.accent}26`,
          opacity: 0.4,
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: spacing[5],
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button + wordmark. */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[8] }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `${tokens.card}99`,
              borderWidth: 1,
              borderColor: tokens.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={22} color={tokens.foreground} />
          </Pressable>

          <View style={{ alignItems: "center", flex: 1, marginRight: 40 }}>
            <Text size="3xl" weight="black" brand>Hikari</Text>
            <Text jp size="xs" style={{ color: tokens.mutedForeground, letterSpacing: 3 }}>ヒカリ</Text>
          </View>
        </View>

        <View style={{ marginBottom: spacing[6], alignItems: "center" }}>
          <Text size="2xl" weight="bold" style={{ color: tokens.foreground, textAlign: "center" }}>
            {title}
          </Text>
          {subtitle ? (
            <Text size="sm" muted style={{ textAlign: "center", marginTop: 4 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {children}
      </ScrollView>
    </View>
  )
}
