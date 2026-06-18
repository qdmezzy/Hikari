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
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 10 }).map((_, i) => {
          const score = i + 1
          return (
            <button
              key={score}
              type="button"
              disabled={disabled}
              onMouseEnter={() => setHover(score)}
              onClick={() => onChange?.(score === value ? 0 : score)}
              className="p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed"
              aria-label={`Rate ${score} out of 10`}
            >
              <Star
                className={cn(
                  "h-5 w-5 transition-colors",
                  score <= active ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
                )}
              />
            </button>
          )
        })}
      </div>

      <span className="min-w-[3.5rem] text-sm font-semibold text-foreground">
        {active ? `${active}/10` : <span className="text-muted-foreground">Not rated</span>}
      </span>

      {value > 0 && !disabled ? (
        <button
          type="button"
          onClick={() => onChange?.(0)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      ) : null}
    </div>
  )
}
