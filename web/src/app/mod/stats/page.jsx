"use client"

import { useEffect, useMemo, useState } from "react"
import { ModNavigation } from "@/components/ModNavigation"
import RequireAuth from "@/components/RequireAuth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Clock, Flag, TrendingUp, Users } from "lucide-react"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"

const reasonType = (reason) => {
  const value = (reason || "").toLowerCase()
  if (value.includes("spoiler")) return "spoiler"
  if (value.includes("harass") || value.includes("abuse")) return "harassment"
  if (value.includes("spam")) return "spam"
  return "other"
}

export default function ModStatsPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!user) return
    let isActive = true

    const loadStats = async () => {
      setLoading(true)
      setError("")

      const { data, error: loadError } = await client
        .from("social_reports")
        .select("id, status, reason, created_at, resolved_at")
        .order("created_at", { ascending: false })
        .limit(1000)

      if (!isActive) return

      if (loadError) {
        console.error("Failed to load stats:", loadError)
        setError(loadError.message || "Could not load stats.")
        setLoading(false)
        return
      }

      setReports(data || [])
      setLoading(false)
    }

    loadStats()

    return () => {
      isActive = false
    }
  }, [user])

  const stats = useMemo(() => {
    const pending = reports.filter((report) => (report.status || "pending") === "pending").length
    const resolved = reports.filter((report) => report.status === "resolved").length
    const dismissed = reports.filter((report) => report.status === "dismissed").length
    const escalated = reports.filter((report) => report.status === "escalated").length
    const total = reports.length

    const avgResponse = (() => {
      const resolvedReports = reports.filter((report) => report.resolved_at && report.created_at)
      if (!resolvedReports.length) return null
      const totalMinutes = resolvedReports.reduce((sum, report) => {
        return sum + (new Date(report.resolved_at).getTime() - new Date(report.created_at).getTime()) / 60000
      }, 0)
      return Math.round(totalMinutes / resolvedReports.length)
    })()

    return { total, pending, resolved, dismissed, escalated, avgResponse }
  }, [reports])

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

  const breakdownItems = [
    { label: "Spoilers", value: reportBreakdown.spoiler, color: "from-purple-500 to-indigo-500" },
    { label: "Harassment", value: reportBreakdown.harassment, color: "from-red-500 to-rose-500" },
    { label: "Spam", value: reportBreakdown.spam, color: "from-amber-500 to-orange-500" },
    { label: "Other", value: reportBreakdown.other, color: "from-slate-500 to-zinc-500" },
  ]

  const totalReports = reports.length || 1

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <ModNavigation />
        <main className="pb-24 md:pb-8">
          <div className="px-4 py-6 md:px-8">
            <div className="mx-auto max-w-6xl space-y-6">
              <Card className="bg-card/60 border-border/50">
                <CardHeader>
                  <CardTitle className="text-2xl">Moderation Stats</CardTitle>
                  <p className="text-sm text-muted-foreground">Health and performance of the moderation queue.</p>
                </CardHeader>
              </Card>

              {loading ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">Loading stats...</CardContent>
                </Card>
              ) : error ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">{error}</CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: "Total Reports", value: stats.total, icon: Flag },
                      { label: "Pending", value: stats.pending, icon: AlertTriangle },
                      { label: "Resolved", value: stats.resolved, icon: TrendingUp },
                      { label: "Dismissed", value: stats.dismissed, icon: Users },
                    ].map((stat) => {
                      const Icon = stat.icon
                      return (
                        <Card key={stat.label} className="bg-card/50 border-border/50">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-muted-foreground">{stat.label}</p>
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="mt-3 text-2xl font-semibold text-foreground">{stat.value}</p>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>

                  <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="bg-card/50 border-border/50 lg:col-span-2">
                      <CardHeader>
                        <CardTitle>Report Reasons</CardTitle>
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

                    <Card className="bg-card/50 border-border/50">
                      <CardHeader>
                        <CardTitle>Response Time</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <span className="text-sm text-muted-foreground">Average response</span>
                        </div>
                        <p className="text-3xl font-semibold text-foreground">
                          {stats.avgResponse !== null ? `${stats.avgResponse}m` : "—"}
                        </p>
                        <Badge variant="secondary">
                          {stats.escalated} escalations pending
                        </Badge>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </RequireAuth>
  )
}
