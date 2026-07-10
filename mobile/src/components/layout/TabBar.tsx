import React from "react"
import { View, Pressable, Platform } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Haptics from "expo-haptics"
import { type Href, usePathname, useRouter } from "expo-router"
import { useTheme } from "@/theme/ThemeProvider"
import { Text } from "../primitives/Text"

type TabKey = "index" | "manga" | "discover" | "community" | "profile"

interface TabDef {
  key: TabKey
  href: Href
  label: string
  kana: string
  icon: keyof typeof Ionicons.glyphMap
  iconActive: keyof typeof Ionicons.glyphMap
}

const TABS: TabDef[] = [
  { key: "index", href: "/", label: "Anime", kana: "アニメ", icon: "tv-outline", iconActive: "tv" },
  { key: "manga", href: "/manga", label: "Manga", kana: "漫画", icon: "book-outline", iconActive: "book" },
  { key: "discover", href: "/discover", label: "Discover", kana: "発見", icon: "sparkles-outline", iconActive: "sparkles" },
  { key: "community", href: "/community", label: "Feed", kana: "交流", icon: "people-outline", iconActive: "people" },
  { key: "profile", href: "/profile", label: "Profile", kana: "プロフ", icon: "person-outline", iconActive: "person" },
]

/**
 * Floating "liquid glass" tab bar: a detached pill with a real blur behind it
 * (only a faint tint on top, so content genuinely shows through), a hairline
 * highlight border, and a soft drop shadow. Content scrolls underneath.
 */
export function TabBar() {
  const { tokens, isDark } = useTheme()
  const pathname = usePathname()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const activeKey =
    TABS.find((t) => (t.key === "index" ? pathname === "/" : pathname.startsWith(t.href as string)))?.key ?? "index"

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: Math.max(insets.bottom, 12) + 4,
        left: 16,
        right: 16,
        alignItems: "center",
      }}
    >
      <View
        style={{
          borderRadius: 32,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)",
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 12,
          width: "100%",
        }}
      >
        <BlurView
          intensity={Platform.OS === "ios" ? 70 : 100}
          tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"}
          style={{
            flexDirection: "row",
            paddingVertical: 8,
            paddingHorizontal: 6,
            backgroundColor: isDark ? "rgba(15,17,51,0.35)" : "rgba(251,247,234,0.35)",
          }}
        >
          {TABS.map((tab) => {
            const active = activeKey === tab.key
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  if (!active) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                    router.push(tab.href)
                  }
                }}
                style={{ flex: 1, alignItems: "center" }}
              >
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 24,
                    backgroundColor: active
                      ? isDark
                        ? "rgba(255,255,255,0.14)"
                        : "rgba(0,0,0,0.07)"
                      : "transparent",
                  }}
                >
                  <Ionicons
                    name={active ? tab.iconActive : tab.icon}
                    size={22}
                    color={active ? tokens.primary : tokens.mutedForeground}
                  />
                  <Text
                    size="xs"
                    weight={active ? "semibold" : "medium"}
                    style={{ color: active ? tokens.primary : tokens.mutedForeground, fontSize: 10 }}
                  >
                    {tab.label}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </BlurView>
      </View>
    </View>
  )
}
