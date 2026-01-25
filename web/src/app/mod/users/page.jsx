"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ModNavigation } from "@/components/ModNavigation"
import RequireAuth from "@/components/RequireAuth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Clock, ShieldAlert, Trash2 } from "lucide-react"
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

export default function ModUsersPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [workingId, setWorkingId] = useState("")

  const loadUsers = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError("")

    const { data, error: loadError } = await client
      .from("social_reports")
      .select(
        `
        id,
        status,
        created_at,
        target_user_id,
        target_user_handle,
        target_user_display_name,
        target_user_avatar_url,
        social_posts (
          user_id,
          user_display_name,
          user_handle,
          user_avatar_url
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(500)

    if (loadError) {
      console.error("Failed to load reported users:", loadError)
      setError(loadError.message || "Could not load reported users.")
      setLoading(false)
      return
    }

    const byUser = new Map()
    ;(data || []).forEach((row) => {
      const postUser = row.social_posts
      const targetUserId = row.target_user_id || postUser?.user_id
      if (!targetUserId) return
      const entry = byUser.get(targetUserId) || {
        userId: targetUserId,
        displayName: row.target_user_display_name || postUser?.user_display_name || "Unknown",
        handle: row.target_user_handle || postUser?.user_handle || null,
        avatarUrl: row.target_user_avatar_url || postUser?.user_avatar_url || "",
        reportCount: 0,
        pendingCount: 0,
        lastReportAt: row.created_at,
      }
      entry.reportCount += 1
      if ((row.status || "pending") === "pending") {
        entry.pendingCount += 1
      }
      if (new Date(row.created_at).getTime() > new Date(entry.lastReportAt).getTime()) {
        entry.lastReportAt = row.created_at
      }
      byUser.set(targetUserId, entry)
    })

    const nextEntries = Array.from(byUser.values()).sort((a, b) => {
      if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount
      return new Date(b.lastReportAt).getTime() - new Date(a.lastReportAt).getTime()
    })

    setEntries(nextEntries)
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase()
    return entries.filter((entry) => {
      if (!query) return true
      return [entry.displayName, entry.handle, entry.userId].filter(Boolean).join(" ").toLowerCase().includes(query)
    })
  }, [entries, search])

  const removeAllPosts = async (entry) => {
    if (!user) return
    const confirmed = window.confirm(`Remove all posts from ${entry.displayName}?`)
    if (!confirmed) return
    setWorkingId(entry.userId)
    const now = new Date().toISOString()

    try {
      const { error: updateError } = await client
        .from("social_posts")
        .update({
          is_removed: true,
          removed_at: now,
          removed_by: user.id,
          removed_reason: "bulk removal",
        })
        .eq("user_id", entry.userId)

      if (updateError) {
        throw updateError
      }

      await loadUsers()
    } catch (err) {
      console.error("Failed to remove posts:", err)
      setError(err.message || "Could not remove posts.")
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
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-2xl">Reported Users</CardTitle>
                    <p className="text-sm text-muted-foreground">Users with reports on their posts.</p>
                  </div>
                  <div className="text-xs text-muted-foreground">{entries.length} users</div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search users..."
                    className="max-w-md"
                  />
                </CardContent>
              </Card>

              {loading ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">Loading users...</CardContent>
                </Card>
              ) : error ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">{error}</CardContent>
                </Card>
              ) : filteredEntries.length === 0 ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">No reported users yet.</CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredEntries.map((entry) => (
                    <Card key={entry.userId} className="bg-card/50 border-border/50">
                      <CardContent className="p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl overflow-hidden bg-secondary flex items-center justify-center">
                            {entry.avatarUrl ? (
                              <img src={entry.avatarUrl} alt={entry.displayName} className="h-full w-full object-cover" />
                            ) : (
                              <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{entry.displayName}</p>
                            <p className="text-xs text-muted-foreground">
                              {entry.handle ? `@${entry.handle}` : shortId(entry.userId)}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="secondary">{entry.reportCount} reports</Badge>
                              <Badge variant="outline">{entry.pendingCount} pending</Badge>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatRelativeTime(entry.lastReportAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/mod/queue`}>Review Reports</Link>
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={workingId === entry.userId}
                            onClick={() => removeAllPosts(entry)}
                          >
                            <Trash2 className="mr-1.5 h-4 w-4" />
                            Remove Posts
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </RequireAuth>
  )
}
