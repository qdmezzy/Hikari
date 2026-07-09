import React from "react"
import { View, Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { useTheme } from "@/theme/ThemeProvider"
import { Text } from "../primitives/Text"

/**
 * Section header mirroring the web home pattern:
 *   <kana label tracking-wide>  +  <English title>  +  optional "View all →"
 * e.g. 視聴中 / Continue Watching.
 */
export function SectionHeader({
  kana,
  title,
  subtitle,
  accentColor,
  onSeeAll,
}: {
  kana?: string
  title: string
  subtitle?: string
  accentColor?: string
  onSeeAll?: () => void
}) {
  const { tokens } = useTheme()
  const accent = accentColor ?? tokens.primary

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
        <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: accent }} />
        <View style={{ flex: 1 }}>
          {kana ? (
            <Text jp size="xs" weight="medium" style={{ color: accent, letterSpacing: 3, marginBottom: 1 }}>
              {kana}
            </Text>
          ) : null}
          <Text size="xl" weight="bold" style={{ color: tokens.foreground }}>
            {title}
          </Text>
          {subtitle ? (
            <Text size="sm" muted style={{ marginTop: 1 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {onSeeAll ? (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
            onSeeAll()
          }}
          hitSlop={12}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text size="sm" weight="medium" style={{ color: tokens.accent }}>
            View All
          </Text>
          <Ionicons name="chevron-forward" size={14} color={tokens.accent} />
        </Pressable>
      ) : null}
    </View>
  )
}
