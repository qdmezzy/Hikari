import client from "@/lib/client"

// Server-backed notifications (cross-device, realtime). Replaces the old
// localStorage-only store. Social notifications are created by DB triggers;
// self-generated ones (episode alerts/digests) are inserted via insertOwnNotification.

export async function fetchNotifications(userId, limit = 50) {
  if (!userId) return []
  const { data, error } = await client
    .from("notifications")
    .select("id, user_id, actor_id, type, title, message, href, metadata, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Failed to load notifications:", error)
    return []
  }
  return data || []
}

export async function markNotificationRead(userId, id) {
  if (!userId || !id) return
  const { error } = await client
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", userId)
  if (error) console.error("Failed to mark notification read:", error)
}

export async function markAllNotificationsRead(userId) {
  if (!userId) return
  const { error } = await client
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false)
  if (error) console.error("Failed to mark notifications read:", error)
}

export async function deleteNotification(userId, id) {
  if (!userId || !id) return
  await client.from("notifications").delete().eq("id", id).eq("user_id", userId)
}

// Insert a notification the user generates for themselves (episode/digest).
// `dedupeKey` makes the insert idempotent via the partial unique index.
export async function insertOwnNotification(userId, notification = {}) {
  if (!userId) return
  const row = {
    user_id: userId,
    type: notification.type || "system",
    title: notification.title || "Notification",
    message: notification.message || null,
    href: notification.href || null,
    metadata: notification.metadata || null,
    dedupe_key: notification.dedupeKey || null,
  }
  const { error } = await client
    .from("notifications")
    .upsert(row, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
  if (error && error.code !== "23505") {
    console.error("Failed to insert notification:", error)
  }
}

// Subscribe to inserts/updates for this user. Returns an unsubscribe fn.
export function subscribeToNotifications(userId, onChange) {
  if (!userId || typeof window === "undefined") return () => {}
  const channel = client
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      () => onChange(),
    )
    .subscribe()

  return () => {
    try {
      client.removeChannel(channel)
    } catch {
      /* ignore */
    }
  }
}
