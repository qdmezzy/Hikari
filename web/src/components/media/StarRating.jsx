"use client"

import { useState } from "react"
import { Star, X } from "lucide-react"
import { cn } from "@/lib/utils"

// 1–10 clickable star rating with the numeric score shown alongside.
// Controlled: pass `value` (0 = unrated) and `onChange(next)`.
export function StarRating({ value = 0, onChange, disabled = false, className }) {
  const [hover, setHover] = useState(0)
  const active = hover || value

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="grid grid-cols-10 gap-0.5" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 10 }).map((_, i) => {
          const score = i + 1
          return (
            <button
              key={score}
              type="button"
              disabled={disabled}
              onMouseEnter={() => setHover(score)}
              onClick={() => onChange?.(score === value ? 0 : score)}
              className="flex aspect-square min-w-0 items-center justify-center rounded-sm transition-colors hover:bg-primary/10 disabled:cursor-not-allowed"
              aria-label={`Rate ${score} out of 10`}
            >
              <Star
                className={cn(
                  "h-4 w-4 transition-colors",
                  score <= active ? "fill-primary text-primary" : "text-muted-foreground/45",
                )}
              />
            </button>
          )
        })}
      </div>

      <div className="flex min-h-5 items-center justify-between gap-2"><span className="text-xs font-medium text-foreground">
        {active ? `${active} / 10` : <span className="text-muted-foreground">Choose a score</span>}
      </span>
      {value > 0 && !disabled ? (
        <button
          type="button"
          onClick={() => onChange?.(0)}
          className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      ) : null}</div>
    </div>
  )
}
