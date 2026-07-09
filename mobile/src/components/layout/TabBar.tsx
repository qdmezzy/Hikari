import React from "react"
import { View, Pressable, type ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Haptics from "expo-haptics"
import { type Href, usePathname, useRouter } from "expo-router"
import { useTheme } from "@/theme/ThemeProvider"
import { Text } from "../primitives/Text"
import { radii } from "@/theme/tokens"

type TabKey = "index" | "discover" | "search" | "lists" | "calendar"

interface TabDef {
  key: TabKey
  href: Href
  label: string
  kana: string
  icon: keyof typeof Ionicons.glyphMap
  iconActive: keyof typeof Ionicons.glyphMap
}

const TABS: TabDef[] = [
  { key: "index", href: "/", label: "Home", kana: "ホーム", icon: "home-outline", iconActive: "home" },
  { key: "discover", href: "/discover", label: "Discover", kana: "発見", icon: "sparkles-outline", iconActive: "sparkles" },
  { key: "search", href: "/search", label: "Browse", kana: "検索", icon: "search-outline", iconActive: "search" },
  { key: "lists", href: "/lists", label: "My List", kana: "リスト", icon: "list-outline", iconActive: "list" },
  { key: "calendar", href: "/calendar", label: "Schedule", kana: "放送", icon: "calendar-outline", iconActive: "calendar" },
]

export function TabBar() {
  const { tokens, isDark } = useTheme()
  const pathname = usePathname()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const activeKey = TABS.find((t) => (t.key === "index" ? pathname === "/" : pathname.startsWith(t.href as string)))?.key ?? "index"

  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: insets.bottom,
        backgroundColor: isDark ? "rgba(21,22,58,0.82)" : "rgba(251,247,234,0.85)",
      }}
    >
      <BlurView
        intensity={60}
        tint={isDark ? "dark" : "light"}
        style={{
          flexDirection: "row",
          paddingTop: 8,
          paddingBottom: 8,
          borderTopWidth: 1,
          borderTopColor: tokens.border,
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
              style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}
            >
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: radii.lg,
                  backgroundColor: active ? `${tokens.primary}22` : "transparent",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Ionicons
                  name={active ? tab.iconActive : tab.icon}
                  size={22}
                  color={active ? tokens.primary : tokens.mutedForeground}
                />
                {active ? (
                  <Text size="sm" weight="semibold" style={{ color: tokens.primary }}>
                    {tab.label}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )
        })}
      </BlurView>
    </View>
  )
}
