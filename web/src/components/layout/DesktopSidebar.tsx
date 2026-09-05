"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Home, Compass, Users, Search, ListVideo, CalendarDays, Heart, History, Settings, ArrowUpRight } from "lucide-react"

const explore = [
  { href: "/", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/search", label: "Browse", icon: Search },
  { href: "/community", label: "Community", icon: Users },
]
const library = [
  { href: "/lists", label: "My List", icon: ListVideo },
  { href: "/calendar", label: "Schedule", icon: CalendarDays },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/history", label: "History", icon: History },
]

export function DesktopSidebar() {
  const pathname = usePathname()
  const renderLink = (item: typeof explore[number]) => <Link key={item.href} href={item.href} aria-current={(item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) ? "page" : undefined}><item.icon size={17} strokeWidth={1.6} /><span>{item.label}</span><i aria-hidden="true" /></Link>
  return <aside className="hk-sidebar">
    <Link href="/" className="hk-sidebar-brand"><Image src="/brand/hikari-wordmark.svg" width={135} height={62} alt="Hikari home" priority /><small lang="ja">光 · アニメと漫画</small></Link>
    <nav aria-label="Main navigation"><p>Explore</p>{explore.map(renderLink)}<p>Your library</p>{library.map(renderLink)}</nav>
    <div className="hk-sidebar-bottom"><Link href="/feedback"><span>Help shape Hikari</span><ArrowUpRight size={14} /></Link><Link href="/settings"><Settings size={17} strokeWidth={1.6} /><span>Settings</span></Link><small>HIKARI · BETA</small></div>
  </aside>
}
