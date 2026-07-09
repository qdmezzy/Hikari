import React from "react"
import { View, type ViewProps } from "react-native"
import { BlurView } from "expo-blur"
import { LinearGradient } from "expo-linear-gradient"
import { useTheme } from "@/theme/ThemeProvider"
import { radii } from "@/theme/tokens"

type GlassStrength = "subtle" | "default" | "strong"

export interface CardProps extends ViewProps {
  /** Glassmorphism — mirrors web's `.glass-card` / `.glass-strong` / `.glass-subtle`. */
  glass?: boolean | GlassStrength
  /** Elevated card — mirrors web's `.card-elevated`. */
  elevated?: boolean
  /** Gradient border sweep — mirrors web's `.gradient-border`. */
  gradientBorder?: boolean
  radius?: keyof typeof radii
}

export function Card({
  glass = false,
  elevated = false,
  gradientBorder = false,
  radius = "2xl",
  style,
  children,
  ...rest
}: CardProps) {
  const { tokens, isDark } = useTheme()
  const strength: GlassStrength = glass === true ? "default" : glass === false ? "default" : glass
  const containerRadius = radii[radius]

  // Solid (non-glass) card — web's `bg-card/80 border border-border/60`.
  if (!glass) {
    return (
      <View
        {...rest}
        style={[
          {
            backgroundColor: tokens.card,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: containerRadius,
            ...(elevated
              ? {
                  shadowColor: "#000",
                  shadowOpacity: isDark ? 0.3 : 0.08,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 4,
                }
              : {}),
          },
          style,
        ]}
      >
        {gradientBorder ? <GradientBorder radius={containerRadius} /> : null}
        {children}
      </View>
    )
  }

  // Glass card — BlurView + translucent tint + hairline border.
  const tintIntensity = strength === "strong" ? 0.9 : strength === "subtle" ? 0.6 : 0.75

  return (
    <View
      {...rest}
      style={[
        {
          borderRadius: containerRadius,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: tokens.border,
          ...(elevated
            ? {
                shadowColor: "#000",
                shadowOpacity: isDark ? 0.25 : 0.1,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 12 },
                elevation: 6,
              }
            : {}),
        },
        style,
      ]}
    >
      <BlurView
        intensity={strength === "strong" ? 60 : strength === "subtle" ? 20 : 40}
        tint={isDark ? "dark" : "light"}
        style={{
          backgroundColor: isDark
            ? `rgba(29, 30, 72, ${tintIntensity})`
            : `rgba(254, 251, 240, ${tintIntensity})`,
          flex: 1,
        }}
      >
        {gradientBorder ? <GradientBorder radius={containerRadius} /> : null}
        {children}
      </BlurView>
    </View>
  )
}

/** Animated gradient hairline border — mirrors web `.gradient-border::before`. */
function GradientBorder({ radius }: { radius: number }) {
  const { tokens } = useTheme()
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={[tokens.primary, tokens.accent, tokens.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", inset: 0, borderWidth: 1, borderColor: "transparent" }}
      />
    </View>
  )
}
