import React, { useState } from "react"
import { View, Pressable, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, spacing } from "@/theme/tokens"
import { Text, Button, Card } from "@/components/primitives"
import { SectionHeader } from "@/components/media/SectionHeader"

const LIST_STATES = [
  { id: "watching", label: "Watching", kana: "視聴中", icon: "play" as const, color: "#22c55e", count: 0 },
  { id: "completed", label: "Completed", kana: "完了", icon: "checkmark-done" as const, color: "#3b82f6", count: 0 },
  { id: "rewatching", label: "Rewatching", kana: "再視聴", icon: "refresh" as const, color: "#a78bfa", count: 0 },
  { id: "on_hold", label: "On Hold", kana: "保留", icon: "pause" as const, color: "#fbbf24", count: 0 },
  { id: "dropped", label: "Dropped", kana: "中止", icon: "close" as const, color: "#ef4444", count: 0 },
  { id: "plan_to_watch", label: "Plan to Watch", kana: "予定", icon: "bookmark" as const, color: "#06b6d4", count: 0 },
]

export default function ListsScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [active, setActive] = useState("watching")

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: spacing[5], paddingBottom: 120, gap: spacing[5] }}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <Text jp size="xs" style={{ color: tokens.primary, letterSpacing: 3, marginBottom: 2 }}>マイリスト</Text>
        <Text size="3xl" weight="black" style={{ color: tokens.foreground }}>My Lists</Text>
      </View>

      {/* State selector chips. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: spacing[5] }}>
        {LIST_STATES.map((s) => {
          const isActive = active === s.id
          return (
            <Pressable
              key={s.id}
              onPress={() => setActive(s.id)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: radii.full,
                borderWidth: 1,
                borderColor: isActive ? `${s.color}66` : tokens.border,
                backgroundColor: isActive ? `${s.color}1A` : tokens.card,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name={isActive ? s.icon : `${s.icon}-outline`} size={14} color={isActive ? s.color : tokens.mutedForeground} />
              <Text size="sm" weight={isActive ? "semibold" : "medium"} style={{ color: isActive ? s.color : tokens.foreground }}>
                {s.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Empty state — sign in to sync. */}
      <Card glass="subtle" style={{ padding: spacing[8], alignItems: "center", gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: `${tokens.primary}1A`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="list" size={32} color={tokens.primary} />
        </View>
        <Text size="lg" weight="semibold" style={{ color: tokens.foreground, textAlign: "center" }}>
          Sign in to see your list
        </Text>
        <Text size="sm" muted style={{ textAlign: "center", maxWidth: 260 }}>
          Track what you're watching, completed, and plan to watch — synced from your Hikari account.
        </Text>
        <Button variant="gradient" onPress={() => router.push("/login")}>Sign in</Button>
      </Card>
    </ScrollView>
  )
}
