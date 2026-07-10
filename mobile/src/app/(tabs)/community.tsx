import React, { useMemo, useState } from "react"
import { View, Pressable, FlatList, RefreshControl, ActivityIndicator } from "react-native"
import { Image } from "expo-image"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import * as Haptics from "expo-haptics"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, spacing } from "@/theme/tokens"
import { Text, Button, Card } from "@/components/primitives"
import { useAuth } from "@/hooks/useAuth"
import { useCommunityFeed, type FeedPost } from "@/hooks/useCommunityFeed"
import { timeAgo } from "@/lib/social"

type Filter = "everyone" | "following"

function Avatar({ url, name, size = 40 }: { url: string | null; name: string | null; size?: number }) {
  const { tokens } = useTheme()
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tokens.card }}
        contentFit="cover"
        transition={100}
      />
    )
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${tokens.accent}26`,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: `${tokens.accent}44`,
      }}
    >
      <Text size="sm" weight="bold" style={{ color: tokens.accent }}>
        {(name || "U").slice(0, 1).toUpperCase()}
      </Text>
    </View>
  )
}

function ActivityRow({ post, onLike }: { post: FeedPost; onLike: (post: FeedPost) => void }) {
  const { tokens } = useTheme()
  const router = useRouter()
  const isActivity = post.post_type === "activity"
  const displayName = post.user_display_name || "User"

  return (
    <Pressable
      onPress={() => {
        if (post.attached_media_id) router.push(`/anime/${post.attached_media_id}`)
      }}
      style={({ pressed }) => ({ opacity: pressed && post.attached_media_id ? 0.9 : 1 })}
    >
      <Card glass="subtle" style={{ flexDirection: "row", padding: spacing[3], gap: spacing[3] }}>
        <Avatar url={post.user_avatar_url} name={displayName} />
        <View style={{ flex: 1, gap: 4 }}>
          {isActivity ? (
            <Text size="sm" style={{ color: tokens.foreground, lineHeight: 20 }}>
              <Text size="sm" weight="bold" style={{ color: tokens.foreground }}>
                {displayName}
              </Text>{" "}
              <Text size="sm" style={{ color: tokens.mutedForeground }}>
                {post.content.charAt(0).toLowerCase() + post.content.slice(1)}
              </Text>
              {post.attached_media_title ? (
                <Text size="sm" weight="bold" style={{ color: tokens.foreground }}>
                  {" of "}
                  {post.attached_media_title}
                </Text>
              ) : null}
            </Text>
          ) : (
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text size="sm" weight="bold" style={{ color: tokens.foreground }}>
                  {displayName}
                </Text>
                {post.user_handle ? (
                  <Text size="xs" muted>
                    {post.user_handle}
                  </Text>
                ) : null}
              </View>
              <Text size="sm" style={{ color: tokens.foreground, lineHeight: 20 }} numberOfLines={6}>
                {post.content}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="time-outline" size={12} color={tokens.mutedForeground} />
              <Text size="xs" muted>
                {timeAgo(post.created_at)}
              </Text>
            </View>
            <Pressable
              onPress={(event) => {
                event.stopPropagation?.()
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                onLike(post)
              }}
              hitSlop={10}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons
                name={post.is_liked ? "heart" : "heart-outline"}
                size={14}
                color={post.is_liked ? "#f87171" : tokens.mutedForeground}
              />
              {post.like_count ? (
                <Text size="xs" weight="medium" style={{ color: post.is_liked ? "#f87171" : tokens.mutedForeground }}>
                  {post.like_count}
                </Text>
              ) : null}
            </Pressable>
            {post.comment_count ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="chatbubble-outline" size={13} color={tokens.mutedForeground} />
                <Text size="xs" muted>
                  {post.comment_count}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {post.mediaCover ? (
          <Image
            source={{ uri: post.mediaCover }}
            style={{ width: 48, height: 68, borderRadius: radii.md, backgroundColor: tokens.card }}
            contentFit="cover"
            transition={150}
          />
        ) : null}
      </Card>
    </Pressable>
  )
}

export default function CommunityScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { posts, followingSet, loading, refreshing, error, refresh, like } = useCommunityFeed()
  const [filter, setFilter] = useState<Filter>("everyone")

  const visible = useMemo(() => {
    if (filter === "following") {
      return posts.filter((post) => followingSet.has(String(post.user_id)) || post.user_id === user?.id)
    }
    return posts
  }, [posts, filter, followingSet, user])

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "everyone", label: "Everyone" },
    { id: "following", label: "Following" },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: spacing[5],
          paddingBottom: 120,
          gap: spacing[3],
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={tokens.primary} />}
        ListHeaderComponent={
          <View style={{ gap: spacing[4], marginBottom: spacing[2] }}>
            <View>
              <Text jp size="xs" style={{ color: tokens.primary, letterSpacing: 3, marginBottom: 2 }}>
                コミュニティ
              </Text>
              <Text size="3xl" weight="black" style={{ color: tokens.foreground }}>
                Community
              </Text>
              <Text size="sm" muted>
                What everyone&apos;s watching and reading
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              {FILTERS.map((f) => {
                const isActive = filter === f.id
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setFilter(f.id)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: radii.full,
                      borderWidth: 1,
                      borderColor: isActive ? `${tokens.accent}66` : tokens.border,
                      backgroundColor: isActive ? `${tokens.accent}1A` : tokens.card,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text
                      size="sm"
                      weight={isActive ? "semibold" : "medium"}
                      style={{ color: isActive ? tokens.accent : tokens.foreground }}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading || authLoading ? (
            <View style={{ paddingVertical: spacing[12], alignItems: "center" }}>
              <ActivityIndicator color={tokens.primary} size="large" />
            </View>
          ) : error ? (
            <Card glass="subtle" style={{ padding: spacing[8], alignItems: "center", gap: 12 }}>
              <Ionicons name="cloud-offline-outline" size={32} color={tokens.mutedForeground} />
              <Text size="sm" muted style={{ textAlign: "center" }}>
                {error}
              </Text>
              <Button variant="outline" size="sm" onPress={refresh}>
                Try again
              </Button>
            </Card>
          ) : filter === "following" && !user ? (
            <Card glass="subtle" style={{ padding: spacing[8], alignItems: "center", gap: 14 }}>
              <Ionicons name="people-outline" size={32} color={tokens.mutedForeground} />
              <Text size="sm" muted style={{ textAlign: "center", maxWidth: 260 }}>
                Sign in to see updates from people you follow.
              </Text>
              <Button variant="gradient" onPress={() => router.push("/login")}>
                Sign in
              </Button>
            </Card>
          ) : (
            <Card glass="subtle" style={{ padding: spacing[8], alignItems: "center", gap: 10 }}>
              <Ionicons name="chatbubbles-outline" size={28} color={tokens.mutedForeground} />
              <Text size="sm" muted style={{ textAlign: "center", maxWidth: 260 }}>
                {filter === "following"
                  ? "No activity from people you follow yet."
                  : "No activity yet. Updates from the community will show up here."}
              </Text>
            </Card>
          )
        }
        renderItem={({ item }) => <ActivityRow post={item} onLike={like} />}
      />
    </View>
  )
}
