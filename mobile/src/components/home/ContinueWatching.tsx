import React from "react"
import { View, Pressable, Dimensions } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, spacing } from "@/theme/tokens"
import { Text, Button, Badge } from "../primitives"
import { useContinueWatching } from "@/hooks/useContinueWatching"
import { useAuth } from "@/hooks/useAuth"
import type { ContinueWatchingItem } from "@/hooks/useHomeData"

export function ContinueWatching() {
  const { tokens } = useTheme()
  const router = useRouter()
  const { user, configured } = useAuth()
  const { items, loading } = useContinueWatching()

  if (!configured || !user) {
    return (
      <View
        style={{
          marginHorizontal: spacing[5],
          padding: spacing[6],
          borderRadius: radii["2xl"],
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: `${tokens.card}99`,
          alignItems: "center",
          gap: 12,
        }}
      >
        <Ionicons name="play-circle-outline" size={40} color={tokens.primary} />
        <Text size="lg" weight="semibold" style={{ color: tokens.foreground }}>
          Sign in to sync progress
        </Text>
        <Text size="sm" muted style={{ textAlign: "center" }}>
          Track what you're watching and pick up across devices.
        </Text>
        <Button variant="gradient" onPress={() => router.push("/login")}>
          Sign in
        </Button>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={{ paddingHorizontal: spacing[5], gap: spacing[3] }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <View
            key={i}
            style={{
              height: 96,
              borderRadius: radii["2xl"],
              backgroundColor: tokens.muted,
            }}
          />
        ))}
      </View>
    )
  }

  if (!items.length) {
    return (
      <View
        style={{
          marginHorizontal: spacing[5],
          padding: spacing[6],
          borderRadius: radii["2xl"],
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: `${tokens.card}99`,
          alignItems: "center",
          gap: 12,
        }}
      >
        <Ionicons name="play-circle-outline" size={40} color={tokens.primary} />
        <Text size="lg" weight="semibold" style={{ color: tokens.foreground }}>
          No watch progress yet
        </Text>
        <Text size="sm" muted style={{ textAlign: "center" }}>
          Start tracking a title and your progress will show up here.
        </Text>
        <Button variant="gradient" onPress={() => router.push("/search")}>
          Browse Anime
        </Button>
      </View>
    )
  }

  return (
    <View style={{ paddingHorizontal: spacing[5], gap: spacing[3] }}>
      {items.map((item) => (
        <ContinueCard key={item.id} item={item} />
      ))}
    </View>
  )
}

function ContinueCard({ item }: { item: ContinueWatchingItem }) {
  const { tokens } = useTheme()
  const router = useRouter()

  return (
    <Pressable
      onPress={() => router.push(`/anime/${item.id}`)}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 14,
        backgroundColor: tokens.card,
        borderWidth: 1,
        borderColor: tokens.border,
        borderRadius: radii["2xl"],
        padding: 14,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{ width: 64, height: 88, borderRadius: radii.md, overflow: "hidden", backgroundColor: tokens.secondary }}>
        <Image source={{ uri: item.cover }} style={{ width: 64, height: 88 }} contentFit="cover" recyclingKey={String(item.id)} />
      </View>
      <View style={{ flex: 1, justifyContent: "space-between" }}>
        <View style={{ gap: 4 }}>
          <Text size="sm" weight="semibold" numberOfLines={1} style={{ color: tokens.foreground }}>
            {item.title}
          </Text>
          <Text size="xs" muted>
            {item.totalEp ? `Episode ${item.currentEp} of ${item.totalEp}` : `Progress ${item.currentEp}`}
          </Text>
          {item.nextEpIn ? (
            <Badge variant="success" size="sm">
              <Ionicons name="time" size={9} color={tokens.success} /> Next {item.nextEpIn}
            </Badge>
          ) : null}
        </View>
        {item.totalEp ? (
          <View style={{ gap: 4 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: tokens.muted, overflow: "hidden" }}>
              <LinearGradient
                colors={[tokens.primary, tokens.accent, tokens.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 6, width: `${item.progress}%`, borderRadius: 3 }}
              />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text size="xs" muted>{item.progress}% complete</Text>
              <Text size="xs" muted>{Math.max((item.totalEp ?? 0) - item.currentEp, 0)} left</Text>
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}
