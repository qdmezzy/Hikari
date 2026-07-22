"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Shield,
  LayoutDashboard,
  AlertTriangle,
  History,
  Settings,
  ChevronLeft,
  BarChart3,
  Sparkles,
  Menu,
  X,
  Crown,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"

const modNavItems = [
  { href: "/mod", label: "Dashboard", icon: LayoutDashboard },
  { href: "/mod/appeals", label: "Appeals", icon: AlertTriangle, badgeKey: "escalated", badgeColor: "warning" },
  { href: "/mod/history", label: "Log", icon: History },
  { href: "/mod/stats", label: "Stats", icon: BarChart3 },
  { href: "/mod/founding", label: "Founding 25", icon: Crown },
  { href: "/mod/settings", label: "Settings", icon: Settings },
]

export function ModNavigation() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user } = useAuth()
  const [badgeCounts, setBadgeCounts] = useState({ pending: 0, escalated: 0 })

  useEffect(() => {
    if (!user) return
    let isActive = true

    const loadCounts = async () => {
      const [pendingRes, escalatedRes] = await Promise.all([
        client.from("social_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
        client.from("social_reports").select("id", { count: "exact", head: true }).eq("status", "escalated"),
      ])

      if (!isActive) return
      setBadgeCounts({
        pending: pendingRes.count || 0,
        escalated: escalatedRes.count || 0,
      })
    }

    loadCounts()

    return () => {
      isActive = false
    }
  }, [user])

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50"
        style={{
          animation: "fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-500 group"
              style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
            >
              <ChevronLeft
                className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-500"
                style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
              />
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm hidden sm:block">Back to Hikari</span>
            </Link>

            <div className="h-6 w-px bg-border/50 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="font-semibold text-foreground">Mod Dashboard</span>
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
            {modNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              const badgeValue = item.badgeKey ? badgeCounts[item.badgeKey] : item.badge
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-500",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                >
                    <Icon className="h-4 w-4" />
                    <span className="hidden lg:block">{item.label}</span>
                  {badgeValue ? (
                    <Badge
                      className={cn(
                        "h-5 min-w-5 px-1.5 text-[10px]",
                        item.badgeColor === "warning"
                          ? "bg-amber-500 text-white"
                          : "bg-destructive text-destructive-foreground",
                      )}
                    >
                      {badgeValue}
                    </Badge>
                  ) : null}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/50">
              <div className="relative">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
              </div>
              <span className="text-sm font-medium">Mod</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden transition-all duration-500"
              style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <div className="relative h-5 w-5">
                <Menu
                  className={cn(
                    "h-5 w-5 absolute inset-0 transition-all duration-500",
                    mobileOpen ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100",
                  )}
                  style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                />
                <X
                  className={cn(
                    "h-5 w-5 absolute inset-0 transition-all duration-500",
                    mobileOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50",
                  )}
                  style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                />
              </div>
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "md:hidden absolute top-full left-0 right-0 bg-card/95 backdrop-blur-xl border-b border-border/50 transition-all duration-500",
            mobileOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none",
          )}
          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          <nav className="p-4 space-y-1">
            {modNavItems.map((item, i) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              const badgeValue = item.badgeKey ? badgeCounts[item.badgeKey] : item.badge
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-500",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                  )}
                  style={{
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    opacity: mobileOpen ? 1 : 0,
                    transform: mobileOpen ? "translateX(0)" : "translateX(-12px)",
                    transitionDelay: mobileOpen ? `${i * 30}ms` : "0ms",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </div>
                  {badgeValue ? (
                    <Badge
                      className={cn(
                        item.badgeColor === "warning"
                          ? "bg-amber-500 text-white"
                          : "bg-destructive text-destructive-foreground",
                      )}
                    >
                      {badgeValue}
                    </Badge>
                  ) : null}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <div className="h-16" />
    </>
  )
}
