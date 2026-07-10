import React from "react"
import { View, Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Haptics from "expo-haptics"
import { type Href, usePathname, useRouter } from "expo-router"
import { useTheme } from "@/theme/ThemeProvider"
import { Text } from "../primitives/Text"
import { radii } from "@/theme/tokens"

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
  { key: "community", href: "/community", label: "Community", kana: "交流", icon: "people-outline", iconActive: "people" },
  { key: "profile", href: "/profile", label: "Profile", kana: "プロフ", icon: "person-outline", iconActive: "person" },
]

export function TabBar() {
  const { tokens, isDark } = useTheme()
  const pathname = usePathname()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const activeKey =
    TABS.find((t) => (t.key === "index" ? pathname === "/" : pathname.startsWith(t.href as string)))?.key ?? "index"

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
              style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}
            >
              <View
                style={{
                  alignItems: "center",
                  gap: 3,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: radii.lg,
                  backgroundColor: active ? `${tokens.primary}1E` : "transparent",
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
  )
}
