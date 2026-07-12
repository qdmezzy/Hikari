import React, { useEffect, useState } from "react"
import { View, Pressable, Platform } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Haptics from "expo-haptics"
import { type Href, usePathname, useRouter } from "expo-router"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import { useTheme } from "@/theme/ThemeProvider"
import { Text } from "../primitives/Text"

type TabKey = "index" | "manga" | "discover" | "community" | "profile"

interface TabDef {
  key: TabKey
  href: Href
  label: string
  icon: keyof typeof Ionicons.glyphMap
  iconActive: keyof typeof Ionicons.glyphMap
}

// Kit order: Discover is the raised center action.
const TABS: TabDef[] = [
  { key: "index", href: "/", label: "Anime", icon: "tv-outline", iconActive: "tv" },
  { key: "manga", href: "/manga", label: "Manga", icon: "book-outline", iconActive: "book" },
  { key: "discover", href: "/discover", label: "Discover", icon: "sparkles-outline", iconActive: "sparkles" },
  { key: "community", href: "/community", label: "Feed", icon: "people-outline", iconActive: "people" },
  { key: "profile", href: "/profile", label: "Profile", icon: "person-outline", iconActive: "person" },
]

const CENTER_INDEX = 2
const SPRING = { damping: 16, stiffness: 180, mass: 0.6 }
const BUBBLE_INSET = 5

/**
 * Kit chrome: floating glass pill with Discover raised in the center as a
 * gradient orb (glow + sparkle when active). The glass bubble behind the flat
 * tabs springs between them and can be dragged; releasing snaps to the
 * nearest tab and opens it (dropping on the center opens Discover).
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
  const discoverActive = activeIndex === CENTER_INDEX

  const tabWidth = barWidth > 0 ? barWidth / TABS.length : 0
  const bubbleX = useSharedValue(0)
  const bubbleOpacity = useSharedValue(1)
  const dragStartX = useSharedValue(0)
  const dragging = useSharedValue(false)

  useEffect(() => {
    if (tabWidth > 0) {
      bubbleX.value = withSpring(activeIndex * tabWidth, SPRING)
    }
    // The center tab shows its own gradient orb instead of the bubble.
    bubbleOpacity.value = withTiming(discoverActive ? 0 : 1, { duration: 160 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, tabWidth, discoverActive])

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
      bubbleOpacity.value = withTiming(1, { duration: 120 })
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
    opacity: bubbleOpacity.value,
    transform: [{ translateX: bubbleX.value }, { scale: withSpring(dragging.value ? 1.08 : 1, SPRING) }],
  }))

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: Math.max(insets.bottom, 12),
        left: 12,
        right: 12,
        alignItems: "center",
      }}
    >
      <View
        style={{
          borderRadius: 28,
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)",
          shadowColor: "#000",
          shadowOpacity: 0.45,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 14 },
          elevation: 12,
          width: "100%",
        }}
      >
        <GestureDetector gesture={pan}>
          <BlurView
            intensity={Platform.OS === "ios" ? 70 : 100}
            tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"}
            style={{
              borderRadius: 28,
              overflow: "hidden",
              backgroundColor: isDark ? "rgba(15,17,51,0.35)" : "rgba(251,247,234,0.35)",
            }}
          >
            <View
              onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
              style={{ flexDirection: "row", alignItems: "flex-end", paddingTop: 8, paddingBottom: 6 }}
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
                      borderRadius: 22,
                      backgroundColor: isDark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.07)",
                      borderWidth: 1,
                      borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)",
                    },
                    bubbleStyle,
                  ]}
                />
              ) : null}
              {TABS.map((tab, index) => {
                const active = activeIndex === index
                const isCenter = index === CENTER_INDEX
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => {
                      if (!active) goToIndex(index)
                    }}
                    style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3, minHeight: 48 }}
                  >
                    {isCenter ? (
                      // Spacer — the raised gradient orb renders as an overlay
                      // outside the blur so it isn't clipped by overflow:hidden.
                      <View style={{ height: 30 }} />
                    ) : (
                      <View style={{ height: 30, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons
                          name={active ? tab.iconActive : tab.icon}
                          size={20}
                          color={active ? tokens.primary : tokens.mutedForeground}
                        />
                      </View>
                    )}
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

        {/* Raised Discover orb — floats above the pill like the kit. */}
        <Pressable
          onPress={() => {
            if (!discoverActive) goToIndex(CENTER_INDEX)
          }}
          style={{
            position: "absolute",
            top: -18,
            left: "50%",
            marginLeft: -23,
            width: 46,
            height: 46,
            borderRadius: 23,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            borderWidth: 1,
            borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.08)",
            backgroundColor: tokens.card,
            shadowColor: discoverActive ? tokens.primary : "#000",
            shadowOpacity: discoverActive ? 0.7 : 0.4,
            shadowRadius: discoverActive ? 14 : 10,
            shadowOffset: { width: 0, height: discoverActive ? 0 : 8 },
            elevation: 10,
          }}
        >
          {discoverActive ? (
            <LinearGradient
              colors={[tokens.primary, tokens.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />
          ) : null}
          <Ionicons
            name={discoverActive ? "sparkles" : "sparkles-outline"}
            size={22}
            color={discoverActive ? tokens.primaryForeground : tokens.mutedForeground}
          />
        </Pressable>
      </View>
    </View>
  )
}
