import React from "react"
import { View } from "react-native"
import Svg, { Path } from "react-native-svg"
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated"
import { useTheme } from "@/theme/ThemeProvider"

const AnimatedPath = Animated.createAnimatedComponent(Path)

/**
 * Four-point sparkle — mirrors the web's `Sparkle` component from
 * `src/components/common/anime-decorations.tsx`. The web version uses CSS
 * keyframes; here we drive the same opacity/scale/rotation with Reanimated.
 */
export function Sparkle({
  size = 24,
  color,
  delay = 0,
}: {
  size?: number
  color?: string
  delay?: number
}) {
  const { tokens } = useTheme()
  const fill = color ?? tokens.sparkle

  const progress = useSharedValue(0)

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      progress.value = withRepeat(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      )
    }, delay * 1000)
    return () => clearTimeout(timeout)
  }, [delay, progress])

  // Sparkle path — a four-pointed star.
  const d = "M12 0 C13 6 18 11 24 12 C18 13 13 18 12 24 C11 18 6 13 0 12 C6 11 11 6 12 0 Z"

  const animatedProps = useAnimatedProps(() => {
    const p = progress.value
    return {
      opacity: 0.2 + p * 0.8,
      transform: [{ scale: 0.7 + p * 0.45 }, { rotate: `${p * 25}deg` }],
    } as any
  })

  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <AnimatedPath
          d={d}
          fill={fill}
          animatedProps={animatedProps}
          transform={`translate(${size / 2}, ${size / 2}) scale(${size / 24}) translate(${-12}, ${-12})`}
        />
      </Svg>
    </View>
  )
}

/**
 * Burst star — mirrors the web's `StarBurst`. A simple multi-point star used
 * as a floating accent near featured cards.
 */
export function StarBurst({
  size = 32,
  color,
}: {
  size?: number
  color?: string
}) {
  const { tokens } = useTheme()
  const fill = color ?? tokens.primary

  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Path
          d="M16 2 L19 13 L30 16 L19 19 L16 30 L13 19 L2 16 L13 13 Z"
          fill={fill}
        />
      </Svg>
    </View>
  )
}

/**
 * Radial brand glow — mirrors web's `.brand-glow`. A soft blurred radial used
 * behind hero content and featured cards.
 */
export function BrandGlow({
  size = 320,
  opacity = 0.5,
}: {
  size?: number
  opacity?: number
}) {
  const { tokens } = useTheme()
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        opacity,
        backgroundColor: tokens.primary,
        // RN doesn't blur easily; approximate the radial with an overly large
        // soft shadow + low opacity. Works well behind content.
        shadowColor: tokens.accent,
        shadowOpacity: 0.4,
        shadowRadius: size / 2,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  )
}
