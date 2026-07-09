/**
 * Hikari mobile design tokens.
 *
 * These mirror the web app's `globals.css` oklch() values, converted to hex
 * for React Native (which doesn't support oklch). The dark theme is the
 * primary/default surface — matching the web app's `defaultTheme="dark"`.
 *
 * Web reference: web/src/app/globals.css
 */

// Convenience: each oklch below has the original web value in a comment so the
// two surfaces can be kept in sync if the web palette ever changes.

export interface ThemeTokens {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  border: string
  input: string
  ring: string
  glacier: string
  glacierDeep: string
  frost: string
  aurora: string
  crystal: string
  sparkle: string
  chart1: string
  chart2: string
  chart3: string
  chart4: string
  chart5: string
  success: string
  warning: string
  info: string
  discord: string
  glowPrimary: string
  glowAccent: string
}

export const dark: ThemeTokens = {
  // --background: oklch(0.16 0.05 278)
  background: "#15163a",
  // --foreground: oklch(0.95 0.014 95)
  foreground: "#f1f1ee",

  // --card: oklch(0.21 0.05 278)
  card: "#1d1e48",
  cardForeground: "#f1f1ee",

  // --popover: oklch(0.20 0.05 278)
  popover: "#191a40",
  popoverForeground: "#f1f1ee",

  // --primary: oklch(0.92 0.07 96)  — warm cream used for primary text/accents in dark
  primary: "#f4ecd2",
  // --primary-foreground: oklch(0.18 0.06 278)
  primaryForeground: "#161738",

  // --secondary: oklch(0.27 0.05 278)
  secondary: "#2a2b58",
  secondaryForeground: "#efefee",

  // --muted: oklch(0.24 0.04 278)
  muted: "#242553",
  // --muted-foreground: oklch(0.75 0.03 92)
  mutedForeground: "#c4bd9d",

  // --accent: oklch(0.88 0.10 92) — the warm gold accent
  accent: "#e9d49b",
  accentForeground: "#161738",

  // --destructive: oklch(0.55 0.19 25)
  destructive: "#c33d3d",
  destructiveForeground: "#f3e9e9",

  // --border: oklch(0.30 0.04 278)
  border: "#343563",
  // --input: oklch(0.27 0.04 278)
  input: "#2a2b58",
  // --ring: oklch(0.85 0.09 95)
  ring: "#ddc990",

  // Glacier / brand tokens ------------------------------------------------
  // --glacier: oklch(0.85 0.08 95)
  glacier: "#e2d29a",
  // --glacier-deep: oklch(0.66 0.12 86)
  glacierDeep: "#c9a85e",
  // --frost: oklch(0.21 0.05 278)
  frost: "#1d1e48",
  // --aurora: oklch(0.82 0.12 92)
  aurora: "#e3cd93",
  // --crystal: oklch(0.45 0.06 280)
  crystal: "#5b559e",
  // --sparkle: oklch(0.90 0.10 100)
  sparkle: "#ecd696",

  // Chart palette (web --chart-1..5)
  chart1: "#e2d29a",
  chart2: "#cab066",
  chart3: "#b08451",
  chart4: "#6b6494",
  chart5: "#8c6fa3",

  // Status / semantic extras (kept consistent with web usage)
  success: "#4ade80",
  warning: "#fbbf24",
  info: "#7dd3fc",
  discord: "#5865f2",

  // Glow rgba values — used by LinearGradient / shadow passes
  glowPrimary: "rgba(244, 236, 210, 0.35)",
  glowAccent: "rgba(233, 212, 155, 0.32)",
}

export const light: ThemeTokens = {
  // --background: oklch(0.985 0.015 95)
  background: "#fbf7ea",
  // --foreground: oklch(0.22 0.05 278)
  foreground: "#2b2a55",

  // --card: oklch(0.995 0.008 95)
  card: "#fefbf0",
  cardForeground: "#2b2a55",

  // --popover: oklch(0.995 0.008 95)
  popover: "#fefbf0",
  popoverForeground: "#2b2a55",

  // --primary: oklch(0.27 0.06 278)
  primary: "#2b2a55",
  primaryForeground: "#f4ecd2",

  // --secondary: oklch(0.95 0.02 95)
  secondary: "#f1ead2",
  secondaryForeground: "#2b2a55",

  // --muted: oklch(0.96 0.018 95)
  muted: "#f3ecd6",
  // --muted-foreground: oklch(0.46 0.04 278)
  mutedForeground: "#7a7398",

  // --accent: oklch(0.86 0.11 92)
  accent: "#dcc079",
  accentForeground: "#2b2a55",

  // --destructive: oklch(0.55 0.22 25)
  destructive: "#c4452f",
  destructiveForeground: "#fbf7ea",

  // --border: oklch(0.89 0.02 95)
  border: "#e3dcc4",
  // --input: oklch(0.93 0.018 95)
  input: "#efe9d3",
  // --ring: oklch(0.55 0.08 278)
  ring: "#5b559e",

  glacier: "#dfce99",
  glacierDeep: "#b9a04c",
  frost: "#f6efdd",
  aurora: "#dcc079",
  crystal: "#bcb4d6",
  sparkle: "#e3cc8c",

  chart1: "#dcc079",
  chart2: "#c9a85e",
  chart3: "#b08451",
  chart4: "#6b6494",
  chart5: "#8c6fa3",

  success: "#22c55e",
  warning: "#f59e0b",
  info: "#0ea5e9",
  discord: "#5865f2",

  glowPrimary: "rgba(43, 42, 85, 0.18)",
  glowAccent: "rgba(220, 192, 121, 0.30)",
}

// Radii mirror the web: --radius: 0.75rem, then sm/md/lg/xl derived.
export const radii = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  "2xl": 20,
  "3xl": 28,
  full: 9999,
} as const

// Spacing scale (8pt grid) — mobile-tuned.
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const

// Typography — Geist on web. We load Geist via expo-font; sizes mirror iOS
// dynamic type defaults but lean larger for the bold hero look the web has.
export const fontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
  "5xl": 44,
  "6xl": 54,
} as const

export const fontWeights = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  black: "900" as const,
}

// Web easing tokens (globals.css :root --ease-*) for Reanimated.
export const easing = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  outQuint: [0.22, 1, 0.36, 1] as const,
  spring: [0.34, 1.56, 0.64, 1] as const,
  springSoft: [0.25, 1, 0.5, 1] as const,
}

export const DURATIONS = {
  fast: 220,
  base: 320,
  slow: 500,
  hero: 800,
} as const
