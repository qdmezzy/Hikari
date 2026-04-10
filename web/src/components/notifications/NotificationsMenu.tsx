"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  BellRing,
  Bookmark,
  Calendar,
  CheckCheck,
  Heart,
  MessageCircle,
  Settings2,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from "@/lib/notifications-store"
import { scheduleEpisodeNotifications } from "@/lib/episode-notifications"

type NotificationEntry = {
  id: string
  title: string
  message?: string
  created_at?: string
  unread?: boolean
  type?: string
  metadata?: Record<string, any> | null
}

type NotificationsMenuProps = {
  user?: any | null
}

const formatRelativeTime = (value?: string) => {
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
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

const getNotificationHref = (notification: NotificationEntry) => {
  const metadata = notification?.metadata || {}

  if (typeof metadata.href === "string" && metadata.href.trim()) {
    return metadata.href
  }

  if (metadata.postId) {
    return `/community/${metadata.postId}`
  }

  if (metadata.mediaId) {
    return `/media/${metadata.mediaId}`
  }

  switch (notification?.type) {
    case "episode":
    case "preair":
    case "digest":
      return "/calendar"
    case "discover":
      return "/discover"
    case "list":
      return "/lists"
    case "favorite":
      return metadata.mediaId ? `/media/${metadata.mediaId}` : "/profile"
    case "follow":
    case "post":
    case "mute":
      return "/community"
    case "report":
      return "/community"
    default:
      return "/settings"
  }
}

const getNotificationIcon = (type?: string) => {
  switch (type) {
    case "episode":
    case "preair":
    case "digest":
      return Calendar
    case "favorite":
      return Heart
    case "list":
      return Bookmark
    case "follow":
      return Users
    case "post":
      return MessageCircle
    case "discover":
      return Sparkles
    case "report":
      return ShieldAlert
    default:
      return BellRing
  }
}

const getNotificationAccent = (type?: string) => {
  switch (type) {
    case "episode":
    case "preair":
    case "digest":
      return "text-cyan-300 bg-cyan-500/10"
    case "favorite":
      return "text-rose-300 bg-rose-500/10"
    case "list":
      return "text-emerald-300 bg-emerald-500/10"
    case "follow":
      return "text-violet-300 bg-violet-500/10"
    case "post":
      return "text-fuchsia-300 bg-fuchsia-500/10"
    case "discover":
      return "text-amber-300 bg-amber-500/10"
    case "report":
      return "text-orange-300 bg-orange-500/10"
    default:
      return "text-white/80 bg-white/10"
  }
}

export function NotificationsMenu({ user }: NotificationsMenuProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [notifications, setNotifications] = React.useState<NotificationEntry[]>([])
  const userId = user?.id || null
  const preferences = user?.user_metadata?.notification_preferences || {}

  const loadNotifications = React.useCallback(() => {
    if (!userId) {
      setNotifications([])
      return
    }
    setNotifications(getNotifications(userId))
  }, [userId])

  React.useEffect(() => {
    loadNotifications()
    return subscribeNotifications(loadNotifications)
  }, [loadNotifications])

  React.useEffect(() => {
    if (!user) return
    const notifyEpisodes =
      preferences.pushNewEpisode ?? preferences.emailNewEpisode ?? user?.user_metadata?.notify_episode ?? true
    const notifyPreAir = preferences.pushAiring ?? user?.user_metadata?.notify_pre_air ?? true
    const notifyDigest = preferences.emailWeeklyDigest ?? user?.user_metadata?.notify_digest ?? false
    let cancelled = false

    const runScheduling = () => {
      if (cancelled) return
      void scheduleEpisodeNotifications({
        user,
        notifyEpisodes,
        notifyPreAir,
        notifyDigest,
      }).finally(() => {
        if (!cancelled) {
          loadNotifications()
        }
      })
    }

    const timeoutId = window.setTimeout(runScheduling, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [
    user,
    loadNotifications,
    preferences.emailNewEpisode,
    preferences.emailWeeklyDigest,
    preferences.pushAiring,
    preferences.pushNewEpisode,
  ])

  const unreadCount = React.useMemo(
    () => notifications.filter((item) => item?.unread).length,
    [notifications],
  )

  const handleMarkAllRead = () => {
    if (!userId) return
    markAllNotificationsRead(userId)
    loadNotifications()
  }

  const handleNotificationClick = (notification: NotificationEntry) => {
    if (!userId) return
    markNotificationRead(userId, notification.id)
    setOpen(false)
    router.push(getNotificationHref(notification))
  }

  if (!user) return null

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) loadNotifications()
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-xl hover:bg-primary/10"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
              <span className="sr-only">{unreadCount} unread notifications</span>
            </>
          ) : (
            <span className="sr-only">Notifications</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[360px] rounded-3xl border-white/10 bg-[#07111c]/95 p-0 text-white shadow-2xl shadow-black/40 backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">Notifications</p>
            <p className="text-xs text-white/45">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl px-2.5 text-xs text-white/65 hover:bg-white/10 hover:text-white"
              onClick={handleMarkAllRead}
              disabled={!notifications.length || unreadCount === 0}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Mark all
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl text-white/65 hover:bg-white/10 hover:text-white"
              onClick={() => {
                setOpen(false)
                router.push("/settings")
              }}
            >
              <Settings2 className="h-4 w-4" />
              <span className="sr-only">Notification settings</span>
            </Button>
          </div>
        </div>

        {notifications.length ? (
          <ScrollArea className="h-[360px]">
            <div className="space-y-2 p-3">
              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type)
                const href = getNotificationHref(notification)

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "w-full rounded-2xl border border-white/8 bg-white/[0.035] p-3 text-left transition-all hover:border-white/15 hover:bg-white/[0.06]",
                      notification.unread && "border-primary/20 bg-primary/[0.06]",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl",
                          getNotificationAccent(notification.type),
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="line-clamp-1 text-sm font-semibold text-white">{notification.title}</p>
                            {notification.message ? (
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/58">
                                {notification.message}
                              </p>
                            ) : null}
                          </div>
                          {notification.unread ? (
                            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                          ) : null}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                            {formatRelativeTime(notification.created_at)}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-[0.18em] text-white/45"
                          >
                            {notification.type || "system"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="px-5 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-white/[0.04]">
              <BellRing className="h-6 w-6 text-white/45" />
            </div>
            <p className="mt-4 text-sm font-medium text-white">Nothing new yet</p>
            <p className="mt-1 text-xs leading-5 text-white/45">
              New episode alerts, social updates, reports, and list activity will show up here.
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
