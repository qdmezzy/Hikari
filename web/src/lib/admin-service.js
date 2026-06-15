import client from "@/lib/client"

// Data layer for the moderator dashboard. All write actions are additionally
// enforced mod-only by RLS / SECURITY DEFINER functions on the database.

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const fetchAllUsers = async () => {
  // Preferred: full directory with roles via the admin RPC.
  const { data, error } = await client.rpc("admin_list_users")
  if (!error && Array.isArray(data)) {
    return data.map((u) => ({
      id: u.id,
      email: u.email || "",
      displayName: u.display_name || u.handle || "User",
      handle: u.handle || null,
      avatarUrl: u.avatar_url || "",
      isMod: Boolean(u.is_mod),
      isBanned: Boolean(u.is_banned),
      createdAt: u.created_at,
      rolesAvailable: true,
    }))
  }

  // Fallback (RPC not installed yet): public profiles, no role/email info.
  const { data: profiles, error: profileError } = await client
    .from("public_profiles")
    .select("user_id, display_name, handle, avatar_url, created_at")
    .order("created_at", { ascending: false })
    .limit(1000)

  if (profileError) {
    throw new Error(profileError.message || "Could not load users.")
  }

  return (profiles || []).map((p) => ({
    id: p.user_id,
    email: "",
    displayName: p.display_name || p.handle || "User",
    handle: p.handle || null,
    avatarUrl: p.avatar_url || "",
    isMod: false,
    isBanned: false,
    createdAt: p.created_at,
    rolesAvailable: false,
  }))
}

// ---------------------------------------------------------------------------
// Bans / appeals (RPCs are mod-gated server-side)
// ---------------------------------------------------------------------------
export const banUserAccount = async (userId, { reason, expiresAt } = {}) => {
  const { error } = await client.rpc("admin_ban_user", {
    target_user_id: userId,
    ban_reason: reason || null,
    ban_expires_at: expiresAt || null,
  })
  if (error) throw new Error(error.message || "Could not ban user.")
}

export const unbanUserAccount = async (userId) => {
  const { error } = await client.rpc("admin_unban_user", { target_user_id: userId })
  if (error) throw new Error(error.message || "Could not unban user.")
}

export const fetchBanAppeals = async () => {
  const { data, error } = await client
    .from("ban_appeals")
    .select("id, user_id, message, status, created_at, review_note, reviewed_at")
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message || "Could not load appeals.")
  return data || []
}

export const reviewBanAppeal = async (appealId, approve, note) => {
  const { error } = await client.rpc("admin_review_appeal", {
    appeal_id: appealId,
    approve: Boolean(approve),
    note: note || null,
  })
  if (error) throw new Error(error.message || "Could not review appeal.")
}

export const setUserMod = async (userId, makeMod) => {
  const { error } = await client.rpc("admin_set_user_mod", {
    target_user_id: userId,
    make_mod: makeMod,
  })
  if (error) throw new Error(error.message || "Could not change role.")
}

// ---------------------------------------------------------------------------
// Reports / moderation
// ---------------------------------------------------------------------------
export const fetchReports = async () => {
  const { data, error } = await client
    .from("social_reports")
    .select(
      `
      id, post_id, reporter_id, reason, status, created_at, resolution_action,
      target_type, target_id, target_label, target_url,
      target_user_id, target_user_handle, target_user_display_name, target_user_avatar_url,
      social_posts ( id, content, fandom, attached_media_title, user_handle, user_display_name, user_avatar_url, has_spoilers, is_removed )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(300)

  if (error) throw new Error(error.message || "Could not load reports.")
  return data || []
}

const REMOVABLE_TABLES = {
  social_post: "social_posts",
  review: "reviews",
  clip_comment: "clip_comments",
  clip: "fandom_clips",
}

/**
 * Resolve a report. action: "dismiss" | "escalate" | "remove" | "spoiler" | "resolve"
 */
export const resolveReport = async ({ report, action, moderatorId }) => {
  const now = new Date().toISOString()
  const targetType = report.target_type || "social_post"
  const targetId = report.target_id || report.post_id
  const nextStatus =
    action === "dismiss" ? "dismissed" : action === "escalate" ? "escalated" : "resolved"

  if (action === "remove" && targetId && REMOVABLE_TABLES[targetType]) {
    const { error } = await client
      .from(REMOVABLE_TABLES[targetType])
      .update({
        is_removed: true,
        removed_at: now,
        removed_by: moderatorId,
        removed_reason: report.reason || "moderation",
      })
      .eq("id", targetId)
    if (error) throw new Error(error.message || "Could not remove content.")
  }

  if (action === "spoiler" && targetType === "social_post" && targetId) {
    const { error } = await client.from("social_posts").update({ has_spoilers: true }).eq("id", targetId)
    if (error) throw new Error(error.message || "Could not flag spoiler.")
  }

  const { error: reportError } = await client
    .from("social_reports")
    .update({ status: nextStatus, resolved_at: now, resolved_by: moderatorId, resolution_action: action })
    .eq("id", report.id)
  if (reportError) throw new Error(reportError.message || "Could not update report.")
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------
export const fetchModStats = async () => {
  const countOf = async (table, build) => {
    let q = client.from(table).select("id", { count: "exact", head: true })
    if (build) q = build(q)
    const { count, error } = await q
    return error ? 0 : count || 0
  }

  const [users, pendingReports, announcements, forms] = await Promise.all([
    client
      .from("public_profiles")
      .select("user_id", { count: "exact", head: true })
      .then(({ count }) => count || 0)
      .catch(() => 0),
    countOf("social_reports", (q) => q.eq("status", "pending")),
    countOf("announcements"),
    countOf("forum_threads"),
  ])

  return { users, pendingReports, announcements, forms }
}
