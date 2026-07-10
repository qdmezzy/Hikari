import React, { useMemo, useState } from "react"
import { View, Pressable, ScrollView, RefreshControl, ActivityIndicator } from "react-native"
import { Image } from "expo-image"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, spacing } from "@/theme/tokens"
import { Text, Button, Card } from "@/components/primitives"
import { useAuth } from "@/hooks/useAuth"
import { useMyList, type MyListEntry } from "@/hooks/useMyList"

interface ListState {
  id: string
  label: string
  icon: "play" | "checkmark-done" | "bookmark" | "refresh" | "pause" | "close"
  color: string
}

const ANIME_STATES: ListState[] = [
  { id: "watching", label: "Watching", icon: "play", color: "#22c55e" },
  { id: "completed", label: "Completed", icon: "checkmark-done", color: "#3b82f6" },
  { id: "plan_to_watch", label: "Planned", icon: "bookmark", color: "#06b6d4" },
  { id: "rewatching", label: "Rewatching", icon: "refresh", color: "#a78bfa" },
  { id: "on_hold", label: "On Hold", icon: "pause", color: "#fbbf24" },
  { id: "dropped", label: "Dropped", icon: "close", color: "#ef4444" },
]

const MANGA_STATES: ListState[] = [
  { id: "watching", label: "Reading", icon: "play", color: "#22c55e" },
  { id: "completed", label: "Completed", icon: "checkmark-done", color: "#3b82f6" },
  { id: "plan_to_watch", label: "Planned", icon: "bookmark", color: "#06b6d4" },
  { id: "rewatching", label: "Rereading", icon: "refresh", color: "#a78bfa" },
  { id: "on_hold", label: "On Hold", icon: "pause", color: "#fbbf24" },
  { id: "dropped", label: "Dropped", icon: "close", color: "#ef4444" },
]

/** "Ep 1,169 airs in 2d" pill copy for currently-airing anime. */
function formatAiring(next: { episode: number; airingAt: number }): string {
  const diff = next.airingAt * 1000 - Date.now()
  if (diff <= 0) return `Ep ${next.episode} airing now`
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return `Ep ${next.episode} airs in ${Math.max(1, Math.floor(diff / (1000 * 60)))}m`
  if (hours < 24) return `Ep ${next.episode} airs in ${hours}h`
  const days = Math.round(hours / 24)
  return `Ep ${next.episode} airs in ${days}d`
}

