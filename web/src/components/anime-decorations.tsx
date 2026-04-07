"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Sparkle SVG component
export function Sparkle({ 
  className, 
  size = 16,
  delay = 0,
  style
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
    >
      <path
        d="M12 2L13.09 8.26L19 7L14.14 11.14L19 17L13.09 15.74L12 22L10.91 15.74L5 17L9.86 11.14L5 7L10.91 8.26L12 2Z"
        fill="currentColor"
      />
    </svg>
  )
}

// Crystal/Diamond SVG component
export function Crystal({ 
  className, 
  size = 20,
  variant = "default",
  style
}: { 
  className?: string
  size?: number
  variant?: "default" | "small" | "accent"
  style?: React.CSSProperties
}) {
  const colors = {
    default: "text-primary/40",
    small: "text-accent/50",
    accent: "text-sparkle/60"
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("animate-float", colors[variant], className)}
      style={style}
    >
      <path
        d="M12 2L4 10L12 22L20 10L12 2Z"
        fill="currentColor"
        fillOpacity="0.3"
      />
      <path
        d="M12 2L4 10L12 22L20 10L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4 10H20M12 2V22"
        stroke="currentColor"
        strokeWidth="0.75"
        strokeOpacity="0.5"
      />
    </svg>
  )
}

// Star burst decoration
export function StarBurst({ 
  className,
  size = 24 
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

// Seeded random number generator for deterministic values
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Floating decorations background
export function FloatingDecorations({ 
  className,
  density = "normal"
}: { 
  className?: string
  density?: "sparse" | "normal" | "dense"
}) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const counts = {
    sparse: { sparkles: 3, crystals: 2 },
    normal: { sparkles: 5, crystals: 3 },
    dense: { sparkles: 8, crystals: 5 }
  }

  const { sparkles, crystals } = counts[density]

  // Use deterministic positions based on index (seeded)
  const sparklePositions = React.useMemo(() => 
    Array.from({ length: sparkles }, (_, i) => ({
      id: i,
      left: `${10 + seededRandom(i * 100 + 1) * 80}%`,
      top: `${10 + seededRandom(i * 100 + 2) * 80}%`,
      size: 8 + seededRandom(i * 100 + 3) * 8,
      delay: seededRandom(i * 100 + 4) * 2
    })), [sparkles]
  )

  const crystalPositions = React.useMemo(() => 
    Array.from({ length: crystals }, (_, i) => ({
      id: i,
      left: `${5 + seededRandom(i * 200 + 1) * 90}%`,
      top: `${5 + seededRandom(i * 200 + 2) * 90}%`,
      size: 12 + seededRandom(i * 200 + 3) * 12,
      delay: seededRandom(i * 200 + 4) * 3
    })), [crystals]
  )

  // Don't render decorations until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div 
        className={cn(
          "absolute inset-0 overflow-hidden pointer-events-none",
          className
        )}
        aria-hidden="true"
      />
    )
  }

  return (
    <div 
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        className
      )}
      aria-hidden="true"
    >
      {sparklePositions.map((pos) => (
        <Sparkle
          key={`sparkle-${pos.id}`}
          className="absolute opacity-60"
          style={{ 
            left: pos.left, 
            top: pos.top,
            animationDelay: `${pos.delay}s`
          } as React.CSSProperties}
          size={pos.size}
          delay={pos.delay}
        />
      ))}
      {crystalPositions.map((pos) => (
        <Crystal
          key={`crystal-${pos.id}`}
          className="absolute opacity-40"
          style={{ 
            left: pos.left, 
            top: pos.top,
            animationDelay: `${pos.delay}s`,
            animationDuration: `${5 + pos.delay}s`
          } as React.CSSProperties}
          size={pos.size}
          variant={pos.id % 3 === 0 ? "accent" : pos.id % 2 === 0 ? "small" : "default"}
        />
      ))}
    </div>
  )
}

// Corner decorations for cards/sections
export function CornerSparkles({ 
  position = "top-right",
  className 
}: { 
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "all"
  className?: string
}) {
  const positions = {
    "top-right": [{ className: "top-2 right-2" }],
    "top-left": [{ className: "top-2 left-2" }],
    "bottom-right": [{ className: "bottom-2 right-2" }],
    "bottom-left": [{ className: "bottom-2 left-2" }],
    "all": [
      { className: "top-2 right-2" },
      { className: "top-2 left-2" },
      { className: "bottom-2 right-2" },
      { className: "bottom-2 left-2" }
    ]
  }

  return (
    <>
      {positions[position].map((pos, i) => (
        <Sparkle
          key={i}
          className={cn("absolute", pos.className, className)}
          size={12}
          delay={i * 0.5}
        />
      ))}
    </>
  )
}

// Anime-style section divider
export function SectionDivider({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center py-4", className)}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border/50" />
      </div>
      <div className="relative flex items-center gap-3 bg-background px-4">
        <Crystal size={14} variant="small" className="!animate-none opacity-60" />
        <Sparkle size={10} className="!animate-none opacity-40" />
        <Crystal size={14} variant="default" className="!animate-none opacity-60" />
      </div>
    </div>
  )
}

// Glowing orb background effect
export function GlowOrb({ 
  className,
  color = "primary",
  size = "md"
}: { 
  className?: string
  color?: "primary" | "accent" | "aurora"
  size?: "sm" | "md" | "lg"
}) {
  const sizes = {
    sm: "w-32 h-32",
    md: "w-64 h-64",
    lg: "w-96 h-96"
  }

  const colors = {
    primary: "bg-primary/20",
    accent: "bg-accent/20",
    aurora: "bg-aurora/20"
  }

  return (
    <div
      className={cn(
        "absolute rounded-full blur-3xl",
        sizes[size],
        colors[color],
        className
      )}
      aria-hidden="true"
    />
  )
}

// Loading skeleton with shimmer
export function AnimeCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      <div className="aspect-[3/4] bg-muted animate-pulse" />
      <div className="absolute inset-0 animate-shimmer" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
      </div>
    </div>
  )
}

// Main anime decorations component for page backgrounds
export function AnimeDecorations({ 
  variant = "normal",
  className 
}: { 
  variant?: "sparse" | "normal" | "dense"
  className?: string
}) {
  return (
    <div className={cn("fixed inset-0 pointer-events-none z-0", className)} aria-hidden="true">
      {/* Gradient orbs */}
      <GlowOrb color="primary" size="lg" className="top-0 left-0 -translate-x-1/2 -translate-y-1/2 opacity-30" />
      <GlowOrb color="accent" size="md" className="bottom-0 right-0 translate-x-1/4 translate-y-1/4 opacity-20" />
      <GlowOrb color="aurora" size="sm" className="top-1/2 right-1/4 opacity-15" />
      
      {/* Floating decorations */}
      <FloatingDecorations density={variant} />
    </div>
  )
}
