"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Search, 
  Bell,
  User, 
  Menu, 
  X,
  Home,
  Compass,
  ListVideo,
  Calendar,
  Users,
  Settings,
  LogOut,
  Crown,
  Shield
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme/theme-toggle"

const NotificationsMenu = dynamic(
  () => import("@/components/notifications/NotificationsMenu").then((mod) => mod.NotificationsMenu),
  {
    ssr: false,
    loading: () => (
      <Button
        variant="ghost"
        size="icon"
        className="relative h-10 w-10 rounded-xl text-muted-foreground/70 hover:bg-primary/10"
      >
        <Bell className="h-5 w-5" />
        <span className="sr-only">Notifications</span>
      </Button>
    ),
  },
)

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/community", label: "Community", icon: Users },
  { href: "/search", label: "Browse", icon: Search },
  { href: "/lists", label: "My List", icon: ListVideo },
  { href: "/calendar", label: "Schedule", icon: Calendar },
]

interface HeaderProps {
  user?: {
    name: string
    avatar?: string
    username: string
    isPremium?: boolean
  } | null
  authUser?: any | null
  authLoading?: boolean
  onLogout?: () => void
}

export const Header = React.memo(function Header({ user, authUser, authLoading = false, onLogout }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isScrolled, setIsScrolled] = React.useState(false)
  const actualIsMod = authUser?.app_metadata?.is_mod === true || authUser?.app_metadata?.isMod === true
  const isMod = !authLoading && actualIsMod
  const discordUrl = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "/discord/link"
  const discordExternal = discordUrl.startsWith("http")

  const runSearch = React.useCallback(() => {
    const trimmed = searchQuery.trim()
    router.push(trimmed ? `/search?query=${encodeURIComponent(trimmed)}` : "/search")
  }, [router, searchQuery])

  React.useEffect(() => {
    let frameId: number | null = null
    let lastScrolled = window.scrollY > 20
    setIsScrolled(lastScrolled)

    const handleScroll = () => {
      if (frameId !== null) return
      frameId = window.requestAnimationFrame(() => {
        frameId = null
        const nextScrolled = window.scrollY > 20
        if (nextScrolled !== lastScrolled) {
          lastScrolled = nextScrolled
          setIsScrolled(nextScrolled)
        }
      })
    }

    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      isScrolled || isMobileMenuOpen || isSearchOpen
        ? "bg-background/92 backdrop-blur-xl border-b border-border/50 shadow-lg supports-[backdrop-filter]:bg-background/82"
        : "bg-transparent"
    )}>
      <div className="container mx-auto px-4">
        <div className="flex h-16 lg:h-20 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="group flex flex-col leading-none">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-xl font-black text-transparent lg:text-2xl">
              Hikari
            </span>
            <span className="font-jp text-[9px] tracking-[0.32em] text-muted-foreground/70">ひかり</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
              const isCommunityLocked = item.href === "/community" && !isMod

              if (isCommunityLocked) {
                return (
                  <span
                    key={item.href}
                    aria-disabled="true"
                    title="Community is coming soon"
                    className="relative flex cursor-not-allowed items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground/55 transition-all duration-200"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    <span className="rounded-full border border-border/60 bg-muted/35 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/75">
                      Soon
                    </span>
                  </span>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onMouseEnter={() => router.prefetch(item.href)}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 rounded-xl -z-10 bg-primary/10"
                      transition={{ type: "spring", duration: 0.5 }}
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Search Bar - Desktop */}
          <div className="hidden lg:flex flex-1 max-w-md mx-4">
            <div className="relative w-full group">
              <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary/30 to-accent/30 opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type="search"
                  placeholder="Search anime..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runSearch()
                  }}
                  className="pl-11 pr-4 h-11 bg-card/50 border-border/50 rounded-xl focus:border-primary/50 focus:bg-card transition-all"
                />
              </div>
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* Mobile Search Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-10 w-10 rounded-xl"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            >
              <Search className="h-5 w-5" />
              <span className="sr-only">Search</span>
            </Button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Join Discord */}
            <Button
              asChild
              variant="ghost"
              className="inline-flex h-10 gap-2 rounded-xl border border-[#5865F2]/30 bg-[#5865F2]/10 px-3 text-[#8b92f7] shadow-[0_10px_30px_-18px_rgba(88,101,242,0.9)] transition-all hover:border-[#5865F2]/45 hover:bg-[#5865F2]/20 hover:text-[#a3a9f9] sm:px-4"
            >
              <Link
                href={discordUrl}
                {...(discordExternal ? { target: "_blank", rel: "noreferrer" } : {})}
                aria-label="Join the Hikari Discord"
              >
                <svg viewBox="0 0 127.14 96.36" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                </svg>
                <span className="hidden font-semibold sm:inline">Discord</span>
              </Link>
            </Button>

            {isMod ? (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="hidden sm:inline-flex h-10 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 text-emerald-300 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.9)] transition-all hover:border-emerald-400/35 hover:bg-emerald-500/15 hover:text-emerald-200"
                >
                  <Link href="/mod" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="font-semibold">Mod</span>
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="sm:hidden h-10 w-10 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.9)] transition-all hover:border-emerald-400/35 hover:bg-emerald-500/15 hover:text-emerald-200"
                >
                  <Link href="/mod" aria-label="Open moderation">
                    <Shield className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : null}

            {authLoading && !user ? (
              <div className="flex items-center gap-3">
                <div className="hidden h-10 w-24 animate-pulse rounded-xl border border-white/5 bg-white/5 sm:block" />
                <div className="h-10 w-28 animate-pulse rounded-xl border border-white/5 bg-white/5" />
              </div>
            ) : user ? (
              <>
                <NotificationsMenu user={authUser} />

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="flex items-center gap-2 px-2 h-10 rounded-xl hover:bg-primary/10"
                    >
                      <div className="relative">
                        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-foreground text-sm font-bold overflow-hidden">
                          {user.avatar ? (
                            <img 
                              src={user.avatar} 
                              alt={user.name} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            user.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        {user.isPremium && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-sm">
                            <Crown className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <span className="hidden sm:inline text-sm font-medium max-w-[100px] truncate">
                        {user.name}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 bg-card border-border/50">
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/lists" className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg">
                        <ListVideo className="h-4 w-4 text-muted-foreground" />
                        <span>My Lists</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem 
                      onClick={onLogout}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg text-muted-foreground hover:text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  asChild 
                  className="hidden sm:inline-flex h-10 px-5 rounded-xl border-border/60 hover:bg-primary/10 hover:border-primary/50 transition-all"
                >
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button 
                  asChild 
                  className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  <Link href="/register">
                    Sign up
                  </Link>
                </Button>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-10 w-10 rounded-xl"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <AnimatePresence mode="wait">
                {isMobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X className="h-5 w-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Menu className="h-5 w-5" />
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="sr-only">Menu</span>
            </Button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden overflow-hidden"
            >
              <div className="rounded-b-3xl border-t border-border/50 bg-background/96 px-1 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.28)] supports-[backdrop-filter]:bg-background/90">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search anime..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runSearch()
                    }}
                    className="h-12 rounded-xl border-border/60 bg-card text-foreground placeholder:text-muted-foreground/80 shadow-sm pl-11"
                    autoFocus
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Navigation Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.nav 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden overflow-hidden"
            >
              <div className="rounded-b-3xl border-t border-border/50 bg-background/96 px-1 py-4 shadow-[0_24px_60px_rgba(0,0,0,0.34)] supports-[backdrop-filter]:bg-background/92">
                <div className="flex flex-col gap-1">
                  {navItems.map((item, index) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                    const isCommunityLocked = item.href === "/community" && !isMod
                    return (
                      <motion.div
                        key={item.href}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        {isCommunityLocked ? (
                          <span
                            aria-disabled="true"
                            className="flex cursor-not-allowed items-center justify-between gap-4 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground/60"
                          >
                            <span className="flex items-center gap-4">
                              <Icon className="h-5 w-5" />
                              {item.label}
                            </span>
                            <span className="rounded-full border border-border/60 bg-muted/35 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/75">
                              Soon
                            </span>
                          </span>
                        ) : (
                          <Link
                            href={item.href}
                            onMouseEnter={() => router.prefetch(item.href)}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            {item.label}
                          </Link>
                        )}
                      </motion.div>
                    )
                  })}
                  {isMod ? (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: navItems.length * 0.05 }}
                    >
                      <Link
                        href="/mod"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm font-semibold transition-all",
                          pathname === "/mod" || pathname.startsWith("/mod/")
                            ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                            : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/30 hover:bg-emerald-500/15 hover:text-emerald-200",
                        )}
                      >
                        <span className="flex items-center gap-4">
                          <Shield className="h-5 w-5" />
                          Mod Panel
                        </span>
                        <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-100/80">
                          Staff
                        </span>
                      </Link>
                    </motion.div>
                  ) : null}
                  {!user && (
                    <>
                      <div className="my-2 border-t border-border/50" />
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: navItems.length * 0.05 }}
                      >
                        <Link
                          href="/login"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        >
                          <User className="h-5 w-5" />
                          Sign in
                        </Link>
                      </motion.div>
                    </>
                  )}
                </div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
})
