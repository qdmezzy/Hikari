import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

type FoundingBadgeProps = {
  memberNumber: number
  compact?: boolean
  className?: string
}

export function FoundingBadge({ memberNumber, compact = false, className }: FoundingBadgeProps) {
  if (!Number.isInteger(memberNumber) || memberNumber < 1 || memberNumber > 25) return null
  const label = `Founding 25 member number ${memberNumber}`
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-amber-950 shadow-sm shadow-amber-900/10 dark:border-amber-300/35 dark:bg-amber-300/10 dark:text-amber-200",
        compact && "size-5 justify-center p-0 text-[9px]",
        className,
      )}
    >
      {!compact && <Sparkles className="size-3" aria-hidden="true" />}
      <span>{compact ? memberNumber : `Founding 25 · #${memberNumber}`}</span>
    </span>
  )
}
