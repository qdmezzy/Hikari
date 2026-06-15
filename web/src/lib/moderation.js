import client from "@/lib/client"

// Returns the caller's active (non-expired) ban row, or null.
export async function fetchActiveBan(userId) {
  if (!userId) return null
  const { data, error } = await client
    .from("user_bans")
    .select("id, reason, created_at, expires_at, active")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)

  if (error || !data?.length) return null
  const ban = data[0]
  if (ban.expires_at && new Date(ban.expires_at).getTime() <= Date.now()) return null
  return ban
}

// The caller's most recent appeal, or null.
export async function fetchLatestAppeal(userId) {
  if (!userId) return null
  const { data, error } = await client
    .from("ban_appeals")
    .select("id, message, status, created_at, review_note, reviewed_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)

  if (error || !data?.length) return null
  return data[0]
}

export async function submitAppeal({ userId, banId, message }) {
  if (!userId) return { error: { message: "Not signed in" } }
  return client.from("ban_appeals").insert({
    user_id: userId,
    ban_id: banId || null,
    message: String(message || "").trim(),
  })
}

// Mod actions (RPCs are mod-gated server-side).
export async function banUser(targetUserId, { reason, expiresAt } = {}) {
  return client.rpc("admin_ban_user", {
    target_user_id: targetUserId,
    ban_reason: reason || null,
    ban_expires_at: expiresAt || null,
  })
}

export async function unbanUser(targetUserId) {
  return client.rpc("admin_unban_user", { target_user_id: targetUserId })
}

export async function reviewAppeal(appealId, approve, note) {
  return client.rpc("admin_review_appeal", {
    appeal_id: appealId,
    approve: Boolean(approve),
    note: note || null,
  })
}
