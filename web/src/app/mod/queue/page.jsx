"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ModNavigation } from "@/components/ModNavigation"
import RequireAuth from "@/components/RequireAuth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { AlertTriangle, CheckCircle, Flag, EyeOff, ShieldAlert, Trash2 } from "lucide-react"
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

const typeStyles = {
  spoiler: { label: "Spoiler", color: "bg-purple-500/20 text-purple-300", icon: EyeOff },
  harassment: { label: "Harassment", color: "bg-red-500/20 text-red-300", icon: ShieldAlert },
  spam: { label: "Spam", color: "bg-amber-500/20 text-amber-300", icon: AlertTriangle },
  other: { label: "Other", color: "bg-secondary text-muted-foreground", icon: Flag },
}

const statusStyles = {
  pending: "bg-amber-500/20 text-amber-300",
  escalated: "bg-red-500/20 text-red-300",
  resolved: "bg-emerald-500/20 text-emerald-300",
  dismissed: "bg-secondary text-muted-foreground",
}

export default function ModQueuePage() {
  const { user } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("pending")
  const [workingId, setWorkingId] = useState("")

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
        resolution_action,
        target_type,
        target_id,
        target_label,
        target_url,
        target_user_id,
        target_user_handle,
        target_user_display_name,
        target_user_avatar_url,
        social_posts (
          id,
          content,
          fandom,
          attached_media_title,
          user_handle,
          user_display_name,
          user_avatar_url,
          has_spoilers,
          is_removed
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(200)

    if (loadError) {
      console.error("Failed to load reports:", loadError)
      setError(loadError.message || "Could not load moderation queue.")
      setLoading(false)
      return
    }

    setReports(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const reportCounts = useMemo(() => {
    const counts = new Map()
    reports.forEach((report) => {
      const targetKey = report.target_id || report.post_id
      if (!targetKey) return
      counts.set(targetKey, (counts.get(targetKey) || 0) + 1)
    })
    return counts
  }, [reports])

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase()
    return reports.filter((report) => {
      const status = report.status || "pending"
      if (statusFilter && status !== statusFilter) return false
      if (!query) return true
      const post = report.social_posts || {}
      const haystack = [
        report.reason,
        post.content,
        post.user_handle,
        post.user_display_name,
        post.attached_media_title,
        report.reporter_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [reports, search, statusFilter])

  const countsByStatus = useMemo(() => {
    return reports.reduce(
      (acc, report) => {
        const status = report.status || "pending"
        acc[status] = (acc[status] || 0) + 1
        return acc
      },
      { pending: 0, escalated: 0, resolved: 0, dismissed: 0 },
    )
  }, [reports])

  const updateReportsStatus = async ({ report, action }) => {
    if (!user) return
    setWorkingId(report.id)

    const now = new Date().toISOString()
    const postId = report.post_id
    const targetType = report.target_type || "social_post"
    const targetId = report.target_id || postId
    const nextStatus =
      action === "dismiss"
        ? "dismissed"
        : action === "escalate"
          ? "escalated"
          : "resolved"

    try {
      if (action === "remove" && targetId) {
        if (targetType === "social_post") {
          const { error: removeError } = await client
            .from("social_posts")
            .update({
              is_removed: true,
              removed_at: now,
              removed_by: user.id,
              removed_reason: report.reason || "moderation",
            })
            .eq("id", targetId)

          if (removeError) {
            throw removeError
          }
        }

        if (targetType === "review") {
          const { error: removeError } = await client
            .from("reviews")
            .update({
              is_removed: true,
              removed_at: now,
              removed_by: user.id,
              removed_reason: report.reason || "moderation",
            })
            .eq("id", targetId)

          if (removeError) {
            throw removeError
          }
        }

        if (targetType === "clip_comment") {
          const { error: removeError } = await client
            .from("clip_comments")
            .update({
              is_removed: true,
              removed_at: now,
              removed_by: user.id,
              removed_reason: report.reason || "moderation",
            })
            .eq("id", targetId)

          if (removeError) {
            throw removeError
          }
        }

        if (targetType === "clip") {
          const { error: removeError } = await client
            .from("fandom_clips")
            .update({
              is_removed: true,
              removed_at: now,
              removed_by: user.id,
              removed_reason: report.reason || "moderation",
            })
            .eq("id", targetId)

          if (removeError) {
            throw removeError
          }
        }
      }

      if (action === "spoiler" && targetType === "social_post" && targetId) {
        const { error: spoilerError } = await client
          .from("social_posts")
          .update({ has_spoilers: true })
          .eq("id", targetId)

        if (spoilerError) {
          throw spoilerError
        }
      }

      const { error: reportError } = await client
        .from("social_reports")
        .update({
          status: nextStatus,
          resolved_at: now,
          resolved_by: user.id,
          resolution_action: action,
        })
        .eq("id", report.id)

      if (reportError) {
        throw reportError
      }

      await loadReports()
    } catch (err) {
      console.error("Failed to update report:", err)
      setError(err.message || "Could not update report.")
    } finally {
      setWorkingId("")
    }
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <ModNavigation />
        <main className="pb-24 md:pb-8">
          <div className="px-4 py-6 md:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <Card className="bg-card/60 border-border/50">
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-2xl">Moderation Queue</CardTitle>
                    <p className="text-sm text-muted-foreground">Review incoming reports and take action.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {["pending", "escalated", "resolved", "dismissed"].map((status) => (
                      <Button
                        key={status}
                        variant={statusFilter === status ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setStatusFilter(status)}
                      >
                        {status}
                        <Badge className="ml-2 bg-muted text-muted-foreground">
                          {countsByStatus[status] || 0}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search reports, posts, or users..."
                    className="max-w-md"
                  />
                  <div className="text-xs text-muted-foreground">
                    {filteredReports.length} of {reports.length} reports
                  </div>
                </CardContent>
              </Card>

              {loading ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">Loading reports...</CardContent>
                </Card>
              ) : error ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">{error}</CardContent>
                </Card>
              ) : filteredReports.length === 0 ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No reports found for this filter.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredReports.map((report) => {
                    const type = reasonType(report.reason)
                    const typeConfig = typeStyles[type]
                    const TypeIcon = typeConfig.icon
                    const post = report.social_posts || {}
                    const targetType = report.target_type || (report.post_id ? "social_post" : "content")
                    const targetKey = report.target_id || report.post_id
                    const targetLabel =
                      report.target_label ||
                      post.attached_media_title ||
                      post.fandom ||
                      post.content?.slice(0, 120) ||
                      "Reported content"
                    const targetUrl = report.target_url || (targetType === "social_post" && report.post_id ? `/social/${report.post_id}` : "")
                    const authorLabel =
                      report.target_user_handle ||
                      report.target_user_display_name ||
                      post.user_handle ||
                      post.user_display_name ||
                      "Unknown"
                    const reportCount = reportCounts.get(targetKey) || 1
                    const priority =
                      reportCount >= 3 ? "high" : reportCount >= 2 ? "medium" : "low"
                    const canSpoiler = targetType === "social_post" && !!report.post_id
                    const canRemove = ["social_post", "review", "clip_comment", "clip"].includes(targetType) && !!targetKey
                    const removeLabel =
                      targetType === "review"
                        ? "Remove Review"
                        : targetType === "clip_comment"
                          ? "Remove Comment"
                          : targetType === "clip"
                            ? "Remove Clip"
                            : "Remove Post"
                    return (
                      <Card key={report.id} className="bg-card/50 border-border/50">
                        <CardContent className="p-5 space-y-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${typeConfig.color}`}>
                                <TypeIcon className="h-5 w-5" />
                              </div>
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                                  <Badge className={statusStyles[report.status || "pending"]}>
                                    {report.status || "pending"}
                                  </Badge>
                                  <Badge variant="outline" className="uppercase text-[10px]">
                                    {targetType.replace("_", " ")}
                                  </Badge>
                                  <Badge variant="outline">{targetLabel}</Badge>
                                  <Badge variant="secondary">Priority: {priority}</Badge>
                                </div>
                                <p className="text-sm text-foreground line-clamp-2">
                                  {post.content || report.target_label || "Content unavailable."}
                                </p>
                                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                                  <span>Reported: {shortId(report.reporter_id)}</span>
                                  <span>Author: {authorLabel}</span>
                                  <span>{formatRelativeTime(report.created_at)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {targetUrl ? (
                                <Button asChild variant="outline" size="sm">
                                  <Link href={targetUrl}>Open</Link>
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" disabled>
                                  Open
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={workingId === report.id}
                                onClick={() => updateReportsStatus({ report, action: "dismiss" })}
                              >
                                <CheckCircle className="mr-1.5 h-4 w-4" />
                                Dismiss
                              </Button>
                              {canSpoiler && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={workingId === report.id || post.is_removed}
                                  onClick={() => updateReportsStatus({ report, action: "spoiler" })}
                                >
                                  <EyeOff className="mr-1.5 h-4 w-4" />
                                  Mark Spoiler
                                </Button>
                              )}
                              {canRemove && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={workingId === report.id || post.is_removed}
                                  onClick={() => updateReportsStatus({ report, action: "remove" })}
                                >
                                  <Trash2 className="mr-1.5 h-4 w-4" />
                                  {removeLabel}
                                </Button>
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={workingId === report.id}
                                onClick={() => updateReportsStatus({ report, action: "escalate" })}
                              >
                                Escalate
                              </Button>
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
