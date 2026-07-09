import React, { useState, useCallback } from "react"
import { View, Pressable, FlatList, TextInput, ActivityIndicator, Dimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, spacing } from "@/theme/tokens"
import { Text, Button, Card } from "@/components/primitives"
import { AnimeCard, type AnimeCardItem } from "@/components/media/AnimeCard"
import { SectionHeader } from "@/components/media/SectionHeader"
import { CardRail } from "@/components/media/CardRail"
import { fetchAniList, SEARCH_QUERY, getMediaTitle, type AniListMedia } from "@/lib/anilist"

const SCREEN = Dimensions.get("window").width
const CARD_W = (SCREEN - 48) / 3

const QUICK_GENRES = ["Action", "Romance", "Comedy", "Fantasy", "Sci-Fi", "Horror", "Slice of Life", "Mystery"]

export default function SearchScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<AnimeCardItem[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setSearching(true)
    setSearched(true)
    try {
      const data = await fetchAniList<{ Page: { media: AniListMedia[] } }>(SEARCH_QUERY, {
        search: trimmed,
        page: 1,
        perPage: 24,
      })
      setResults(
        (data?.Page?.media ?? []).map((m) => ({
          id: m.id,
          title: getMediaTitle(m),
          cover: m?.coverImage?.extraLarge || m?.coverImage?.large || "",
          rating: m?.averageScore ? Number((m.averageScore / 10).toFixed(1)) : null,
          episodes: m?.episodes ?? null,
          year: m?.startDate?.year ?? null,
        })),
      )
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background, paddingTop: insets.top + 8 }}>
      {/* Search field. */}
      <View style={{ paddingHorizontal: spacing[5], marginBottom: spacing[4] }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: tokens.card,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: radii.xl,
            paddingHorizontal: 16,
            paddingVertical: 4,
          }}
        >
          <Ionicons name="search" size={20} color={tokens.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search anime..."
            placeholderTextColor={tokens.mutedForeground}
            returnKeyType="search"
            onSubmitEditing={() => runSearch(query)}
            style={{
              flex: 1,
              color: tokens.foreground,
              fontFamily: "Geist",
              fontSize: 16,
              paddingVertical: 12,
            }}
          />
          {query ? (
            <Pressable onPress={() => { setQuery(""); setResults([]); setSearched(false) }} hitSlop={12}>
              <Ionicons name="close-circle" size={18} color={tokens.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {!searched ? (
        <View style={{ paddingHorizontal: spacing[5], gap: spacing[6] }}>
          <View>
            <SectionHeader kana="探す" title="Browse by Genre" subtitle="Pick a vibe to explore" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing[4] }}>
              {QUICK_GENRES.map((g) => (
                <Pressable
                  key={g}
                  onPress={() => { setQuery(g); runSearch(g) }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: radii.lg,
                    borderWidth: 1,
                    borderColor: tokens.border,
                    backgroundColor: tokens.card,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text size="sm" weight="medium" style={{ color: tokens.foreground }}>{g}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {searching ? (
        <View style={{ paddingVertical: spacing[12], alignItems: "center" }}>
          <ActivityIndicator color={tokens.primary} size="large" />
        </View>
      ) : null}

      {!searching && searched ? (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          numColumns={3}
          contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: 120 }}
          columnWrapperStyle={{ gap: spacing[3], marginBottom: spacing[4] }}
          ListEmptyComponent={
            <View style={{ paddingVertical: spacing[12], alignItems: "center", gap: 8 }}>
              <Ionicons name="search-outline" size={48} color={tokens.mutedForeground} />
              <Text size="lg" weight="semibold" style={{ color: tokens.foreground }}>No results</Text>
              <Text muted>Try a different title or genre.</Text>
            </View>
          }
          renderItem={({ item }) => <AnimeCard anime={item} width={CARD_W} />}
        />
      ) : null}
    </View>
  )
}
