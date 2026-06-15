"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ModNavigation } from "@/components/layout/ModNavigation"
import RequireAuth from "@/components/common/RequireAuth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { AlertTriangle, Ban, CheckCircle, EyeOff, Gavel, ShieldAlert, Trash2, XCircle } from "lucide-react"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { fetchBanAppeals, reviewBanAppeal } from "@/lib/admin-service"

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
  other: { label: "Other", color: "bg-secondary text-muted-foreground", icon: AlertTriangle },
}

export default function ModAppealsPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [workingId, setWorkingId] = useState("")
  const [banAppeals, setBanAppeals] = useState([])
  const [appealsLoading, setAppealsLoading] = useState(true)
  const [appealWorkingId, setAppealWorkingId] = useState("")

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
          user_display_name,
          has_spoilers,
          is_removed
        )
      `,
      )
      .eq("status", "escalated")
      .order("created_at", { ascending: false })
      .limit(200)

    if (loadError) {
      console.error("Failed to load appeals:", loadError)
      setError(loadError.message || "Could not load appeals.")
      setLoading(false)
      return
    }

    setReports(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const loadBanAppeals = useCallback(async () => {
    if (!user) return
    setAppealsLoading(true)
    try {
      const data = await fetchBanAppeals()
      setBanAppeals(data)
    } catch (err) {
      console.error("Failed to load ban appeals:", err)
    } finally {
      setAppealsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadBanAppeals()
  }, [loadBanAppeals])

  const handleReviewAppeal = async (appeal, approve) => {
    setAppealWorkingId(appeal.id)
    try {
      let note = null
      if (!approve && typeof window !== "undefined") {
        note = window.prompt("Optional note to the user explaining the denial:") || null
      }
      await reviewBanAppeal(appeal.id, approve, note)
      await loadBanAppeals()
    } catch (err) {
      console.error("Failed to review appeal:", err)
      setError(err.message || "Could not review appeal.")
    } finally {
      setAppealWorkingId("")
    }
  }

  const pendingBanAppeals = banAppeals.filter((a) => a.status === "pending")

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase()
    return reports.filter((report) => {
      if (!query) return true
      const post = report.social_posts || {}
      const haystack = [
        report.reason,
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
  }, [reports, search])

  const updateReport = async (report, action) => {
    if (!user) return
    setWorkingId(report.id)
    const now = new Date().toISOString()
    const targetType = report.target_type || "social_post"
    const targetId = report.target_id || report.post_id

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

      const nextStatus = action === "dismiss" ? "dismissed" : "resolved"

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
      console.error("Failed to update appeal:", err)
      setError(err.message || "Could not update appeal.")
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
            <div className="mx-auto max-w-6xl space-y-6">
              <Card className="bg-card/60 border-border/50">
                <CardHeader className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Gavel className="h-5 w-5 text-primary" />
                    <CardTitle className="text-2xl">Ban Appeals</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Suspended users requesting reinstatement. Approving an appeal lifts the ban.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {appealsLoading ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Loading appeals…</p>
                  ) : pendingBanAppeals.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No pending appeals.</p>
                  ) : (
                    pendingBanAppeals.map((appeal) => (
                      <div key={appeal.id} className="rounded-2xl border border-border/50 bg-background/40 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <Ban className="h-4 w-4 text-destructive" />
                              <span className="font-mono text-xs text-muted-foreground">{appeal.user_id.slice(0, 8)}…</span>
                              <span className="text-xs text-muted-foreground">{formatRelativeTime(appeal.created_at)}</span>
                            </div>
                            <p className="text-sm text-foreground">{appeal.message}</p>
                          </div>
                          <div className="flex flex-shrink-0 gap-2">
                            <Button
                              size="sm"
                              disabled={appealWorkingId === appeal.id}
                              onClick={() => handleReviewAppeal(appeal, true)}
                            >
                              <CheckCircle className="mr-1.5 h-4 w-4" />
                              Approve &amp; unban
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={appealWorkingId === appeal.id}
                              onClick={() => handleReviewAppeal(appeal, false)}
                            >
                              <XCircle className="mr-1.5 h-4 w-4" />
                              Deny
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border/50">
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-2xl">Escalated Reports</CardTitle>
                    <p className="text-sm text-muted-foreground">High priority reviews that need a decision.</p>
                  </div>
                  <div className="text-xs text-muted-foreground">{reports.length} escalations</div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search escalations..."
                    className="max-w-md"
                  />
                </CardContent>
              </Card>

              {loading ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">Loading escalations...</CardContent>
                </Card>
              ) : error ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">{error}</CardContent>
                </Card>
              ) : filteredReports.length === 0 ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No escalated reports.
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
                    const postLabel =
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
                                  <Badge variant="outline">{postLabel}</Badge>
                                </div>
                                <p className="text-sm text-foreground line-clamp-2">
                                  {post.content || report.target_label || "Content unavailable."}
                                </p>
                                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                                  <span>@{authorLabel}</span>
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
                                onClick={() => updateReport(report, "dismiss")}
                              >
                                <CheckCircle className="mr-1.5 h-4 w-4" />
                                Dismiss
                              </Button>
                              {canSpoiler && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={workingId === report.id || post.is_removed}
                                  onClick={() => updateReport(report, "spoiler")}
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
                                  onClick={() => updateReport(report, "remove")}
                                >
                                  <Trash2 className="mr-1.5 h-4 w-4" />
                                  {removeLabel}
                                </Button>
                              )}
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
