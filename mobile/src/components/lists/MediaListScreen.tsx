import React, { useMemo, useState } from "react"
import { View, Pressable, ScrollView, RefreshControl, ActivityIndicator, TextInput } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, spacing } from "@/theme/tokens"
import { Text, Button, Card } from "@/components/primitives"
import { useAuth } from "@/hooks/useAuth"
import { useMyList, type MyListEntry } from "@/hooks/useMyList"

const STATUSES = (isManga: boolean) => [
  { id: "watching", label: isManga ? "Reading" : "Watching" },
  { id: "completed", label: "Completed" },
  { id: "plan_to_watch", label: isManga ? "Plan to Read" : "Plan to Watch" },
  { id: "on_hold", label: "On Hold" },
  { id: "dropped", label: "Dropped" },
  { id: "rewatching", label: isManga ? "Rereading" : "Rewatching" },
]

type SavedFilterId = "airing" | "backlog" | "favorites" | "comfort"

const SAVED_FILTERS: { id: SavedFilterId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "airing", label: "Airing Today", icon: "flash" },
  { id: "backlog", label: "Backlog", icon: "time" },
  { id: "favorites", label: "Favorites", icon: "heart" },
  { id: "comfort", label: "Comfort Shows", icon: "moon" },
]

const DAY_MS = 24 * 60 * 60 * 1000

const matchesSavedFilter = (entry: MyListEntry, filter: SavedFilterId | null): boolean => {
  if (!filter) return true
  switch (filter) {
    case "airing":
      return Boolean(entry.nextAiring && entry.nextAiring.airingAt * 1000 - Date.now() < DAY_MS)
    case "backlog":
      return entry.total != null && entry.progress < entry.total
    case "favorites":
      return entry.score >= 8
    case "comfort":
      return entry.status === "rewatching" || (entry.status === "completed" && entry.score >= 9)
    default:
      return true
  }
}

/** "Ep 1,169 airs in 2 days" pill copy for currently-airing anime. */
function formatAiring(next: { episode: number; airingAt: number }, isManga: boolean): string {
  const unit = isManga ? "Ch" : "Ep"
  const diff = next.airingAt * 1000 - Date.now()
  if (diff <= 0) return `${unit} ${next.episode} airing now`
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return `${unit} ${next.episode} airs in ${Math.max(1, Math.floor(diff / 60000))}m`
  if (hours < 24) return `${unit} ${next.episode} airs today`
  const days = Math.round(hours / 24)
  return `${unit} ${next.episode} airs in ${days} day${days === 1 ? "" : "s"}`
}

/** Round 44px glass bubble button (kit chrome). */
function GlassBubble({
  icon,
  on = false,
  onPress,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap
  on?: boolean
  onPress?: () => void
  label: string
}) {
  const { tokens } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: on ? `${tokens.primary}66` : `${tokens.border}80`,
        backgroundColor: on ? `${tokens.primary}29` : `${tokens.card}B3`,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Ionicons name={icon} size={19} color={on ? tokens.primary : tokens.foreground} />
    </Pressable>
  )
}

