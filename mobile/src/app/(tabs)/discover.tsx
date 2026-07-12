import React, { useRef, useState } from "react"
import { View, Pressable, Dimensions, FlatList } from "react-native"
import { WebView } from "react-native-webview"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, spacing, fontSizes } from "@/theme/tokens"
import { Text, Button, Badge } from "@/components/primitives"
import { Sparkle } from "@/components/primitives/Decorations"
import { useDiscoverFeed } from "@/hooks/useDiscoverFeed"
import { getMediaTitle } from "@/lib/anilist"
import { formatCompactNumber } from "@/lib/utils"

const SCREEN = Dimensions.get("window")
const FEED_HEIGHT = SCREEN.height

const VIBE_FILTERS = [
  { id: "all", label: "For You", icon: "sparkles" as const, color: ["#f4ecd2", "#e9d49b"] },
  { id: "hype", label: "Hype", icon: "flame" as const, color: ["#f97316", "#ef4444"] },
  { id: "action", label: "Action", icon: "flash" as const, color: ["#3b82f6", "#06b6d4"] },
  { id: "chill", label: "Chill", icon: "leaf" as const, color: ["#14b8a6", "#10b981"] },
  { id: "dark", label: "Dark", icon: "moon" as const, color: ["#64748b", "#334155"] },
  { id: "romance", label: "Romance", icon: "heart" as const, color: ["#ec4899", "#f43f5e"] },
]

export default function DiscoverScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [vibe, setVibe] = useState("all")
  const [liked, setLiked] = useState<Set<number>>(new Set())
  const [activeIndex, setActiveIndex] = useState(0)
  const { items, loading } = useDiscoverFeed(vibe)

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length) setActiveIndex(viewableItems[0].index ?? 0)
  })
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 })

  const toggleLike = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    setLiked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Vibe filter pills — mirrors web discover's vibeFilters row. */}
      <View
        style={{
          position: "absolute",
          top: insets.top,
          left: 0,
          right: 0,
          zIndex: 20,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
        }}
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          {VIBE_FILTERS.map((f) => {
            const active = vibe === f.id
            return (
              <Pressable
                key={f.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                  setVibe(f.id)
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: radii.full,
                  borderWidth: 1,
                  borderColor: active ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)",
                  backgroundColor: active ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.4)",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Ionicons
                  name={active ? f.icon : `${f.icon}-outline`}
                  size={13}
                  color={active ? "#fff" : "rgba(255,255,255,0.7)"}
                />
                <Text
                  size="xs"
                  weight={active ? "semibold" : "medium"}
                  style={{ color: active ? "#fff" : "rgba(255,255,255,0.7)" }}
                >
                  {f.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Vertical paging feed — TikTok-style. */}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <DiscoverCard
            item={item}
            isActive={index === activeIndex}
            isLiked={liked.has(item.id)}
            onLike={() => toggleLike(item.id)}
            onView={() => router.push(`/anime/${item.id}`)}
          />
        )}
        pagingEnabled
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        scrollEventThrottle={16}
      />
    </View>
  )
}

function DiscoverCard({
  item,
  isActive,
  isLiked,
  onLike,
  onView,
}: {
  item: any
  isActive: boolean
  isLiked: boolean
  onLike: () => void
  onView: () => void
}) {
  const { tokens } = useTheme()
  const title = getMediaTitle(item)
  const banner = item.bannerImage || item.coverImage?.extraLarge || item.coverImage?.large
  const trailerId = item?.trailer?.site?.toLowerCase() === "youtube" ? item.trailer.id : null
  // 16:9 video sized to COVER a portrait screen, centered horizontally.
  const videoWidth = Math.ceil((FEED_HEIGHT * 16) / 9)

  return (
    <View style={{ height: FEED_HEIGHT, width: SCREEN.width, position: "relative", overflow: "hidden", backgroundColor: "#000" }}>
      <Image
        source={banner}
        style={{ position: "absolute", inset: 0 }}
        contentFit="cover"
        recyclingKey={String(item.id)}
      />
      {isActive && trailerId ? (
        <WebView
          key={trailerId}
          source={{
            uri: `https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerId}&playsinline=1&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&fs=0`,
          }}
          style={{
            position: "absolute",
            top: 0,
            left: (SCREEN.width - videoWidth) / 2,
            width: videoWidth,
            height: FEED_HEIGHT,
            backgroundColor: "transparent",
          }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          scrollEnabled={false}
          pointerEvents="none"
        />
      ) : null}

      {/* Dark scrim for legibility. */}
      <LinearGradient
        colors={["rgba(0,0,0,0.3)", "transparent", "rgba(0,0,0,0.85)"]}
        locations={[0, 0.4, 0.9]}
        style={{ position: "absolute", inset: 0 }}
      />

      {/* Right action rail — like / share / info. */}
      <View
        style={{
          position: "absolute",
          right: 12,
          bottom: 140,
          gap: 22,
          alignItems: "center",
        }}
      >
        <ActionButton
          icon={isLiked ? "heart" : "heart-outline"}
          color={isLiked ? "#f43f5e" : "#fff"}
          label={formatCompactNumber((item.favourites ?? 0) / 100)}
          onPress={onLike}
        />
        <ActionButton
          icon="add-circle"
          color={tokens.primary}
          label="List"
          onPress={onView}
        />
        <ActionButton
          icon="share-outline"
          color="#fff"
          label="Share"
          onPress={onView}
        />
        <ActionButton
          icon="information-circle-outline"
          color="#fff"
          label="Details"
          onPress={onView}
        />
      </View>

      {/* Bottom info block. */}
      <View style={{ position: "absolute", left: 0, right: 70, bottom: 90, paddingHorizontal: spacing[5] }}>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
          {item.averageScore ? (
            <Badge variant="default">
              <Ionicons name="star" size={10} color="#fbbf24" /> {(item.averageScore / 10).toFixed(1)}
            </Badge>
          ) : null}
          {item.episodes ? <Badge variant="outline">{item.episodes} eps</Badge> : null}
          {item.vibes?.slice(0, 2).map((v: string) => (
            <Badge key={v} variant="primary" size="sm">{v}</Badge>
          ))}
        </View>

        <Text
          size="3xl"
          weight="black"
          numberOfLines={2}
          style={{ color: "#fff", marginBottom: 8, lineHeight: 34 }}
        >
          {title}
        </Text>

        {item.description ? (
          <Text size="sm" numberOfLines={3} style={{ color: "rgba(255,255,255,0.75)", lineHeight: 20 }}>
            {item.description.replace(/<[^>]+>/g, "").slice(0, 160)}
          </Text>
        ) : null}

        <Button variant="gradient" size="lg" onPress={onView} style={{ marginTop: 14, alignSelf: "flex-start" }}>
          <Ionicons name="play" size={18} color="#fff" /> Watch & Track
        </Button>
      </View>

      {/* Sparkle flourish. */}
      <Sparkle size={20} delay={0.3} />
    </View>
  )
}

function ActionButton({
  icon,
  color,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  color: string
  label: string
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", gap: 4 }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.35)",
        }}
      >
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text size="xs" weight="medium" style={{ color: "rgba(255,255,255,0.85)" }}>
        {label}
      </Text>
    </Pressable>
  )
}
