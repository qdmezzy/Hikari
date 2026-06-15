import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Standard empty-state used across the app for consistent, friendly "nothing here yet" UI.
 * Pass an `icon` (lucide component), a `title`, optional `description`, and an optional `action`.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-card/40 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-6" />
        </div>
      ) : null}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-pretty text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{action}</div> : null}
    </div>
  )
}
