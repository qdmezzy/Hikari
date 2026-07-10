import React from "react"
import { Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useTheme } from "@/theme/ThemeProvider"

/**
 * Circular glass back button used by stack screens (Search, Schedule,
 * Settings) — mirrors the round chevron in the web app's sub-pages.
 */
export function BackButton() {
  const { tokens } = useTheme()
  const router = useRouter()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: pressed ? tokens.secondary : tokens.card,
      })}
    >
      <Ionicons name="chevron-back" size={20} color={tokens.foreground} />
    </Pressable>
  )
}
