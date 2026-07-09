import React from "react"
import { View, Pressable } from "react-native"
import { Image } from "expo-image"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import * as Haptics from "expo-haptics"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, fontSizes } from "@/theme/tokens"
import { Text } from "../primitives/Text"
import { formatCompactNumber } from "@/lib/utils"

export interface AnimeCardItem {
  id: number | string
  title: string
  /** Cover image URL — uses AniList extraLarge/large. */
  cover: string
  rating?: number | null
  episodes?: number | null
  chapters?: number | null
  type?: "anime" | "manga"
  status?: string
  year?: number | null
  studio?: string
  watchLabel?: string
  popularity?: number | null
}

export function AnimeCard({
  anime,
  width = 150,
  index = 0,
  onPress,
}: {
  anime: AnimeCardItem
  width?: number
  index?: number
  onPress?: (anime: AnimeCardItem) => void
}) {
  const { tokens } = useTheme()
  const router = useRouter()
  const height = width * 4 / 3 // aspect-[3/4]

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    onPress?.(anime)
    router.push(`/anime/${anime.id}`)
  }

  const episodeCount = anime.episodes || anime.chapters
  const ratingLabel = anime.rating ? Number(anime.rating).toFixed(1) : null

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        width,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View
        style={{
          borderRadius: radii["2xl"],
          overflow: "hidden",
          backgroundColor: tokens.secondary,
          borderWidth: 1,
          borderColor: tokens.border,
        }}
      >
        <View style={{ width, height }}>
          <Image
            source={anime.cover}
            style={{ width, height }}
            contentFit="cover"
            transition={200}
            recyclingKey={String(anime.id)}
          />

          {/* Top row: episode count + rating — mirrors web AnimeCard badges. */}
          <View
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              right: 8,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(21,22,58,0.75)",
                borderRadius: radii.full,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text size="xs" weight="medium" style={{ color: tokens.background }}>
                {episodeCount
                  ? `${episodeCount} ${anime.type === "manga" ? "ch" : "eps"}`
                  : anime.status || "Anime"}
              </Text>
            </View>

            {ratingLabel ? (
              <View
                style={{
                  backgroundColor: "rgba(251,247,234,0.92)",
                  borderRadius: radii.full,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <Ionicons name="star" size={10} color="#b08451" />
                <Text size="xs" weight="semibold" style={{ color: tokens.foreground }}>
                  {ratingLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Title + meta below cover. */}
      <View style={{ paddingTop: 8, gap: 2 }}>
        <Text
          size="sm"
          weight="semibold"
          numberOfLines={1}
          style={{ color: tokens.foreground }}
        >
          {anime.title}
        </Text>
        {anime.studio || anime.year ? (
          <Text size="xs" muted numberOfLines={1}>
            {[anime.year, anime.studio].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}
