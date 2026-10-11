"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import Image from "next/image"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { usePathname, useRouter } from "next/navigation"
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
  Shield,
  Star,
  Clock
} from "lucide-react"
import { DesktopSidebar } from "@/components/layout/DesktopSidebar"
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
import { FoundingName } from "@/components/founding/FoundingName"

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const actualIsMod = authUser?.app_metadata?.is_mod === true || authUser?.app_metadata?.isMod === true
  const isMod = !authLoading && actualIsMod
  const discordUrl = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "/discord-bot"
  const discordExternal = discordUrl.startsWith("http")

  const runSearch = React.useCallback(() => {
    const trimmed = searchQuery.trim()
    router.push(trimmed ? `/search?query=${encodeURIComponent(trimmed)}` : "/search")
  }, [router, searchQuery])


  React.useEffect(() => { setIsMobileMenuOpen(false) }, [pathname])

  return <>
    <DesktopSidebar />
    <header className="hk-appbar">
      <div className="hk-appbar-mobile">
        <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setIsMobileMenuOpen(true)}><Menu size={20} /></Button>
        <Link href="/"><Image src="/brand/hikari-wordmark.svg" width={88} height={40} alt="Hikari home" /></Link>
      </div>
      <form className="hk-appbar-search" role="search" onSubmit={event => { event.preventDefault(); runSearch() }}>
        <Search size={17} />
        <Input type="search" aria-label="Search anime and manga" placeholder="Find an anime or manga…" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} />
        <button type="submit" aria-label="Search"><span aria-hidden="true">↵</span></button>
      </form>
      <Link className="hk-mobile-search" href="/search" aria-label="Search"><Search size={19} /></Link>
      <div className="hk-appbar-actions">
            <ThemeToggle />

            <Button
              asChild
              variant="ghost"
              className="inline-flex h-10 gap-2 rounded-lg border border-primary/35 bg-primary/10 px-3 text-primary transition-colors hover:bg-primary hover:text-primary-foreground sm:px-4"
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

                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      aria-label="Open account menu"
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
                      <FoundingName handle={user.username} showBadge={false} className="hidden max-w-[100px] truncate text-sm sm:inline">
                        {user.name}
                      </FoundingName>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-lg border-border bg-popover p-1.5 text-popover-foreground shadow-xl hide-scrollbar">
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
                  <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in</Link>
                </Button>
                <Button 
                  asChild 
                  className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  <Link href={`/register?next=${encodeURIComponent(pathname)}`}>
                    Sign up
                  </Link>
                </Button>
              </div>
            )}

      </div>
    </header>
    <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
      <DialogContent className="hk-navigation-dialog">
        <DialogTitle>Explore Hikari</DialogTitle><DialogDescription>Anime, manga, and your own little corner of it.</DialogDescription>
        <nav aria-label="Mobile navigation">
          {[...navItems, {href:"/favorites",label:"Favorites",icon:Star}, {href:"/history",label:"History",icon:Clock}, {href:"/settings",label:"Settings",icon:Settings}].map(item => <Link key={item.href} href={item.href} aria-current={(pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))) ? "page" : undefined} onClick={() => setIsMobileMenuOpen(false)}><item.icon size={18} />{item.label}</Link>)}
          {isMod ? <Link href="/mod" onClick={() => setIsMobileMenuOpen(false)}><Shield size={18} />Moderation</Link> : null}
        </nav>
      </DialogContent>
    </Dialog>
  </>
})
