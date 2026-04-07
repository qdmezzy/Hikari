"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Home,
  Search,
  Compass,
  Calendar,
  User,
  Menu,
  X,
  Bell,
  Crown,
  Sparkles,
  Settings,
  Shield,
  LogIn,
  LogOut,
  Download,
  Users,
  LayoutDashboard,
  Brain,
  ChevronDown,
  Bookmark,
  History,
  BookMarked,
} from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import useAuth from "@/hooks/useAuth"
import Image from "next/image"
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from "@/lib/notifications-store"
import { scheduleEpisodeNotifications } from "@/lib/episode-notifications"

const mainNav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, requiresAuth: true },
  { href: "/search", label: "Search", icon: Search },
  { href: "/social", label: "Social", icon: Users, requiresAuth: true, comingSoon: true },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/calendar", label: "Calendar", icon: Calendar, requiresAuth: true },
]

const moreNav = [
  { href: "/ai-recommendations", label: "AI Picks", icon: Brain },
  { href: "/extension", label: "Get Extension", icon: Download },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
]

const formatRelativeTime = (value) => {
  if (!value) return ""
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return ""
  const diffSeconds = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSeconds < 60) return "just now"
  const minutes = Math.floor(diffSeconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function Navigation() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [notifications, setNotifications] = useState([])
  const { user, loading, logout } = useAuth()
  const isAuthLoading = loading
  const isLoggedIn = Boolean(user)
  const showLoggedInUi = !isAuthLoading && isLoggedIn
  const visibleMainNav = mainNav.filter((item) => !item.requiresAuth || isLoggedIn)
  const isPremium = user?.user_metadata?.is_premium === true || user?.user_metadata?.isPremium === true
  const isMod = user?.user_metadata?.is_mod === true || user?.user_metadata?.isMod === true
  const profileRef = useRef(null)
  const notificationsRef = useRef(null)

  const name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || null
  const handle = user?.user_metadata?.username || user?.user_metadata?.handle || null
  const displayName = name || user?.email || "User"
  const secondaryName = handle ? `@${handle}` : null
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || "/placeholder-user.jpg"
  const avatarIsRemote = /^https?:\/\//.test(avatarUrl)
  const userLevel = Number.isFinite(user?.user_metadata?.level) ? user.user_metadata.level : null
  const userXp = Number.isFinite(user?.user_metadata?.xp) ? user.user_metadata.xp : null
  const userXpToNext = Number.isFinite(user?.user_metadata?.xp_to_next)
    ? user.user_metadata.xp_to_next
    : null
  const showLevel = Number.isFinite(userLevel) && Number.isFinite(userXp) && Number.isFinite(userXpToNext) && userXpToNext > 0
  const levelProgress = showLevel ? Math.min((userXp / userXpToNext) * 100, 100) : 0
  const unreadCount = notifications.filter((item) => item.unread).length


  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (!user) {
      setNotifications([])
      return
    }
    const loadNotifications = () => setNotifications(getNotifications(user.id))
    loadNotifications()
    const unsubscribe = subscribeNotifications(loadNotifications)
    return () => unsubscribe()
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    const notifyEpisodes = user?.user_metadata?.notify_episode ?? true
    const notifyPreAir = user?.user_metadata?.notify_pre_air ?? true
    const notifyDigest = user?.user_metadata?.notify_digest ?? false
    const runScheduler = () =>
      scheduleEpisodeNotifications({
        user,
        notifyEpisodes,
        notifyPreAir,
        notifyDigest,
      })

    runScheduler()
    const interval = setInterval(runScheduler, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [
    user?.id,
    user?.user_metadata?.notify_episode,
    user?.user_metadata?.notify_pre_air,
    user?.user_metadata?.notify_digest,
  ])

  useEffect(() => {
    setMobileMenuOpen(false)
    setProfileOpen(false)
    setNotificationsOpen(false)
  }, [pathname])

  useEffect(() => {
    if (typeof document === "undefined") return
    const previousOverflow = document.body.style.overflow
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = previousOverflow || ""
    }
    return () => {
      document.body.style.overflow = previousOverflow || ""
    }
  }, [mobileMenuOpen])

  return (
    <>
      {/* Top Header */}
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-700 pointer-events-none",
          scrolled ? "py-2" : "py-3",
        )}
        style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <div className="mx-auto max-w-7xl px-4">
          <nav
            className={cn(
              "relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-700 pointer-events-auto",
              scrolled
                ? "bg-background/80 backdrop-blur-2xl border border-border/50 shadow-xl shadow-black/5"
                : "bg-transparent",
            )}
            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <div className="flex items-center gap-3 min-w-0 relative z-20">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="relative">
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-all duration-700"
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  />
                  <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden shadow-lg">
                    <Sparkles className="h-5 w-5 text-white" />
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
                      style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                    />
                  </div>
                </div>
                <span className="text-xl font-bold text-gradient hidden sm:block">Hikari</span>
              </Link>

            </div>

            {/* Center Nav - Desktop */}
            <div className="hidden md:flex items-center gap-1 bg-secondary/50 backdrop-blur-sm rounded-xl p-1 justify-self-center">
              {visibleMainNav.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                const itemClassName = cn(
                  "relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-500",
                  isActive ? "text-foreground" : "text-muted-foreground",
                  !isActive && "hover:text-foreground",
                )
                const itemContent = (
                  <>
                    {isActive && (
                      <div
                        className="absolute inset-0 bg-background rounded-lg shadow-sm"
                        style={{
                          animation: "scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                        }}
                      />
                    )}
                    <Icon
                      className={cn(
                        "h-4 w-4 relative z-10 transition-transform duration-500",
                        isActive && "scale-110",
                      )}
                      style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                    />
                    <span className="relative z-10">{item.label}</span>
                    {item.comingSoon ? (
                      <span className="relative z-10 rounded-full border border-border/60 bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Soon
                      </span>
                    ) : null}
                  </>
                )

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={itemClassName}
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  >
                    {itemContent}
                  </Link>
                )
              })}
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-2 justify-end min-w-0 relative z-20">
              <div className="flex flex-col items-end gap-1">
                {/* Premium Badge or CTA */}
                {isAuthLoading ? (
                  <div className="hidden sm:block h-9 w-20 rounded-lg bg-secondary/45 animate-pulse" />
                ) : isLoggedIn && isPremium ? (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                    <Crown className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-semibold text-gradient-gold">PRO</span>
                  </div>
                ) : (
                  <Link href="/premium" className="hidden sm:block">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all duration-500"
                      style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                    >
                      <Crown className="h-4 w-4" />
                      <span className="text-xs font-medium">Donate</span>
                    </Button>
                  </Link>
                )}

                {isMod && isLoggedIn && (
                  <Link href="/mod" className="hidden sm:block">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "gap-1.5 transition-all duration-500",
                        pathname.startsWith("/mod")
                          ? "text-emerald-400 bg-emerald-500/10"
                          : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10",
                      )}
                      style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                    >
                      <Shield className="h-4 w-4" />
                      <span className="text-xs font-medium">Mod</span>
                    </Button>
                  </Link>
                )}
              </div>

              {/* Notifications - Only when logged in */}
              {showLoggedInUi && (
                <div className="relative" ref={notificationsRef}>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="relative h-10 w-10 rounded-xl hover:bg-secondary transition-all duration-500 btn-press"
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                    onClick={() => {
                      setNotificationsOpen(!notificationsOpen)
                      setProfileOpen(false)
                    }}
                  >
                    <Bell
                      className={cn(
                        "h-4 w-4 transition-transform duration-300",
                        notificationsOpen && "scale-110",
                      )}
                    />
                    {unreadCount > 0 && (
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary shadow-lg shadow-primary/50 animate-gentle-pulse" />
                    )}
                  </Button>

                  {/* Notifications Dropdown */}
                  <div
                    className={cn(
                      "absolute top-full right-0 mt-2 w-80 transition-all duration-500 origin-top-right",
                      notificationsOpen
                        ? "opacity-100 scale-100 translate-y-0"
                        : "opacity-0 scale-95 -translate-y-2 pointer-events-none",
                    )}
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  >
                    <div className="bg-card/95 backdrop-blur-2xl rounded-2xl border border-border/50 shadow-2xl overflow-hidden">
                      <div className="p-4 border-b border-border/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">Notifications</h3>
                            {unreadCount > 0 ? (
                              <Badge variant="secondary" className="text-xs">
                                {unreadCount} new
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">All caught up</span>
                            )}
                          </div>
                          {unreadCount > 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={(event) => {
                                event.stopPropagation()
                                markAllNotificationsRead(user.id)
                              }}
                            >
                              Mark all read
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-sm text-muted-foreground">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.map((item, i) => (
                            <div
                              key={item.id}
                              className={cn(
                                "p-4 border-b border-border/30 hover:bg-secondary/50 transition-all duration-300 cursor-pointer",
                                item.unread && "bg-primary/5",
                              )}
                              style={{
                                opacity: notificationsOpen ? 1 : 0,
                                transform: notificationsOpen ? "translateX(0)" : "translateX(-10px)",
                                transitionDelay: notificationsOpen ? `${i * 50}ms` : "0ms",
                              }}
                              onClick={() => markNotificationRead(user.id, item.id)}
                            >
                              <div className="flex items-start gap-3">
                                {item.unread && (
                                  <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                                )}
                                <div className={cn("flex-1", !item.unread && "ml-5")}>
                                  <p className="text-sm font-medium">{item.title}</p>
                                  <p className="text-xs text-muted-foreground">{item.message}</p>
                                  <p className="text-xs text-muted-foreground/60 mt-1">
                                    {formatRelativeTime(item.created_at)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="p-3 border-t border-border/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => markAllNotificationsRead(user.id)}
                          disabled={notifications.length === 0}
                        >
                          View all notifications
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Profile Dropdown - When logged in */}
              {isAuthLoading ? (
                <div className="hidden sm:block h-10 w-24 rounded-xl bg-secondary/45 animate-pulse" />
              ) : isLoggedIn ? (
                <div className="relative hidden sm:block" ref={profileRef}>
                  <button
                    onClick={() => {
                      setProfileOpen(!profileOpen)
                      setNotificationsOpen(false)
                    }}
                    className={cn(
                      "flex items-center gap-2 p-1.5 pr-3 rounded-xl transition-all duration-500 hover:bg-secondary/70",
                      profileOpen && "bg-secondary/70",
                    )}
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  >
                    <div
                      className={cn(
                        "relative h-8 w-8 rounded-lg overflow-hidden ring-2 transition-all duration-300",
                        isPremium ? "ring-amber-500/50" : "ring-border",
                      )}
                    >
                      {avatarIsRemote ? (
                        <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                      ) : (
                        <Image src={avatarUrl} alt={displayName} fill className="object-cover" />
                      )}
                      {isPremium && (
                        <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center border-2 border-background">
                          <Crown className="h-2 w-2 text-white" />
                        </div>
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground transition-transform duration-300",
                        profileOpen && "rotate-180",
                      )}
                    />
                  </button>

                  {/* Profile Dropdown Menu */}
                  <div
                    className={cn(
                      "absolute top-full right-0 mt-2 w-72 transition-all duration-500 origin-top-right",
                      profileOpen
                        ? "opacity-100 scale-100 translate-y-0"
                        : "opacity-0 scale-95 -translate-y-2 pointer-events-none",
                    )}
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  >
                    <div className="bg-card/95 backdrop-blur-2xl rounded-2xl border border-border/50 shadow-2xl overflow-hidden">
                      {/* User Info Header */}
                      <div className="p-4 border-b border-border/50">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "relative h-12 w-12 rounded-xl overflow-hidden ring-2 transition-all duration-300",
                              isPremium ? "ring-amber-500/50" : "ring-border",
                            )}
                          >
                            {avatarIsRemote ? (
                              <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                            ) : (
                              <Image src={avatarUrl} alt={displayName} fill className="object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold truncate">{displayName}</span>
                              {isPremium && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-[10px] font-semibold text-amber-400">
                                  <Crown className="h-2.5 w-2.5" />
                                  PRO
                                </span>
                              )}
                            </div>
                            {secondaryName && <p className="text-xs text-muted-foreground truncate">{secondaryName}</p>}
                          </div>
                        </div>

                        {showLevel && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Level {userLevel}</span>
                              <span className="text-muted-foreground">{userXp}/{userXpToNext} XP</span>
                            </div>
                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000"
                                style={{
                                  width: `${levelProgress}%`,
                                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Menu Items */}
                      <div className="p-2">
                        {[
                          { href: "/profile", icon: User, label: "My Profile" },
                          { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
                          { href: "/favorites", icon: Bookmark, label: "Saved Clips" },
                          { href: "/history", icon: History, label: "Watch History" },
                          { href: "/lists", icon: BookMarked, label: "My Lists" },
                        ].map((item, i) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-300"
                            style={{
                              opacity: profileOpen ? 1 : 0,
                              transform: profileOpen ? "translateX(0)" : "translateX(-10px)",
                              transitionDelay: profileOpen ? `${i * 40}ms` : "0ms",
                            }}
                            onClick={() => setProfileOpen(false)}
                          >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        ))}

                        <div className="my-2 border-t border-border/50" />

                        <Link
                          href="/settings"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-300"
                          style={{
                            opacity: profileOpen ? 1 : 0,
                            transform: profileOpen ? "translateX(0)" : "translateX(-10px)",
                            transitionDelay: profileOpen ? "200ms" : "0ms",
                          }}
                          onClick={() => setProfileOpen(false)}
                        >
                          <Settings className="h-4 w-4" />
                          Settings
                        </Link>

                        {!isPremium && (
                          <Link
                            href="/premium"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-amber-400 hover:bg-amber-500/10 transition-all duration-300"
                            style={{
                              opacity: profileOpen ? 1 : 0,
                              transform: profileOpen ? "translateX(0)" : "translateX(-10px)",
                              transitionDelay: profileOpen ? "240ms" : "0ms",
                            }}
                            onClick={() => setProfileOpen(false)}
                          >
                            <Crown className="h-4 w-4" />
                            Donate
                          </Link>
                        )}

                        <div className="my-2 border-t border-border/50" />

                        <button
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-all duration-300 w-full"
                          style={{
                            opacity: profileOpen ? 1 : 0,
                            transform: profileOpen ? "translateX(0)" : "translateX(-10px)",
                            transitionDelay: profileOpen ? "280ms" : "0ms",
                          }}
                          onClick={() => {
                            setProfileOpen(false)
                            logout()
                          }}
                        >
                          <LogOut className="h-4 w-4" />
                          Log Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <Link href="/login" className="hidden sm:block">
                  <Button
                    size="sm"
                    className="gap-2 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-500 btn-press shadow-lg shadow-primary/20"
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  >
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Button>
                </Link>
              )}

              {/* Mobile Menu Toggle */}
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden h-10 w-10 rounded-xl hover:bg-secondary transition-all duration-500"
                style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <div className="relative h-5 w-5">
                  <Menu
                    className={cn(
                      "h-5 w-5 absolute inset-0 transition-all duration-500",
                      mobileMenuOpen ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100",
                    )}
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  />
                  <X
                    className={cn(
                      "h-5 w-5 absolute inset-0 transition-all duration-500",
                      mobileMenuOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50",
                    )}
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  />
                </div>
              </Button>
            </div>
          </nav>
        </div>

        {/* Mobile Menu Dropdown */}
        <div
          className={cn(
            "md:hidden absolute top-full left-4 right-4 mt-2 transition-all duration-500",
            mobileMenuOpen
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 -translate-y-4 scale-95 pointer-events-none",
          )}
          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          <div className="max-h-[70vh] overflow-y-auto bg-card/95 backdrop-blur-2xl rounded-2xl border border-border/50 p-4 shadow-2xl">
            <nav className="space-y-1">
              {[...visibleMainNav, ...moreNav].map((item, i) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                const itemClassName = cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-500",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground",
                  !isActive && "hover:bg-secondary/50 hover:text-foreground",
                )
                const itemStyle = {
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  opacity: mobileMenuOpen ? 1 : 0,
                  transform: mobileMenuOpen ? "translateX(0)" : "translateX(-12px)",
                  transitionDelay: mobileMenuOpen ? `${i * 30}ms` : "0ms",
                }
                const itemContent = (
                  <>
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                    {item.comingSoon ? (
                      <span className="ml-auto rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Soon
                      </span>
                    ) : null}
                  </>
                )

                return (
                  <Link key={item.href} href={item.href} className={itemClassName} style={itemStyle}>
                    {itemContent}
                  </Link>
                )
              })}

              {isMod && (
                <Link
                  href="/mod"
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-500",
                    pathname.startsWith("/mod")
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-emerald-400 hover:bg-emerald-500/10",
                  )}
                  style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                >
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5" />
                    Mod Dashboard
                  </div>
                </Link>
              )}
            </nav>
            <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
              <Link href="/premium">
                <Button
                  className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 btn-press transition-all duration-500"
                  style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                >
                  <Crown className="h-4 w-4" />
                  Go Premium
                </Button>
              </Link>
              {isAuthLoading ? (
                <div className="h-10 w-full rounded-lg bg-secondary/45 animate-pulse" />
              ) : isLoggedIn ? (
                <div className="space-y-2">
                  <Link href="/profile">
                    <Button
                      variant="outline"
                      className="w-full gap-2 bg-transparent btn-press transition-all duration-500"
                      style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="w-full gap-2 bg-transparent text-destructive hover:text-destructive btn-press transition-all duration-500"
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>
                </div>
              ) : (
                <Link href="/login">
                  <Button
                    variant="outline"
                    className="w-full gap-2 bg-transparent btn-press transition-all duration-500"
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  >
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Bottom Nav - Mobile & Tablet */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
        <div className="mx-4 mb-4">
          <div className="flex items-center justify-around bg-card/90 backdrop-blur-2xl rounded-2xl border border-border/50 py-2 px-2 shadow-xl shadow-black/10">
            {visibleMainNav.slice(0, 5).map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
              const itemClassName = cn(
                "flex min-h-11 min-w-11 flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-500",
                isActive ? "text-primary" : "text-muted-foreground",
              )
              const itemContent = (
                <>
                  <div className="relative">
                    {isActive && (
                      <div
                        className="absolute inset-0 bg-primary/30 rounded-full blur-lg scale-150"
                        style={{ animation: "scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
                      />
                    )}
                    <Icon
                      className={cn("h-5 w-5 relative z-10 transition-all duration-500", isActive && "scale-110")}
                      style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium transition-all duration-500",
                      isActive ? "opacity-100" : "opacity-60",
                    )}
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  >
                    {item.comingSoon ? "Soon" : item.label}
                  </span>
                </>
              )

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={itemClassName}
                  style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                >
                  {itemContent}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}
