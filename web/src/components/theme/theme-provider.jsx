'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { applyAccentColor, loadAccentColor } from '@/lib/accent'

export function ThemeProvider({ children, ...props }) {
  // Apply the saved accent color as early as possible on the client so the
  // user's choice persists across reloads and every page.
  React.useEffect(() => {
    applyAccentColor(loadAccentColor())
  }, [])

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
