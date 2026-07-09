import React from "react"
import { Text as RNText, type TextProps as RNTextProps } from "react-native"
import { useTheme } from "@/theme/ThemeProvider"
import { fontSizes, fontWeights } from "@/theme/tokens"

export type TextProps = RNTextProps & {
  size?: keyof typeof fontSizes
  weight?: keyof typeof fontWeights
  /** Use the Japanese accent typeface (Noto Sans JP) — matches web's `font-jp`. */
  jp?: boolean
  /** Gradient brand text — rendered as solid primary color on native. */
  brand?: boolean
  muted?: boolean
}

/**
 * Maps a logical weight to the actual loaded font family file. React Native
 * doesn't reliably synthesize weights for custom fonts, so we register each
 * weight as its own family in _layout.tsx and pick by name here.
 */
function familyFor(weight: keyof typeof fontWeights, jp: boolean): string {
  if (jp) {
    return weight === "bold" || weight === "black" ? "NotoSansJPBold" : "NotoSansJP"
  }
  switch (weight) {
    case "black":
      return "GeistBlack"
    case "bold":
      return "GeistBold"
    case "semibold":
      return "GeistSemiBold"
    case "medium":
      return "GeistMedium"
    default:
      return "Geist"
  }
}

export function Text({
  size = "base",
  weight = "regular",
  jp = false,
  brand = false,
  muted = false,
  style,
  ...rest
}: TextProps) {
  const { tokens } = useTheme()

  const fontFamily = familyFor(weight, jp)
  const color = brand ? tokens.primary : muted ? tokens.mutedForeground : tokens.foreground

  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily,
          fontSize: fontSizes[size],
          fontWeight: fontWeights[weight],
          color,
        },
        style,
      ]}
    />
  )
}
