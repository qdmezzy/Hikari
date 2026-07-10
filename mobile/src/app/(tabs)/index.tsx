import React from "react"
import { View, Pressable, Dimensions } from "react-native"
import { Image } from "expo-image"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/theme/ThemeProvider"
import { spacing, radii } from "@/theme/tokens"
import { useHomeData } from "@/hooks/useHomeData"
import { FeaturedHero } from "@/components/home/FeaturedHero"
import { ContinueWatching } from "@/components/home/ContinueWatching"
import { SectionHeader } from "@/components/media/SectionHeader"
import { CardRail, CardRailSkeleton } from "@/components/media/CardRail"
import { Text, Button, Badge } from "@/components/primitives"

const SCREEN = Dimensions.get("window").width

export default function HomeScreen() {
  const { tokens } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { featured, trending, seasonal, loading, error, reload } = useHomeData()

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      {/* Header — compact top bar with wordmark + search icon. */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingTop: insets.top,
          paddingHorizontal: spacing[5],
          paddingBottom: spacing[3],
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text size="3xl" weight="black" brand>
            Hikari
          </Text>
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: `${tokens.primary}55`,
              backgroundColor: `${tokens.primary}1A`,
            }}
          >
            <Text size="xs" weight="bold" style={{ color: tokens.primary, letterSpacing: 1 }}>
              BETA
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push("/search")}
          hitSlop={12}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: radii.lg,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="search" size={22} color={tokens.foreground} />
        </Pressable>
      </View>

      {/* Scroll content with bottom padding for tab bar. */}
      <View style={{ flex: 1, marginTop: insets.top + 0, paddingBottom: 100 }}>
        <FeaturedHero items={featured} loading={loading} />

        {/* Search bar — mirrors web's prominent search field. */}
        <View style={{ paddingHorizontal: spacing[5], marginTop: -28, zIndex: 5 }}>
          <Pressable
            onPress={() => router.push("/search")}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: tokens.card,
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: radii["2xl"],
                paddingHorizontal: 18,
                paddingVertical: 16,
                shadowColor: "#000",
                shadowOpacity: 0.3,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 10 },
                elevation: 8,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <Ionicons name="search" size={20} color={tokens.primary} />
            <Text size="base" muted>
              Search anime, manga, characters...
            </Text>
          </Pressable>
        </View>

        {error ? (
          <View style={{ paddingHorizontal: spacing[5], marginTop: spacing[5] }}>
            <Text size="sm" style={{ color: tokens.destructive }}>{error}</Text>
            <Button variant="outline" size="sm" onPress={reload} style={{ marginTop: 8 }}>
              Try again
            </Button>
          </View>
        ) : null}

        {/* Continue Watching — real data via useContinueWatching. */}
        <Section
          kana="視聴中"
          title="Continue Watching"
          subtitle="Pick up where you left off"
          onSeeAll={() => router.push("/lists")}
        >
          <ContinueWatching />
        </Section>

        {/* Trending Now */}
        <Section
          kana="人気急上昇"
          title="Trending Now"
          subtitle="What fans are watching"
          accentColor="#fb923c"
          onSeeAll={() => router.push("/search")}
        >
          {loading ? (
            <CardRailSkeleton />
          ) : (
            <CardRail items={trending} />
          )}
        </Section>

        {/* Airing Schedule */}
        <Section
          kana="放送予定"
          title="Airing Schedule"
          subtitle="Upcoming this season"
          accentColor="#a78bfa"
          onSeeAll={() => router.push("/calendar")}
        >
          {loading ? (
            <CardRailSkeleton cardWidth={260} count={3} />
          ) : (
            <AiringRail items={seasonal} />
          )}
        </Section>

        {/* Discord CTA — mirrors web's home promo card. */}
        <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[6], paddingBottom: spacing[8] }}>
          <DiscordCard />
        </View>
      </View>
    </View>
  )
}

function Section({
  kana,
  title,
  subtitle,
  accentColor,
  onSeeAll,
  children,
}: {
  kana: string
  title: string
  subtitle: string
  accentColor?: string
  onSeeAll?: () => void
  children: React.ReactNode
}) {
  return (
    <View style={{ marginTop: spacing[8] }}>
      <View style={{ paddingHorizontal: spacing[5], marginBottom: spacing[4] }}>
        <SectionHeader
          kana={kana}
          title={title}
          subtitle={subtitle}
          accentColor={accentColor}
          onSeeAll={onSeeAll}
        />
      </View>
      {children}
    </View>
  )
}

function AiringRail({ items }: { items: any[] }) {
  const { tokens } = useTheme()
  const router = useRouter()

  if (!items.length) {
    return (
      <View style={{ paddingHorizontal: spacing[5] }}>
        <Text muted>No upcoming episodes right now.</Text>
      </View>
    )
  }

  return (
    <View style={{ paddingHorizontal: spacing[5], gap: spacing[3] }}>
      {items.slice(0, 4).map((item) => (
        <Pressable
          key={item.id}
          onPress={() => router.push(`/anime/${item.id}`)}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              backgroundColor: tokens.card,
              borderWidth: 1,
              borderColor: item.isToday ? `${tokens.success}55` : tokens.border,
              borderRadius: radii["2xl"],
              padding: 14,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <View style={{ width: 56, height: 80, borderRadius: radii.lg, overflow: "hidden", backgroundColor: tokens.secondary }}>
            <Image
              source={item.cover}
              style={{ width: 56, height: 80 }}
              contentFit="cover"
              recyclingKey={String(item.id)}
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text size="sm" weight="semibold" numberOfLines={1} style={{ color: tokens.foreground }}>
              {item.title}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              {item.isToday ? (
                <Badge variant="success">
                  <Ionicons name="flash" size={10} color={tokens.success} /> Today
                </Badge>
              ) : null}
              <Badge variant="primary">{item.day}</Badge>
              <Text size="xs" muted>
                <Ionicons name="time-outline" size={11} color={tokens.mutedForeground} /> {item.time}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={tokens.mutedForeground} />
        </Pressable>
      ))}
    </View>
  )
}

function DiscordCard() {
  const { tokens } = useTheme()
  return (
    <View
      style={{
        borderRadius: radii["2xl"],
        borderWidth: 1,
        borderColor: `${tokens.discord}40`,
        backgroundColor: `${tokens.discord}1A`,
        padding: spacing[5],
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.lg,
          backgroundColor: `${tokens.discord}26`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="logo-discord" size={24} color={tokens.discord} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text jp size="xs" style={{ color: tokens.discord, letterSpacing: 3 }}>コミュニティ</Text>
        <Text size="base" weight="bold" style={{ color: tokens.foreground }}>
          Join the Discord
        </Text>
        <Text size="sm" muted>Release alerts, talk anime, shape Hikari.</Text>
      </View>
      <Ionicons name="open-outline" size={18} color={tokens.discord} />
    </View>
  )
}