function EntryRow({
  entry,
  isManga,
  onPlusOne,
}: {
  entry: MyListEntry
  isManga: boolean
  onPlusOne: (entry: MyListEntry) => void
}) {
  const { tokens } = useTheme()
  const router = useRouter()
  const unit = isManga ? "Chapter" : "Episode"
  const isPlanned = entry.status === "plan_to_watch"
  const canIncrement = ["watching", "rewatching", "on_hold", "plan_to_watch"].includes(entry.status)
  const pct = entry.total ? Math.min(entry.progress / entry.total, 1) : 0

  return (
    <Pressable
      onPress={() => router.push(`/anime/${entry.mediaId}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
    >
      <Card glass="subtle" style={{ flexDirection: "row", padding: 12, gap: 14, alignItems: "center" }}>
        <Image
          source={{ uri: entry.cover }}
          style={{ width: 64, height: 85, borderRadius: 12, backgroundColor: tokens.card }}
          contentFit="cover"
          transition={150}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" weight="semibold" numberOfLines={2} style={{ color: tokens.foreground, lineHeight: 19 }}>
            {entry.title}
          </Text>
          <Text size="xs" muted style={{ marginTop: 3, marginBottom: 8 }}>
            {isPlanned
              ? entry.total
                ? `${entry.total.toLocaleString()} ${isManga ? "chapters" : "episodes"}`
                : "Not started"
              : `${unit} ${entry.progress.toLocaleString()} of ${entry.total ? entry.total.toLocaleString() : "?"}`}
            {entry.score ? `  ·  ★ ${entry.score}` : ""}
          </Text>
          {!isPlanned && entry.total ? (
            <View style={{ height: 6, borderRadius: 3, backgroundColor: `${tokens.border}99`, overflow: "hidden" }}>
              <LinearGradient
                colors={[tokens.primary, tokens.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: `${Math.round(pct * 100)}%`, height: "100%", borderRadius: 3 }}
              />
            </View>
          ) : null}
          {entry.nextAiring && !isPlanned ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                alignSelf: "flex-start",
                marginTop: 8,
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: radii.full,
                backgroundColor: `${tokens.success}1F`,
                borderWidth: 1,
                borderColor: `${tokens.success}40`,
              }}
            >
              <Ionicons name="flash" size={11} color={tokens.success} />
              <Text size="xs" weight="semibold" style={{ color: tokens.success, fontSize: 11 }}>
                {formatAiring(entry.nextAiring, isManga)}
              </Text>
            </View>
          ) : null}
        </View>
        {canIncrement ? (
          <Pressable
            accessibilityLabel={`Log ${unit.toLowerCase()} ${entry.progress + 1}`}
            onPress={(event) => {
              event.stopPropagation?.()
              onPlusOne(entry)
            }}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: `${tokens.border}80`,
              backgroundColor: pressed ? `${tokens.primary}29` : `${tokens.card}B3`,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <Ionicons name="add" size={19} color={tokens.foreground} />
          </Pressable>
        ) : null}
      </Card>
    </Pressable>
  )
}

/**
 * Kit list screen: kana header with glass bubbles, expanding inline search,
 * solid status pills with counts, saved-filter chips, gradient progress rows.
 */
export function MediaListScreen({ mediaType }: { mediaType: "ANIME" | "MANGA" }) {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { entries, loading, refreshing, refresh, plusOne } = useMyList()
  const [active, setActive] = useState("watching")
  const [savedFilter, setSavedFilter] = useState<SavedFilterId | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")

  const isManga = mediaType === "MANGA"
  const states = STATUSES(isManga)

  const typed = useMemo(
    () => entries.filter((entry) => (entry.mediaType || "ANIME") === mediaType),
    [entries, mediaType],
  )
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const entry of typed) map[entry.status] = (map[entry.status] || 0) + 1
    return map
  }, [typed])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return typed.filter(
      (entry) =>
        entry.status === active &&
        matchesSavedFilter(entry, savedFilter) &&
        (!q || entry.title.toLowerCase().includes(q)),
    )
  }, [typed, active, savedFilter, query])

  const activeState = states.find((s) => s.id === active) ?? states[0]

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 130 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        user ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={tokens.primary} /> : undefined
      }
    >
      {/* Kit header: kana + big title + glass bubbles */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text jp style={{ fontSize: 11, letterSpacing: 4, color: `${tokens.primary}B3`, marginBottom: 4 }}>
            {isManga ? "マンガ" : "アニメ"}
          </Text>
          <Text size="3xl" weight="black" style={{ color: tokens.foreground, letterSpacing: -0.5 }}>
            {isManga ? "Manga" : "Anime"}
          </Text>
        </View>
        <GlassBubble icon="search" label="Search" on={searchOpen} onPress={() => setSearchOpen((v) => !v)} />
        {!isManga ? (
          <GlassBubble icon="calendar-outline" label="Airing schedule" onPress={() => router.push("/calendar")} />
        ) : null}
      </View>

      {searchOpen ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 2,
              borderWidth: 1,
              borderColor: `${tokens.border}80`,
              backgroundColor: `${tokens.card}B3`,
            }}
          >
            <Ionicons name="search" size={16} color={tokens.mutedForeground} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={isManga ? "Search your manga..." : "Search your anime..."}
              placeholderTextColor={tokens.mutedForeground}
              style={{ flex: 1, color: tokens.foreground, fontSize: 15, paddingVertical: 10 }}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={tokens.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Status pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
        style={{ marginTop: 6 }}
      >
        {states.map((s) => {
          const on = active === s.id
          const count = counts[s.id] || 0
          return (
            <Pressable
              key={s.id}
              onPress={() => setActive(s.id)}
              style={({ pressed }) => ({
                paddingHorizontal: 15,
                paddingVertical: 9,
                borderRadius: radii.full,
                borderWidth: 1,
                borderColor: on ? "transparent" : `${tokens.border}8C`,
                backgroundColor: on ? tokens.primary : `${tokens.card}A6`,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                size="sm"
                weight="semibold"
                style={{ color: on ? tokens.primaryForeground : tokens.mutedForeground, fontSize: 13 }}
              >
                {s.label}
                {on ? ` · ${count}` : ""}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Saved filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20, alignItems: "center" }}
        style={{ marginTop: 10 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons name="sparkles" size={12} color={tokens.accent} />
          <Text size="xs" weight="bold" style={{ color: tokens.mutedForeground, letterSpacing: 1, fontSize: 11 }}>
            SAVED
          </Text>
        </View>
        {SAVED_FILTERS.map((f) => {
          const on = savedFilter === f.id
          return (
            <Pressable
              key={f.id}
              onPress={() => setSavedFilter(on ? null : f.id)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: radii.full,
                borderWidth: 1,
                borderColor: on ? `${tokens.accent}73` : `${tokens.border}80`,
                backgroundColor: on ? `${tokens.accent}24` : "transparent",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name={f.icon} size={13} color={on ? tokens.accent : tokens.mutedForeground} />
              <Text size="xs" weight="medium" style={{ color: on ? tokens.accent : tokens.mutedForeground, fontSize: 12 }}>
                {f.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Rows */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
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
              Track your progress, synced with your Hikari account everywhere.
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
            <Ionicons name="telescope-outline" size={28} color={tokens.mutedForeground} />
            <Text size="sm" muted style={{ textAlign: "center" }}>
              {savedFilter || query
                ? "Nothing matches those filters."
                : `Nothing in ${activeState.label} yet.`}
            </Text>
          </Card>
        ) : (
          visible.map((entry) => (
            <EntryRow key={entry.id} entry={entry} isManga={isManga} onPlusOne={plusOne} />
          ))
        )}
      </View>
    </ScrollView>
  )
}
