"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ModNavigation } from "@/components/layout/ModNavigation"
import RequireAuth from "@/components/common/RequireAuth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle, Clock } from "lucide-react"
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

const statusColors = {
  resolved: "bg-emerald-500/20 text-emerald-300",
  dismissed: "bg-amber-500/20 text-amber-300",
  escalated: "bg-red-500/20 text-red-300",
}

export default function ModHistoryPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const loadReports = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError("")

    const { data, error: loadError } = await client
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
        target_url,
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
      .neq("status", "pending")
      .order("resolved_at", { ascending: false })
      .limit(300)

    if (loadError) {
      console.error("Failed to load moderation history:", loadError)
      setError(loadError.message || "Could not load moderation history.")
      setLoading(false)
      return
    }

    setReports(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase()
    return reports.filter((report) => {
      if (statusFilter !== "all" && report.status !== statusFilter) return false
      if (!query) return true
      const post = report.social_posts || {}
      const haystack = [
        report.reason,
        report.resolution_action,
        post.content,
        post.user_handle,
        post.user_display_name,
        post.attached_media_title,
        report.target_label,
        report.target_user_handle,
        report.target_user_display_name,
        report.reporter_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [reports, search, statusFilter])

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <ModNavigation />
        <main className="pb-24 md:pb-8">
          <h1 className="sr-only">Moderation history</h1>
          <div className="px-4 py-6 md:px-8">
            <div className="mx-auto max-w-6xl space-y-6">
              <Card className="bg-card/60 border-border/50">
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-2xl">Moderation Log</CardTitle>
                    <p className="text-sm text-muted-foreground">Every resolved report and its outcome.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {["all", "resolved", "dismissed", "escalated"].map((status) => (
                      <Button
                        key={status}
                        variant={statusFilter === status ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setStatusFilter(status)}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search history..."
                    className="max-w-md"
                  />
                  <div className="text-xs text-muted-foreground">{filteredReports.length} entries</div>
                </CardContent>
              </Card>

              {loading ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">Loading history...</CardContent>
                </Card>
              ) : error ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">{error}</CardContent>
                </Card>
              ) : filteredReports.length === 0 ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">No history yet.</CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredReports.map((report) => {
                    const post = report.social_posts || {}
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
                    const targetUrl = report.target_url || (report.post_id ? `/community/${report.post_id}` : "")
                    return (
                      <Card key={report.id} className="bg-card/50 border-border/50">
                        <CardContent className="p-5 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={statusColors[report.status] || "bg-secondary text-muted-foreground"}>
                              {report.status}
                            </Badge>
                            {report.resolution_action && (
                              <Badge variant="outline">{report.resolution_action}</Badge>
                            )}
                          <Badge variant="secondary">{label}</Badge>
                        </div>
                        <p className="text-sm text-foreground line-clamp-2">
                          {post.content || report.target_label || "Content unavailable."}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span>@{authorLabel}</span>
                          <span>Reporter: {shortId(report.reporter_id)}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(report.resolved_at || report.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {targetUrl ? (
                            <Button asChild variant="outline" size="sm">
                              <Link href={targetUrl}>Open</Link>
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled>
                              Open
                            </Button>
                          )}
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Resolved by {report.resolved_by === user?.id ? "You" : shortId(report.resolved_by)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </RequireAuth>
  )
}
