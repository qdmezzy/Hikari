import React, { useEffect, useState } from "react"
import { View, Pressable, Dimensions } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
} from "react-native-reanimated"

// expo-image's Image doesn't ship reanimated props; wrap it for entering
// animations while keeping contentFit/recyclingKey support.
const AnimatedImage = Animated.createAnimatedComponent(Image)
import * as Haptics from "expo-haptics"
import { useRouter } from "expo-router"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, spacing, fontSizes } from "@/theme/tokens"
import { Text } from "../primitives/Text"
import { Button, Badge } from "../primitives"
import { BrandGlow, Sparkle } from "../primitives/Decorations"
import { formatCompactNumber } from "@/lib/utils"
import type { FeaturedAnime } from "@/hooks/useHomeData"

const SCREEN = Dimensions.get("window").width
const HERO_HEIGHT = 480
const ROTATION_MS = 8000

export function FeaturedHero({
  items,
  loading,
}: {
  items: FeaturedAnime[]
  loading: boolean
}) {
  const { tokens } = useTheme()
  const router = useRouter()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (items.length <= 1) return
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length)
    }, ROTATION_MS)
    return () => clearInterval(interval)
  }, [items.length])

  const current = items[index]

  if (loading || !current) {
    return (
      <View style={{ height: HERO_HEIGHT, backgroundColor: tokens.card, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }} />
    )
  }

  return (
    <View style={{ height: HERO_HEIGHT, overflow: "hidden" }}>
      {/* Rotating banner image */}
      <AnimatedImage
        key={current.id}
        source={{ uri: current.banner || current.cover || "" }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: SCREEN, height: HERO_HEIGHT }}
        contentFit="cover"
        entering={FadeIn.duration(800)}
        recyclingKey={String(current.id)}
      />

      {/* Gradient scrims — mirrors web's three layered gradients. */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.2)", `${tokens.background}E6`]}
        locations={[0, 0.4, 0.85]}
        style={{ position: "absolute", inset: 0 }}
      />
      <LinearGradient
        colors={[`${tokens.background}99`, "transparent", "transparent"]}
        locations={[0, 0.25, 0.5]}
        style={{ position: "absolute", inset: 0 }}
      />

      <BrandGlow size={260} opacity={0.18} />

      {/* Content */}
      <Animated.View
        key={`content-${current.id}`}
        entering={FadeIn.delay(120).duration(500)}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 24,
          paddingHorizontal: spacing[5],
        }}
      >
        {/* Badges row */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <Badge variant="primary">
            <Ionicons name="flame" size={11} color={tokens.primary} /> Trending
          </Badge>
          {current.rating ? (
            <Badge variant="default">
              <Ionicons name="star" size={11} color="#fbbf24" /> {current.rating}
            </Badge>
          ) : null}
          {current.studio ? (
            <Badge variant="outline">{current.studio}</Badge>
          ) : null}
        </View>

        {/* Title */}
        <Text
          size="5xl"
          weight="black"
          style={{ color: tokens.primary, marginBottom: 10, lineHeight: 44 }}
          numberOfLines={2}
        >
          {current.heroTitle || current.title}
        </Text>

        {/* Genres */}
        {current.genres?.length ? (
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {current.genres.slice(0, 3).map((g) => (
              <View
                key={g}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: radii.full,
                  borderWidth: 1,
                  borderColor: `${tokens.border}88`,
                  backgroundColor: `${tokens.card}66`,
                }}
              >
                <Text size="xs" style={{ color: tokens.foreground }}>{g}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Description */}
        <Text
          size="sm"
          muted
          numberOfLines={2}
          style={{ marginBottom: 14, lineHeight: 20 }}
        >
          {current.heroDescription || current.description}
        </Text>

        {/* CTAs */}
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Button
            variant="gradient"
            size="lg"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
              router.push(`/anime/${current.id}`)
            }}
          >
            <Ionicons name="add" size={18} color="#fff" /> Add to List
          </Button>
          <Button
            variant="outline"
            size="lg"
            onPress={() => router.push(`/anime/${current.id}`)}
          >
            <Ionicons name="eye" size={18} color={tokens.foreground} /> Details
          </Button>
        </View>
      </Animated.View>

      {/* Pagination dots — mirrors web's progress-bar indicators. */}
      <View style={{ position: "absolute", bottom: 8, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 8 }}>
        {items.slice(0, 5).map((_, i) => (
          <View
            key={i}
            style={{
              height: 6,
              borderRadius: 3,
              width: i === index ? 28 : 14,
              backgroundColor: i === index ? tokens.primary : "rgba(255,255,255,0.3)",
            }}
          />
        ))}
      </View>

      {/* Vertical kana flourish — mirrors web's writing-vertical ヒカリ. */}
      <View style={{ position: "absolute", right: 12, top: 80, opacity: 0.12 }}>
        <Text jp size="6xl" weight="black" style={{ color: tokens.primary, transform: [{ rotate: "90deg" }] }}>
          ヒカリ
        </Text>
      </View>
    </View>
  )
}
