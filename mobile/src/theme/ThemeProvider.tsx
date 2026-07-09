import React, { createContext, useContext, useMemo, useState } from "react"
import { useColorScheme } from "react-native"
import { dark, light, type ThemeTokens } from "./tokens"

type Mode = "light" | "dark"

interface ThemeContextValue {
  tokens: ThemeTokens
  mode: Mode
  isDark: boolean
  toggle: () => void
  setMode: (mode: Mode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({
  children,
  defaultMode = "dark",
}: {
  children: React.ReactNode
  defaultMode?: Mode
}) {
  // The web app defaults to dark (defaultTheme="dark"); we keep the same
  // behaviour but still respect the system preference when no override is set.
  const system = useColorScheme() as Mode | null
  const [override, setOverride] = useState<Mode | null>(null)

  const mode: Mode = override ?? defaultMode ?? system ?? "dark"
  const isDark = mode === "dark"

  const value = useMemo<ThemeContextValue>(
    () => ({
      tokens: isDark ? dark : light,
      mode,
      isDark,
      toggle: () => setOverride((prev) => (prev ?? mode === "dark" ? "light" : "dark")),
      setMode: (next) => setOverride(next),
    }),
    [isDark, mode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useTheme must be used within <ThemeProvider>")
  }
  return ctx
}
