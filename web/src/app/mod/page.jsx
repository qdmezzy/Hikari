"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ModNavigation } from "@/components/ModNavigation"
import RequireAuth from "@/components/RequireAuth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  Flag,
  Flame,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Zap,
  EyeOff,
  Shield,
} from "lucide-react"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"

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

const shortId = (value) => {
  if (!value) return ""
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

const reasonType = (reason) => {
  const value = (reason || "").toLowerCase()
  if (value.includes("spoiler")) return "spoiler"
  if (value.includes("harass") || value.includes("abuse")) return "harassment"
  if (value.includes("spam")) return "spam"
  return "other"
}

const priorityConfig = {
  high: { color: "bg-red-500 text-white" },
  medium: { color: "bg-amber-500 text-white" },
  low: { color: "bg-secondary text-muted-foreground" },
}

const typeConfig = {
  spoiler: { icon: EyeOff, color: "text-primary", bg: "bg-primary/10" },
  harassment: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
  spam: { icon: Flame, color: "text-amber-400", bg: "bg-amber-500/10" },
  other: { icon: Flag, color: "text-muted-foreground", bg: "bg-secondary/50" },
}

const activityColors = {
  remove: "bg-red-500",
  spoiler: "bg-primary",
  dismiss: "bg-amber-500",
  escalate: "bg-red-500",
  resolved: "bg-emerald-500",
}

export default function ModDashboardPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState([])
  const [removedCount, setRemovedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!user) return
    let isActive = true

    const loadData = async () => {
      setLoading(true)
      setError("")

      const reportsPromise = client
        .from("social_reports")
        .select(
          `
          id,
          post_id,
          reporter_id,
          reason,
          status,
          created_at,
          resolved_at,
          resolved_by,
          resolution_action,
          target_type,
          target_id,
          target_label,
          target_user_handle,
          target_user_display_name,
          social_posts (
            id,
            content,
            fandom,
            attached_media_title,
            user_handle,
            user_display_name
          )
        `,
        )
        .order("created_at", { ascending: false })
        .limit(200)

      const removedPromise = client
        .from("social_posts")
        .select("id", { count: "exact", head: true })
        .eq("is_removed", true)

      const [{ data: reportRows, error: reportError }, { count: removedTotal, error: removedError }] =
        await Promise.all([reportsPromise, removedPromise])

      if (!isActive) return

      if (reportError) {
        console.error("Failed to load reports:", reportError)
        setError(reportError.message || "Could not load moderation data.")
        setLoading(false)
        return
      }

      if (removedError) {
        console.error("Failed to load removals:", removedError)
      }

      setReports(reportRows || [])
      setRemovedCount(removedTotal || 0)
      setLoading(false)
    }

    loadData()

    return () => {
      isActive = false
    }
  }, [user])

  const reportCounts = useMemo(() => {
    const counts = new Map()
    reports.forEach((report) => {
      const targetKey = report.target_id || report.post_id
      if (!targetKey) return
      counts.set(targetKey, (counts.get(targetKey) || 0) + 1)
    })
    return counts
  }, [reports])

  const pendingReports = useMemo(
    () => reports.filter((report) => (report.status || "pending") === "pending"),
    [reports],
  )

  const resolvedReports = useMemo(
    () => reports.filter((report) => (report.status || "pending") !== "pending"),
    [reports],
  )

  const todayStart = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return start.getTime()
  }, [])

  const resolvedToday = useMemo(() => {
    return resolvedReports.filter((report) => {
      if (!report.resolved_at) return false
      return new Date(report.resolved_at).getTime() >= todayStart
    })
  }, [resolvedReports, todayStart])

  const removedToday = useMemo(() => {
    return resolvedToday.filter((report) => report.resolution_action === "remove").length
  }, [resolvedToday])

  const approvalRate = useMemo(() => {
    const approved = resolvedToday.filter((report) => report.status === "resolved").length
    const total = resolvedToday.length
    if (!total) return 0
    return Math.round((approved / total) * 100)
  }, [resolvedToday])

  const activeReporters = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const reporterIds = new Set(
      reports
        .filter((report) => new Date(report.created_at).getTime() >= cutoff)
        .map((report) => report.reporter_id)
        .filter(Boolean),
    )
    return reporterIds.size
  }, [reports])

  const avgResponseMinutes = useMemo(() => {
    const resolvedWithTime = resolvedReports.filter((report) => report.resolved_at && report.created_at)
    if (!resolvedWithTime.length) return null
    const totalMinutes = resolvedWithTime.reduce((sum, report) => {
      const diff = new Date(report.resolved_at).getTime() - new Date(report.created_at).getTime()
      return sum + diff / 60000
    }, 0)
    return Math.round(totalMinutes / resolvedWithTime.length)
  }, [resolvedReports])

  const recentReports = useMemo(() => pendingReports.slice(0, 5), [pendingReports])

  const modActivity = useMemo(() => {
    return [...resolvedReports]
      .sort((a, b) => new Date(b.resolved_at || 0).getTime() - new Date(a.resolved_at || 0).getTime())
      .slice(0, 6)
      .map((report) => ({
        id: report.id,
        action: report.resolution_action || report.status || "resolved",
        target:
          report.target_user_handle ||
          report.target_user_display_name ||
          report.social_posts?.user_handle ||
          report.social_posts?.user_display_name ||
          shortId(report.target_id || report.post_id),
        mod: report.resolved_by === user?.id ? "You" : shortId(report.resolved_by),
        time: formatRelativeTime(report.resolved_at),
      }))
  }, [resolvedReports, user?.id])

  const reportBreakdown = useMemo(() => {
    return reports.reduce(
      (acc, report) => {
        const type = reasonType(report.reason)
        acc[type] = (acc[type] || 0) + 1
        return acc
      },
      { spoiler: 0, harassment: 0, spam: 0, other: 0 },
    )
  }, [reports])

  const stats = useMemo(() => {
    return [
      {
        label: "Pending Reports",
        value: pendingReports.length,
        icon: Flag,
        change: pendingReports.length ? `${pendingReports.length} awaiting review` : "All clear",
        color: "from-red-500/20 to-red-500/5",
        iconColor: "text-red-400",
        iconBg: "bg-red-500/10",
      },
      {
        label: "Reviewed Today",
        value: resolvedToday.length,
        icon: CheckCircle,
        change: resolvedToday.length ? `${approvalRate}% resolved` : "No reviews yet",
        color: "from-emerald-500/20 to-emerald-500/5",
        iconColor: "text-emerald-400",
        iconBg: "bg-emerald-500/10",
      },
      {
        label: "Posts Removed",
        value: removedCount,
        icon: Trash2,
        change: removedToday ? `${removedToday} today` : "No removals today",
        color: "from-amber-500/20 to-amber-500/5",
        iconColor: "text-amber-400",
        iconBg: "bg-amber-500/10",
      },
      {
        label: "Active Reporters",
        value: activeReporters,
        icon: Users,
        change: "Last 7 days",
        color: "from-blue-500/20 to-blue-500/5",
        iconColor: "text-blue-400",
        iconBg: "bg-blue-500/10",
      },
    ]
  }, [pendingReports.length, resolvedToday.length, approvalRate, removedCount, removedToday, activeReporters])

  const breakdownItems = [
    { label: "Spoilers", value: reportBreakdown.spoiler, color: "from-purple-500 to-indigo-500" },
    { label: "Harassment", value: reportBreakdown.harassment, color: "from-red-500 to-rose-500" },
    { label: "Spam", value: reportBreakdown.spam, color: "from-amber-500 to-orange-500" },
    { label: "Other", value: reportBreakdown.other, color: "from-slate-500 to-zinc-500" },
  ]

  const totalReports = reports.length || 1

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background noise-overlay">
        <ModNavigation />

        <main className="pb-24 md:pb-8">
          <div className="px-4 py-6 md:px-8">
            <div className="mx-auto max-w-7xl">
              {/* Header */}
              <div
                className="relative mb-8 overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 p-6 md:p-8"
                style={{
                  animation: "fade-in-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                  opacity: 0,
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/20 via-transparent to-transparent opacity-50" />

                <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                      <Shield className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-foreground md:text-3xl">
                        Welcome back, <span className="text-emerald-400">Mod</span>
                      </h1>
                      <p className="text-muted-foreground">Keep the community safe and friendly</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-background/80 backdrop-blur border border-border/50">
                      <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
                      <span className="text-sm text-muted-foreground">Avg. response:</span>
                      <span className="font-bold text-foreground">
                        {avgResponseMinutes !== null ? `${avgResponseMinutes} min` : "—"}
                      </span>
                    </div>
                    <Link href="/mod/queue">
                      <Button className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-90 shadow-lg shadow-emerald-500/25">
                        <Flag className="h-4 w-4" />
                        View Queue
                        <Badge className="ml-1 bg-white/20 text-white">{pendingReports.length}</Badge>
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                {stats.map((stat, index) => {
                  const Icon = stat.icon
                  return (
                    <Card
                      key={stat.label}
                      className="bg-card/50 border-border/50 card-interactive group overflow-hidden"
                      style={{
                        animation: "fade-in-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                        animationDelay: `${index * 80}ms`,
                        opacity: 0,
                      }}
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-100 transition-opacity`}
                      />
                      <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                        <div className={`rounded-xl p-2.5 ${stat.iconBg} group-hover:scale-110 transition-transform`}>
                          <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                        </div>
                      </CardHeader>
                      <CardContent className="relative">
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold text-foreground">
                            {loading ? "—" : stat.value}
                          </span>
                          <TrendingUp className="mb-1 h-4 w-4 text-emerald-400" />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Main Content */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Recent Reports */}
                <div className="lg:col-span-2">
                  <Card className="bg-card/50 border-border/50 overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                          <Flame className="h-4 w-4 text-red-400" />
                        </div>
                        <CardTitle>Recent Reports</CardTitle>
                      </div>
                      <Link href="/mod/queue">
                        <Button variant="ghost" size="sm" className="gap-1 text-primary group">
                          View All
                          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                      {loading ? (
                        <div className="p-6 text-sm text-muted-foreground">Loading reports...</div>
                      ) : error ? (
                        <div className="p-6 text-sm text-muted-foreground">{error}</div>
                      ) : recentReports.length === 0 ? (
                        <div className="p-6 text-sm text-muted-foreground">No pending reports.</div>
                      ) : (
                        recentReports.map((report, index) => {
                          const type = reasonType(report.reason)
                          const TypeIcon = typeConfig[type]?.icon || Flag
                          const post = report.social_posts || {}
                          const targetKey = report.target_id || report.post_id
                          const reportCount = reportCounts.get(targetKey) || 1
                          const priority =
                            reportCount >= 3 ? "high" : reportCount >= 2 ? "medium" : "low"
                          const label =
                            report.target_label ||
                            post.attached_media_title ||
                            post.fandom ||
                            post.content?.slice(0, 60) ||
                            "General"
                          const authorLabel =
                            report.target_user_handle ||
                            report.target_user_display_name ||
                            post.user_handle ||
                            post.user_display_name ||
                            "Unknown"
                          return (
                            <div
                              key={report.id}
                              className="group flex items-start gap-4 border-b border-border/30 p-4 hover:bg-secondary/30 transition-all last:border-0 cursor-pointer animate-fade-in-up opacity-0"
                              style={{ animationDelay: `${index * 50}ms`, animationFillMode: "forwards" }}
                            >
                              <div
                                className={`flex h-11 w-11 items-center justify-center rounded-xl ${typeConfig[type]?.bg} group-hover:scale-110 transition-transform`}
                              >
                                <TypeIcon className={`h-5 w-5 ${typeConfig[type]?.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="capitalize text-xs">
                                    {type}
                                  </Badge>
                                  <Badge className={priorityConfig[priority].color}>{priority}</Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {label}
                                  </Badge>
                                </div>
                                <p className="mt-1.5 text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                  {post.content || report.target_label || "Content unavailable."}
                                </p>
                                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                                  <span>@{authorLabel}</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatRelativeTime(report.created_at)}
                                  </span>
                                </div>
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                            </div>
                          )
                        })
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Quick Actions */}
                  <Card className="bg-card/50 border-border/50">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-400" />
                        <CardTitle className="text-lg">Quick Actions</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2">
                      {[
                        {
                          icon: Flag,
                          label: "Reports",
                          href: "/mod/queue",
                          color: "hover:border-red-500/50 hover:bg-red-500/5",
                          iconColor: "text-red-400",
                        },
                        {
                          icon: EyeOff,
                          label: "Spoilers",
                          href: "/mod/queue",
                          color: "hover:border-primary/50 hover:bg-primary/5",
                          iconColor: "text-primary",
                        },
                        {
                          icon: Users,
                          label: "Users",
                          href: "/mod/users",
                          color: "hover:border-blue-500/50 hover:bg-blue-500/5",
                          iconColor: "text-blue-400",
                        },
                        {
                          icon: Target,
                          label: "Trends",
                          href: "/mod/stats",
                          color: "hover:border-emerald-500/50 hover:bg-emerald-500/5",
                          iconColor: "text-emerald-400",
                        },
                      ].map((action) => {
                        const ActionIcon = action.icon
                        return (
                          <Button
                            key={action.label}
                            asChild
                            variant="outline"
                            className={`h-auto flex-col gap-2 py-4 bg-transparent border-border/50 transition-all ${action.color}`}
                          >
                            <Link href={action.href}>
                              <ActionIcon className={`h-5 w-5 ${action.iconColor}`} />
                              <span className="text-xs">{action.label}</span>
                            </Link>
                          </Button>
                        )
                      })}
                    </CardContent>
                  </Card>

                  {/* Team Activity */}
                  <Card className="bg-card/50 border-border/50">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-emerald-400" />
                        <CardTitle className="text-lg">Team Activity</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {loading ? (
                        <p className="text-sm text-muted-foreground">Loading activity...</p>
                      ) : modActivity.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No recent actions yet.</p>
                      ) : (
                        modActivity.map((activity, i) => (
                          <div
                            key={activity.id}
                            className="flex items-start gap-3 animate-fade-in-up opacity-0"
                            style={{ animationDelay: `${i * 100}ms`, animationFillMode: "forwards" }}
                          >
                            <div className={`mt-1.5 h-2.5 w-2.5 rounded-full ${activityColors[activity.action] || "bg-emerald-500"}`} />
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-medium text-foreground">{activity.mod}</span>
                                <span className="text-muted-foreground"> {activity.action} </span>
                                <span className="text-primary">@{activity.target}</span>
                              </p>
                              <p className="text-xs text-muted-foreground">{activity.time}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  {/* Report Breakdown */}
                  <Card className="bg-card/50 border-border/50">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-amber-400" />
                        <CardTitle className="text-lg">Report Breakdown</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {breakdownItems.map((item) => (
                        <div key={item.label} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-semibold text-foreground">{item.value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
                              style={{ width: `${Math.min((item.value / totalReports) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </RequireAuth>
  )
}
