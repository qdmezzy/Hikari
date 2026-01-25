import Link from "next/link"
import { ChevronRight } from "lucide-react"

export function SectionHeader({ title, href, action = "View All", icon: Icon }) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        animation: "fade-in-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        opacity: 0,
      }}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center transition-transform duration-500 hover:scale-110 hover:rotate-3"
            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
      </div>
      {href && (
        <Link
          href={href}
          className="group flex items-center gap-1 text-sm text-muted-foreground transition-all duration-500 hover:text-primary hover:gap-2"
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