function EntryRow({
  entry,
  color,
  isManga,
  onPlusOne,
}: {
  entry: MyListEntry
  color: string
  isManga: boolean
  onPlusOne: (entry: MyListEntry) => void
}) {
  const { tokens } = useTheme()
  const router = useRouter()
  const unit = isManga ? "Ch" : "Ep"
  const isPlanned = entry.status === "plan_to_watch"
  const canIncrement = ["watching", "rewatching", "on_hold", "plan_to_watch"].includes(entry.status)
  const pct = entry.total ? Math.min(entry.progress / entry.total, 1) : 0

  return (
    <Pressable
      onPress={() => router.push(`/anime/${entry.mediaId}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <Card glass="subtle" style={{ flexDirection: "row", padding: spacing[3], gap: spacing[3], alignItems: "center" }}>
        <Image
          source={{ uri: entry.cover }}
          style={{ width: 52, height: 72, borderRadius: radii.md, backgroundColor: tokens.card }}
          contentFit="cover"
          transition={150}
        />
        <View style={{ flex: 1, gap: 5 }}>
          <Text size="sm" weight="semibold" numberOfLines={1} style={{ color: tokens.foreground }}>
            {entry.title}
          </Text>
          <Text size="xs" muted>
            {isPlanned
              ? entry.total
                ? `${entry.total} ${isManga ? "chapters" : "episodes"}`
                : "Not started"
              : `${unit} ${entry.progress}${entry.total ? ` / ${entry.total}` : ""}`}
            {entry.score ? `  ·  ★ ${entry.score}` : ""}
          </Text>
          {entry.nextAiring && !isPlanned ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="radio-outline" size={11} color={tokens.accent} />
              <Text size="xs" weight="medium" style={{ color: tokens.accent }}>
                {formatAiring(entry.nextAiring)}
              </Text>
            </View>
          ) : null}
          {!isPlanned && entry.total ? (
            <View style={{ height: 4, borderRadius: 2, backgroundColor: tokens.border, overflow: "hidden" }}>
              <View style={{ width: `${Math.round(pct * 100)}%`, height: "100%", backgroundColor: color }} />
            </View>
          ) : null}
        </View>
        {canIncrement ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation?.()
              onPlusOne(entry)
            }}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: radii.full,
              borderWidth: 1,
              borderColor: `${color}55`,
              backgroundColor: pressed ? `${color}33` : `${color}14`,
            })}
          >
            <Ionicons name="add" size={14} color={color} />
            <Text size="xs" weight="semibold" style={{ color }}>
              1
            </Text>
          </Pressable>
        ) : null}
      </Card>
    </Pressable>
  )
}

/**
 * Shared screen for the Anime + Manga tabs — the user's tracked list for one
 * media type with status filter chips, progress bars, airing pills, and +1.
 */
export function MediaListScreen({ mediaType }: { mediaType: "ANIME" | "MANGA" }) {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { entries, loading, refreshing, refresh, plusOne } = useMyList()
  const [active, setActive] = useState("watching")

  const isManga = mediaType === "MANGA"
  const states = isManga ? MANGA_STATES : ANIME_STATES
  const activeState = states.find((s) => s.id === active) ?? states[0]

  const typed = useMemo(
    () => entries.filter((entry) => (entry.mediaType || "ANIME") === mediaType),
    [entries, mediaType],
  )
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const entry of typed) map[entry.status] = (map[entry.status] || 0) + 1
    return map
  }, [typed])
  const visible = useMemo(() => typed.filter((entry) => entry.status === active), [typed, active])

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingHorizontal: spacing[5],
        paddingBottom: 120,
        gap: spacing[5],
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        user ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={tokens.primary} /> : undefined
      }
    >
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View>
          <Text jp size="xs" style={{ color: tokens.primary, letterSpacing: 3, marginBottom: 2 }}>
            {isManga ? "マンガ" : "アニメ"}
          </Text>
          <Text size="3xl" weight="black" style={{ color: tokens.foreground }}>
            {isManga ? "Manga" : "Anime"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search"
            onPress={() => router.push("/search")}
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
            <Ionicons name="search" size={18} color={tokens.foreground} />
          </Pressable>
          {!isManga ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Airing schedule"
              onPress={() => router.push("/calendar")}
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
              <Ionicons name="calendar-outline" size={18} color={tokens.foreground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: spacing[5] }}
      >
        {states.map((s) => {
          const isActive = active === s.id
          const count = counts[s.id] || 0
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
              <Ionicons
                name={isActive ? s.icon : (`${s.icon}-outline` as any)}
                size={14}
                color={isActive ? s.color : tokens.mutedForeground}
              />
              <Text size="sm" weight={isActive ? "semibold" : "medium"} style={{ color: isActive ? s.color : tokens.foreground }}>
                {s.label}
              </Text>
              {count ? (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: radii.full,
                    backgroundColor: isActive ? `${s.color}33` : tokens.border,
                  }}
                >
                  <Text size="xs" weight="semibold" style={{ color: isActive ? s.color : tokens.mutedForeground }}>
                    {count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          )
        })}
      </ScrollView>

      {!user && !authLoading ? (
        <Card glass="subtle" style={{ padding: spacing[8], alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: `${tokens.primary}1A`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={isManga ? "book" : "tv"} size={30} color={tokens.primary} />
          </View>
          <Text size="lg" weight="semibold" style={{ color: tokens.foreground, textAlign: "center" }}>
            Sign in to see your {isManga ? "manga" : "anime"}
          </Text>
          <Text size="sm" muted style={{ textAlign: "center", maxWidth: 260 }}>
            {isManga
              ? "Track what you're reading, completed, and plan to read — synced from your Hikari account."
              : "Track what you're watching, completed, and plan to watch — synced from your Hikari account."}
          </Text>
          <Button variant="gradient" onPress={() => router.push("/login")}>
            Sign in
          </Button>
        </Card>
      ) : loading || authLoading ? (
        <View style={{ paddingVertical: spacing[10], alignItems: "center" }}>
          <ActivityIndicator color={tokens.primary} />
        </View>
      ) : visible.length === 0 ? (
        <Card glass="subtle" style={{ padding: spacing[8], alignItems: "center", gap: 10 }}>
          <Ionicons name={`${activeState.icon}-outline` as any} size={28} color={tokens.mutedForeground} />
          <Text size="sm" muted style={{ textAlign: "center" }}>
            Nothing in {activeState.label} yet.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: spacing[3] }}>
          {visible.map((entry) => (
            <EntryRow key={entry.id} entry={entry} color={activeState.color} isManga={isManga} onPlusOne={plusOne} />
          ))}
        </View>
      )}
    </ScrollView>
  )
}
