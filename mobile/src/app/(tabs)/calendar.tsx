import React, { useEffect, useState } from "react"
import { View, Pressable, ScrollView, ActivityIndicator, Dimensions } from "react-native"
import { Image } from "expo-image"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, spacing } from "@/theme/tokens"
import { Text, Button, Badge, Card } from "@/components/primitives"
import {
  fetchAniList,
  HOME_SEASONAL_QUERY,
  getCurrentSeason,
  getMediaTitle,
  type AniListMedia,
} from "@/lib/anilist"

const DAY_KEYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

interface CalendarEntry {
  id: number
  title: string
  cover: string
  episode: number
  airingAt: number
  dayKey: (typeof DAY_KEYS)[number]
  time: string
  isToday: boolean
}

export default function CalendarScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const { season, year } = getCurrentSeason()
    fetchAniList<{ Page: { media: AniListMedia[] } }>(HOME_SEASONAL_QUERY, {
      season,
      seasonYear: year,
      page: 1,
      perPage: 30,
    })
      .then((data) => {
        if (!active) return
        const now = new Date()
        const todayKey = DAY_KEYS[now.getDay()]
        const list: CalendarEntry[] = (data?.Page?.media ?? [])
          .filter((m) => m?.nextAiringEpisode?.airingAt)
          .map((m) => {
            const airingAt = m.nextAiringEpisode!.airingAt
            const date = new Date(airingAt * 1000)
            return {
              id: m.id,
              title: getMediaTitle(m),
              cover: m?.coverImage?.extraLarge || m?.coverImage?.large || "",
              episode: m.nextAiringEpisode!.episode,
              airingAt,
              dayKey: DAY_KEYS[date.getDay()],
              time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
              isToday: DAY_KEYS[date.getDay()] === todayKey,
            }
          })
          .sort((a, b) => a.airingAt - b.airingAt)
        setEntries(list)
      })
      .catch(() => active && setEntries([]))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  // Group entries by day.
  const grouped = DAY_KEYS.map((key, i) => ({
    key,
    label: DAY_LABELS[i],
    items: entries.filter((e) => e.dayKey === key),
  }))

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: spacing[5], paddingBottom: 120, gap: spacing[5] }}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <Text jp size="xs" style={{ color: tokens.primary, letterSpacing: 3, marginBottom: 2 }}>放送予定</Text>
        <Text size="3xl" weight="black" style={{ color: tokens.foreground }}>Schedule</Text>
        <Text size="sm" muted>Airing this season</Text>
      </View>

      {loading ? (
        <View style={{ paddingVertical: spacing[12], alignItems: "center" }}>
          <ActivityIndicator color={tokens.primary} size="large" />
        </View>
      ) : (
        grouped.map((day) => (
          <View key={day.key} style={{ gap: spacing[3] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text size="lg" weight="bold" style={{ color: day.items.length ? tokens.foreground : tokens.mutedForeground }}>
                {day.label}
              </Text>
              {day.items.some((i) => i.isToday) ? <Badge variant="success">Today</Badge> : null}
            </View>
            {day.items.length ? (
              day.items.map((entry) => (
                <Pressable
                  key={`${entry.id}-${entry.episode}`}
                  onPress={() => router.push(`/anime/${entry.id}`)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    backgroundColor: tokens.card,
                    borderWidth: 1,
                    borderColor: entry.isToday ? `${tokens.success}55` : tokens.border,
                    borderRadius: radii["2xl"],
                    padding: 12,
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <View style={{ width: 48, height: 64, borderRadius: radii.md, overflow: "hidden", backgroundColor: tokens.secondary }}>
                    <Image source={entry.cover} style={{ width: 48, height: 64 }} contentFit="cover" recyclingKey={String(entry.id)} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text size="sm" weight="semibold" numberOfLines={1} style={{ color: tokens.foreground }}>{entry.title}</Text>
                    <Text size="xs" muted>Episode {entry.episode}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="time-outline" size={12} color={tokens.mutedForeground} />
                      <Text size="xs" muted>{entry.time}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={tokens.mutedForeground} />
                </Pressable>
              ))
            ) : (
              <Text size="sm" muted style={{ paddingLeft: 4 }}>No episodes.</Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  )
}
