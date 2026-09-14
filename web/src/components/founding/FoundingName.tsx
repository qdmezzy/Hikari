import type { ReactNode } from "react"

// Preserve callers without identity lookups or retired membership styling.
export function FoundingName({ children, className }: { children: ReactNode; className?: string; handle?: string | null; memberNumber?: number | null; showBadge?: boolean; compactBadge?: boolean }) {
  return <span className={className}>{children}</span>
}
