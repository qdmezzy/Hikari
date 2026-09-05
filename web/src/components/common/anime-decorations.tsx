"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Small SVG marks used as accents beside display type.
 *
 * This file used to also export GlowOrb / FloatingDecorations / AnimeDecorations —
 * blurred colour orbs and drifting sparkle fields scattered behind page content.
 * They were ambient decoration with no relationship to anything on the page, and
 * they're one of the clearest tells of a generated layout. Removed rather than
 * restyled: the archive system gets its atmosphere from structure, not from
 * floating shapes.
 */

export function Sparkle({
  className,
  size = 16,
  delay = 0,
  style,
}: {
  className?: string
  size?: number
  delay?: number
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("animate-sparkle text-primary/60", className)}
      style={{ animationDelay: `${delay}s`, ...style }}
      aria-hidden="true"
    >
      <path
        d="M12 2L13.09 8.26L19 7L14.14 11.14L19 17L13.09 15.74L12 22L10.91 15.74L5 17L9.86 11.14L5 7L10.91 8.26L12 2Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function StarBurst({
  className,
  size = 24,
}: {
  className?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("text-accent/50", className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path
        d="M12 2V6M12 18V22M2 12H6M18 12H22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
