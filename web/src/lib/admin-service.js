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

// ---------------------------------------------------------------------------
// Feedback / bug reports (mod-readable via RLS)
// ---------------------------------------------------------------------------
export const fetchFeedback = async () => {
  const { data, error } = await client
    .from("feedback")
    .select("id, user_id, email, category, message, page_url, resolved, created_at")
    .order("created_at", { ascending: false })
    .limit(300)
  if (error) throw new Error(error.message || "Could not load feedback.")
  return data || []
}

export const setFeedbackResolved = async (id, resolved) => {
  const { error } = await client.from("feedback").update({ resolved: Boolean(resolved) }).eq("id", id)
  if (error) throw new Error(error.message || "Could not update feedback.")
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
      id, post_id, reporter_id, reason, status, created_at, resolved_at, resolved_by, resolution_action, resolution_note,
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

// One database transaction owns content changes, report state, and the audit entry.
export const resolveReport = async ({ report, action, note = "" }) => {
  const { data, error } = await client.rpc("decide_social_report", {
    report_id: report.id,
    decision: action,
    expected_status: report.status || "pending",
    expected_resolved_at: report.resolved_at || null,
    decision_note: note.trim() || null,
  })
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") throw new Error("Atomic moderation needs the September 6 database migration. No changes were made.")
    throw new Error(error.message || "Could not save this decision.")
  }
  return data
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
