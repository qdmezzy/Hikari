import { Platform } from "react-native"

/**
 * Mobile equivalent of web's `cn()` (clsx + tailwind-merge). We don't use
 * Tailwind on native, so this just joins truthy class strings — kept around so
 * component APIs feel familiar to anyone coming from the web codebase.
 */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ")
}

/** iOS haptic-friendly boolean — used to gate blur/material effects. */
export const supportsBlur = Platform.OS === "ios" || Platform.OS === "android"

/** Format a number compactly, e.g. 12345 -> "12.3K". Mirrors web's formatCompactNumber. */
export function formatCompactNumber(value: number | null | undefined): string {
  const n = Number(value || 0)
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`
}

/** Relative time like "in 2d" / "3h ago". Mirrors web's formatRelativeTime. */
export function formatRelativeTime(date: Date): string {
  const diffMs = date.getTime() - Date.now()
  const diffMin = Math.round(diffMs / 60000)
  const abs = Math.abs(diffMin)
  const future = diffMin > 0

  if (abs < 60) return future ? `in ${abs}m` : `${abs}m ago`
  if (abs < 60 * 24) {
    const hours = Math.round(abs / 60)
    return future ? `in ${hours}h` : `${hours}h ago`
  }
  const days = Math.round(abs / (60 * 24))
  return future ? `in ${days}d` : `${days}d ago`
}

/** Clamp helper. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Pick the first non-empty string. */
export function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    const s = String(v ?? "").trim()
    if (s) return s
  }
  return ""
}
