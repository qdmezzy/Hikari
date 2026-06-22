'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { applyAccentColor, loadAccentColor } from '@/lib/accent'
import { applyAppearance, loadAppearance } from '@/lib/appearance'

export function ThemeProvider({ children, ...props }) {
  // Apply saved appearance prefs (accent, reduce-motion, high-contrast) as
  // early as possible on the client so they persist across reloads and pages.
  React.useEffect(() => {
    applyAccentColor(loadAccentColor())
    applyAppearance(loadAppearance())
  }, [])

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
