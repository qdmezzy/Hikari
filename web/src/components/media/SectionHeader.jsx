import Link from "next/link"
import { ChevronRight } from "lucide-react"

export function SectionHeader({ title, href, action = "View All", icon: Icon }) {
  return (
    <div
      className="flex items-center justify-between border-t border-border/60 pt-4"
      style={{
        animation: "fade-in-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        opacity: 0,
      }}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className="flex h-8 w-8 items-center justify-center border border-primary/25 bg-primary/10 transition-transform duration-300 hover:-rotate-3"
            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
        <div>
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/70">Hikari selection</p>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="group flex items-center gap-1 border-b border-primary/30 pb-1 text-sm font-semibold text-muted-foreground transition-all duration-300 hover:border-primary hover:text-primary hover:gap-2"
          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          {action}
          <ChevronRight
            className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-0.5"
            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        </Link>
      )}
    </div>
  )
}
