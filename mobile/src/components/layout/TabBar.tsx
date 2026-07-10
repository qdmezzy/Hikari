import React, { useEffect, useState } from "react"
import { View, Pressable, Platform } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Haptics from "expo-haptics"
import { type Href, usePathname, useRouter } from "expo-router"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"
import { useTheme } from "@/theme/ThemeProvider"
import { Text } from "../primitives/Text"

type TabKey = "index" | "manga" | "discover" | "community" | "profile"

interface TabDef {
  key: TabKey
  href: Href
  label: string
  kana: string
  icon: keyof typeof Ionicons.glyphMap
  iconActive: keyof typeof Ionicons.glyphMap
}

const TABS: TabDef[] = [
  { key: "index", href: "/", label: "Anime", kana: "アニメ", icon: "tv-outline", iconActive: "tv" },
  { key: "manga", href: "/manga", label: "Manga", kana: "漫画", icon: "book-outline", iconActive: "book" },
  { key: "discover", href: "/discover", label: "Discover", kana: "発見", icon: "sparkles-outline", iconActive: "sparkles" },
  { key: "community", href: "/community", label: "Feed", kana: "交流", icon: "people-outline", iconActive: "people" },
  { key: "profile", href: "/profile", label: "Profile", kana: "プロフ", icon: "person-outline", iconActive: "person" },
]

const SPRING = { damping: 16, stiffness: 180, mass: 0.6 }
const BUBBLE_INSET = 5

/**
 * Floating "liquid glass" tab bar: a detached blurred pill with a glass
 * bubble that springs between tabs — and can be dragged like Apple's
 * Liquid Glass bar. Releasing the drag snaps to (and opens) the nearest tab.
 */
export function TabBar() {
  const { tokens, isDark } = useTheme()
  const pathname = usePathname()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [barWidth, setBarWidth] = useState(0)

  const activeIndex = Math.max(
    TABS.findIndex((t) => (t.key === "index" ? pathname === "/" : pathname.startsWith(t.href as string))),
    0,
  )

  const tabWidth = barWidth > 0 ? barWidth / TABS.length : 0
  const bubbleX = useSharedValue(0)
  const dragStartX = useSharedValue(0)
  const dragging = useSharedValue(false)

  useEffect(() => {
    if (tabWidth > 0) {
      bubbleX.value = withSpring(activeIndex * tabWidth, SPRING)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, tabWidth])

  const goToIndex = (index: number) => {
    const tab = TABS[index]
    if (!tab) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    router.push(tab.href)
  }

  const pan = Gesture.Pan()
    .onStart(() => {
      dragStartX.value = bubbleX.value
      dragging.value = true
    })
    .onUpdate((event) => {
      const max = Math.max(barWidth - tabWidth, 0)
      const next = dragStartX.value + event.translationX
      bubbleX.value = Math.min(Math.max(next, 0), max)
    })
    .onEnd(() => {
      dragging.value = false
      const index = Math.min(Math.max(Math.round(bubbleX.value / Math.max(tabWidth, 1)), 0), TABS.length - 1)
      bubbleX.value = withSpring(index * tabWidth, SPRING)
      runOnJS(goToIndex)(index)
    })

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bubbleX.value }, { scale: withSpring(dragging.value ? 1.08 : 1, SPRING) }],
  }))

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: Math.max(insets.bottom, 12) + 4,
        left: 16,
        right: 16,
        alignItems: "center",
      }}
    >
      <View
        style={{
          borderRadius: 32,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)",
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 12,
          width: "100%",
        }}
      >
        <GestureDetector gesture={pan}>
          <BlurView
            intensity={Platform.OS === "ios" ? 70 : 100}
            tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"}
            style={{
              backgroundColor: isDark ? "rgba(15,17,51,0.35)" : "rgba(251,247,234,0.35)",
            }}
          >
            <View
              onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
              style={{ flexDirection: "row", paddingVertical: 8 }}
            >
              {tabWidth > 0 ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: "absolute",
                      top: BUBBLE_INSET,
                      bottom: BUBBLE_INSET,
                      left: BUBBLE_INSET,
                      width: tabWidth - BUBBLE_INSET * 2,
                      borderRadius: 24,
                      backgroundColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.07)",
                      borderWidth: 1,
                      borderColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.06)",
                    },
                    bubbleStyle,
                  ]}
                />
              ) : null}
              {TABS.map((tab, index) => {
                const active = activeIndex === index
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => {
                      if (!active) goToIndex(index)
                    }}
                    style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 4 }}
                  >
                    <Ionicons
                      name={active ? tab.iconActive : tab.icon}
                      size={22}
                      color={active ? tokens.primary : tokens.mutedForeground}
                    />
                    <Text
                      size="xs"
                      weight={active ? "semibold" : "medium"}
                      style={{ color: active ? tokens.primary : tokens.mutedForeground, fontSize: 10 }}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </BlurView>
        </GestureDetector>
      </View>
    </View>
  )
}
