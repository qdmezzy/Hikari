"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Compass, Home, ListVideo, LogIn, Search, Sparkles, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const previewNav = [
  { href: "/v2", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "/lists", label: "My Lists", icon: ListVideo },
]

export function V2Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 px-4 pt-4">
      <div className="glacier-panel mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-[28px] px-5 py-4">
        <Link href="/v2" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-cyan-300 to-blue-500 text-slate-950 shadow-lg shadow-sky-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-sky-200/70">Preview</p>
            <p className="text-lg font-semibold text-white">Hikari V2</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 lg:flex">
          {previewNav.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "glacier-chip flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
                  isActive ? "text-white" : "text-slate-300 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="hidden rounded-full text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex">
            <Link href="/login">
              <LogIn className="h-4 w-4" />
              Sign in
            </Link>
          </Button>
          <Button asChild className="rounded-full bg-gradient-to-r from-sky-400 to-cyan-300 px-5 font-semibold text-slate-950 hover:opacity-90">
            <Link href="/register">
              <UserPlus className="h-4 w-4" />
              Try the redesign
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
