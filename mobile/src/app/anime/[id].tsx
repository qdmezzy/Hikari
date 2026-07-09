import React, { useEffect, useState } from "react"
import { View, Pressable, ScrollView, Dimensions, ActivityIndicator } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, spacing } from "@/theme/tokens"
import { Text, Button, Badge, Card } from "@/components/primitives"
import { Sparkle, BrandGlow } from "@/components/primitives/Decorations"
import {
  fetchAniList,
  MEDIA_DETAILS_QUERY,
  getMediaTitle,
  getPrimaryStudio,
  formatAniListStatus,
  getPreferredStreamingLink,
  sanitizeDescription,
  type AniListMedia,
} from "@/lib/anilist"
import { formatCompactNumber, formatRelativeTime } from "@/lib/utils"

const SCREEN = Dimensions.get("window").width

export default function AnimeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { tokens } = useTheme()
  const [media, setMedia] = useState<AniListMedia | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchAniList<{ Media: AniListMedia }>(MEDIA_DETAILS_QUERY, { id: Number(id) })
      .then((data) => {
        if (active) setMedia(data?.Media ?? null)
      })
      .catch((e) => active && setError(e?.message || "Could not load."))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [id])

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={tokens.primary} size="large" />
      </View>
    )
  }

  if (error || !media) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.background, alignItems: "center", justifyContent: "center", padding: spacing[8], gap: 12 }}>
        <Ionicons name="sad-outline" size={48} color={tokens.mutedForeground} />
        <Text size="lg" weight="semibold" style={{ color: tokens.foreground }}>{error || "Not found"}</Text>
        <Button variant="outline" onPress={() => router.back()}>Go back</Button>
      </View>
    )
  }

  const title = getMediaTitle(media)
  const banner = media.bannerImage || media.coverImage?.extraLarge || media.coverImage?.large || ""
  const cover = media.coverImage?.extraLarge || media.coverImage?.large || ""
  const rating = media.averageScore ? Number((media.averageScore / 10).toFixed(1)) : null
  const studio = getPrimaryStudio(media)
  const streaming = getPreferredStreamingLink(media)
  const description = sanitizeDescription(media.description)
  const nextEp = media.nextAiringEpisode

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      {/* Banner header. */}
      <View style={{ height: 360, position: "relative" }}>
        <Image source={banner} style={{ position: "absolute", inset: 0 }} contentFit="cover" />
        <LinearGradient
          colors={["rgba(0,0,0,0.4)", "transparent", tokens.background]}
          locations={[0, 0.4, 1]}
          style={{ position: "absolute", inset: 0 }}
        />

        {/* Back button. */}
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.back() }}
          style={{
            position: "absolute",
            top: insets.top + 4,
            left: spacing[4],
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>

        {/* Cover + title overlap. */}
        <View style={{ position: "absolute", bottom: 16, left: 0, right: 0, flexDirection: "row", paddingHorizontal: spacing[5], gap: 14, alignItems: "flex-end" }}>
          <View style={{ width: 100, height: 140, borderRadius: radii.lg, overflow: "hidden", borderWidth: 1, borderColor: tokens.border }}>
            <Image source={cover} style={{ width: 100, height: 140 }} contentFit="cover" />
          </View>
          <View style={{ flex: 1, paddingBottom: 4, gap: 6 }}>
            {media.seasonYear ? (
              <Text jp size="xs" style={{ color: tokens.primary, letterSpacing: 2 }}>
                {media.season} {media.seasonYear}
              </Text>
            ) : null}
            <Text size="2xl" weight="black" style={{ color: "#fff", lineHeight: 28 }} numberOfLines={3}>
              {title}
            </Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {rating ? <Badge variant="default"><Ionicons name="star" size={10} color="#fbbf24" /> {rating}</Badge> : null}
              {media.status ? <Badge variant="outline">{formatAniListStatus(media.status)}</Badge> : null}
              {media.episodes ? <Badge variant="outline">{media.episodes} eps</Badge> : null}
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: 120, gap: spacing[5] }}
      >
        {/* CTAs — Add to list + Watch. */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button variant="gradient" size="lg" style={{ flex: 1 }} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})}>
            <Ionicons name="add" size={18} color="#fff" /> Add to List
          </Button>
          {streaming ? (
            <Button variant="outline" size="lg" style={{ flex: 1 }} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})}>
              <Ionicons name="play" size={18} color={tokens.foreground} /> {streaming.site}
            </Button>
          ) : null}
        </View>

        {/* Meta row. */}
        <View style={{ flexDirection: "row", gap: 20, flexWrap: "wrap" }}>
          <Stat icon="people" label="Popularity" value={formatCompactNumber(media.popularity)} />
          <Stat icon="heart" label="Favorites" value={formatCompactNumber(media.favourites)} />
          {media.duration ? <Stat icon="time" label="Per ep" value={`${media.duration}m`} /> : null}
          {studio ? <Stat icon="business" label="Studio" value={studio} /> : null}
        </View>

        {/* Next episode alert. */}
        {nextEp ? (
          <Card glass="subtle" style={{ padding: spacing[4], flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${tokens.success}22`, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="notifications" size={20} color={tokens.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text size="sm" weight="semibold" style={{ color: tokens.foreground }}>
                Episode {nextEp.episode} airs {formatRelativeTime(new Date(nextEp.airingAt * 1000))}
              </Text>
              <Text size="xs" muted>Get notified when it drops.</Text>
            </View>
          </Card>
        ) : null}

        {/* Genres. */}
        {media.genres?.length ? (
          <View style={{ gap: 10 }}>
            <Text size="sm" weight="semibold" jp style={{ color: tokens.primary, letterSpacing: 2 }}>ジャンル · Genres</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {media.genres.map((g) => (
                <Badge key={g} variant="primary">{g}</Badge>
              ))}
            </View>
          </View>
        ) : null}

        {/* Synopsis. */}
        <View style={{ gap: 10 }}>
          <Text size="sm" weight="semibold" jp style={{ color: tokens.primary, letterSpacing: 2 }}>あらすじ · Synopsis</Text>
          <Text size="base" style={{ color: tokens.foreground, lineHeight: 24 }}>
            {description || "No synopsis available."}
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

function Stat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { tokens } = useTheme()
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name={icon} size={13} color={tokens.mutedForeground} />
        <Text size="xs" muted>{label}</Text>
      </View>
      <Text size="sm" weight="semibold" style={{ color: tokens.foreground }}>{value}</Text>
    </View>
  )
}
