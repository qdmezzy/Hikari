import React from "react"
import { View, Pressable, ScrollView, RefreshControl, ActivityIndicator, Dimensions } from "react-native"
import { Image } from "expo-image"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, spacing } from "@/theme/tokens"
import { Text, Button, Card } from "@/components/primitives"
import { useAuth } from "@/hooks/useAuth"
import { useProfileStats } from "@/hooks/useProfileStats"
import { buildUserProfile } from "@/lib/social"

const SCREEN = Dimensions.get("window").width
const FAV_CARD_W = (SCREEN - spacing[5] * 2 - spacing[3] * 2) / 3

function StatCell({ label, value }: { label: string; value: string | number }) {
  const { tokens } = useTheme()
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text size="xs" muted style={{ letterSpacing: 1, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text size="xl" weight="black" style={{ color: tokens.foreground }}>
        {value}
      </Text>
    </View>
  )
}

export default function ProfileScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { stats, follows, favorites, loading, favoritesLoading, refreshing, refresh } = useProfileStats()

  if (!user && !authLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.background,
          paddingTop: insets.top + 8,
          paddingHorizontal: spacing[5],
          justifyContent: "center",
        }}
      >
        <Card glass="subtle" style={{ padding: spacing[8], alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: `${tokens.primary}1A`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="person" size={34} color={tokens.primary} />
          </View>
          <Text size="lg" weight="semibold" style={{ color: tokens.foreground, textAlign: "center" }}>
            Your Hikari profile
          </Text>
          <Text size="sm" muted style={{ textAlign: "center", maxWidth: 260 }}>
            Sign in to see your stats, favorites, and followers.
          </Text>
          <Button variant="gradient" onPress={() => router.push("/login")}>
            Sign in
          </Button>
        </Card>
      </View>
    )
  }

  const profile = buildUserProfile(user)

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={tokens.primary} />}
    >
      {/* Header — name centered, settings on the right (mirrors the reference). */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ width: 40 }} />
        <Text size="xl" weight="bold" style={{ color: tokens.foreground }} numberOfLines={1}>
          {profile.displayName}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push("/settings")}
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
          <Ionicons name="settings-outline" size={18} color={tokens.foreground} />
        </Pressable>
      </View>

      {/* Stats block — avatar + numbers grid, like the reference profile header. */}
      <Card glass="subtle" style={{ padding: spacing[4], flexDirection: "row", gap: spacing[4] }}>
        {profile.avatarUrl ? (
          <Image
            source={{ uri: profile.avatarUrl }}
            style={{ width: 88, height: 118, borderRadius: radii.lg, backgroundColor: tokens.card }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View
            style={{
              width: 88,
              height: 118,
              borderRadius: radii.lg,
              backgroundColor: `${tokens.accent}22`,
              borderWidth: 1,
              borderColor: `${tokens.accent}44`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text size="3xl" weight="black" style={{ color: tokens.accent }}>
              {profile.avatarInitial}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: spacing[3] }}>
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <StatCell label="Total Anime" value={stats.totalAnime} />
            <StatCell label="Total Manga" value={stats.totalManga} />
          </View>
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <StatCell label="Days Watched" value={stats.daysWatched} />
            <StatCell label="Chapters Read" value={stats.chaptersRead} />
          </View>
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <StatCell label="Followers" value={follows.followers} />
            <StatCell label="Following" value={follows.following || "-"} />
          </View>
        </View>
      </Card>

      {/* Handle + mean score row. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text size="sm" muted>
          {profile.handle}
        </Text>
        {stats.meanScore ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="star" size={13} color="#fbbf24" />
            <Text size="sm" weight="semibold" style={{ color: tokens.foreground }}>
              {stats.meanScore} mean score
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ height: 1, backgroundColor: tokens.border }} />

      {/* Favorites. */}
      <View style={{ gap: spacing[3] }}>
        <Text size="xs" weight="semibold" muted style={{ letterSpacing: 2, textTransform: "uppercase" }}>
          Favorites
        </Text>
        {loading || favoritesLoading ? (
          <View style={{ paddingVertical: spacing[6], alignItems: "center" }}>
            <ActivityIndicator color={tokens.primary} />
          </View>
        ) : favorites.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
            {favorites.map((fav) => (
              <Pressable
                key={fav.id}
                onPress={() => router.push(`/anime/${fav.id}`)}
                style={({ pressed }) => ({ width: FAV_CARD_W, gap: 6, opacity: pressed ? 0.9 : 1 })}
              >
                <Image
                  source={{ uri: fav.cover }}
                  style={{
                    width: FAV_CARD_W,
                    height: FAV_CARD_W * 1.45,
                    borderRadius: radii.lg,
                    backgroundColor: tokens.card,
                  }}
                  contentFit="cover"
                  transition={150}
                />
                <Text size="xs" weight="medium" numberOfLines={2} style={{ color: tokens.foreground }}>
                  {fav.title}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Card glass="subtle" style={{ padding: spacing[6], alignItems: "center", gap: 8 }}>
            <Ionicons name="heart-outline" size={24} color={tokens.mutedForeground} />
            <Text size="sm" muted style={{ textAlign: "center", maxWidth: 260 }}>
              No favorites yet. Add favorites on the web app and they&apos;ll show here.
            </Text>
          </Card>
        )}
      </View>
    </ScrollView>
  )
}
