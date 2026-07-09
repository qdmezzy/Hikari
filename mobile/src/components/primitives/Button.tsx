import React from "react"
import {
  Pressable,
  type PressableProps,
  ActivityIndicator,
  View,
  type ViewStyle,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import * as Haptics from "expo-haptics"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, fontSizes, fontWeights, DURATIONS } from "@/theme/tokens"
import { Text } from "./Text"
import { cn } from "@/lib/utils"

type Variant = "default" | "gradient" | "outline" | "ghost" | "secondary" | "destructive"
type Size = "sm" | "default" | "lg" | "icon" | "icon-sm"

export interface ButtonProps extends Omit<PressableProps, "children"> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children?: React.ReactNode
  /** Light haptic on press — matches the "btn-press" feel from the web. */
  haptic?: boolean
}

const HEIGHTS: Record<Size, number> = {
  sm: 32,
  default: 40,
  lg: 48,
  icon: 40,
  "icon-sm": 32,
}

const PAD_X: Record<Size, number> = {
  sm: 12,
  default: 16,
  lg: 24,
  icon: 0,
  "icon-sm": 0,
}

export function Button({
  variant = "default",
  size = "default",
  loading = false,
  haptic = true,
  disabled,
  onPress,
  style,
  children,
  ...rest
}: ButtonProps) {
  const { tokens } = useTheme()
  const isIcon = size === "icon" || size === "icon-sm"
  const height = HEIGHTS[size]
  const padX = PAD_X[size]

  const handlePress: PressableProps["onPress"] = (e) => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }
    onPress?.(e)
  }

  // Resolve colors per variant (mirrors web button.tsx cva variants).
  const contentColor =
    variant === "default"
      ? tokens.primaryForeground
      : variant === "gradient"
        ? "#ffffff"
        : variant === "outline"
          ? tokens.foreground
          : variant === "secondary"
            ? tokens.secondaryForeground
            : variant === "destructive"
              ? tokens.destructiveForeground
              : tokens.foreground

  const containerStyle: ViewStyle = {
    height,
    paddingHorizontal: padX,
    borderRadius: radii.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    opacity: disabled ? 0.5 : 1,
  }

  const renderChildren = () => {
    if (loading) {
      return <ActivityIndicator color={contentColor} size="small" />
    }
    if (isIcon) {
      return children
    }
    // Wrap strings in <Text> for convenience; pass through nodes otherwise.
    if (typeof children === "string" || typeof children === "number") {
      return (
        <Text size="sm" weight="semibold" style={{ color: contentColor }}>
          {children}
        </Text>
      )
    }
    return children
  }

  const inner = (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      onPress={handlePress}
      android_ripple={{ color: "rgba(255,255,255,0.08)", radius: 24, borderless: false }}
      style={({ pressed }) => ({
        ...containerStyle,
        ...(pressed ? { transform: [{ scale: 0.96 }] } : {}),
        ...(style as object),
      })}
    >
      {renderChildren()}
    </Pressable>
  )

  // Gradient variant — mirrors web's `bg-gradient-to-r from-primary to-accent`.
  if (variant === "gradient") {
    return (
      <View style={[containerStyle, style as ViewStyle, { overflow: "hidden" }]}>
        <LinearGradient
          colors={[tokens.primary, tokens.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <Pressable
          {...rest}
          disabled={disabled || loading}
          onPress={handlePress}
          style={({ pressed }) => ({
            ...containerStyle,
            backgroundColor: "transparent",
            ...(pressed ? { transform: [{ scale: 0.96 }] } : {}),
          })}
        >
          {renderChildren()}
        </Pressable>
      </View>
    )
  }

  // Solid / outlined / ghost backgrounds.
  if (variant === "outline") {
    containerStyle.borderWidth = 1
    containerStyle.borderColor = tokens.border
    containerStyle.backgroundColor = tokens.background
  } else if (variant === "secondary") {
    containerStyle.backgroundColor = tokens.secondary
  } else if (variant === "destructive") {
    containerStyle.backgroundColor = tokens.destructive
  } else if (variant === "ghost") {
    containerStyle.backgroundColor = "transparent"
  } else {
    containerStyle.backgroundColor = tokens.primary
  }

  return inner
}
