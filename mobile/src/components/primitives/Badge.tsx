import React from "react"
import { View, type ViewStyle } from "react-native"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, fontSizes, fontWeights } from "@/theme/tokens"
import { Text } from "./Text"

type Variant = "default" | "primary" | "accent" | "success" | "warning" | "destructive" | "outline"

export interface BadgeProps {
  variant?: Variant
  children: React.ReactNode
  style?: ViewStyle
  size?: "sm" | "default"
}

export function Badge({ variant = "default", children, style, size = "default" }: BadgeProps) {
  const { tokens } = useTheme()

  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    default: { bg: tokens.muted, fg: tokens.mutedForeground },
    primary: { bg: withAlpha(tokens.primary, 0.18), fg: tokens.primary, border: withAlpha(tokens.primary, 0.3) },
    accent: { bg: withAlpha(tokens.accent, 0.18), fg: tokens.accent, border: withAlpha(tokens.accent, 0.3) },
    success: { bg: withAlpha(tokens.success, 0.15), fg: tokens.success, border: withAlpha(tokens.success, 0.3) },
    warning: { bg: withAlpha(tokens.warning, 0.15), fg: tokens.warning, border: withAlpha(tokens.warning, 0.3) },
    destructive: { bg: withAlpha(tokens.destructive, 0.18), fg: tokens.destructive, border: withAlpha(tokens.destructive, 0.3) },
    outline: { bg: "transparent", fg: tokens.foreground, border: tokens.border },
  }

  const colors = palette[variant]
  const paddingV = size === "sm" ? 2 : 4
  const paddingH = size === "sm" ? 6 : 8

  return (
    <View
      style={[
        {
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border ?? "transparent",
          borderRadius: radii.full,
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      <Text size={size === "sm" ? "xs" : "sm"} weight="semibold" style={{ color: colors.fg }}>
        {children}
      </Text>
    </View>
  )
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(clamp(alpha, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0")
  return `${hex}${a}`
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}
