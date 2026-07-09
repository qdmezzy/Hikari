import React from "react"
import { ScrollView, View, Dimensions } from "react-native"
import { useTheme } from "@/theme/ThemeProvider"
import { spacing } from "@/theme/tokens"
import { AnimeCard, type AnimeCardItem } from "./AnimeCard"

const SCREEN = Dimensions.get("window").width

export function CardRail({
  items,
  cardWidth = Math.min(150, (SCREEN - 64) / 2.4),
}: {
  items: AnimeCardItem[]
  cardWidth?: number
}) {
  const { tokens } = useTheme()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing[4], gap: spacing[4], paddingRight: spacing[6] }}
    >
      {items.map((item, i) => (
        <AnimeCard key={item.id} anime={item} width={cardWidth} index={i} />
      ))}
    </ScrollView>
  )
}

export function CardRailSkeleton({ count = 4, cardWidth = 150 }: { count?: number; cardWidth?: number }) {
  const { tokens } = useTheme()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing[4], gap: spacing[4] }}
      scrollEnabled={false}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: cardWidth,
            height: cardWidth * 4 / 3,
            borderRadius: 20,
            backgroundColor: tokens.muted,
          }}
        />
      ))}
    </ScrollView>
  )
}
