// Backwards-compatible shim. Notifications are now server-backed (see
// notifications-service.js). addNotification() still lets a user record a
// self-notification (e.g. "Added to your list"); it writes to the DB so it
// shows up in the bell menu across devices.
import { insertOwnNotification } from "@/lib/notifications-service"

export const addNotification = (userId, notification = {}) => {
  if (!userId) return
  void insertOwnNotification(userId, {
    // Use the caller-provided id as a dedupe key so repeated confirmations
    // (e.g. the same list action) don't pile up.
    dedupeKey: notification.id || null,
    type: notification.type || "system",
    title: notification.title || "Notification",
    message: notification.message || "",
    href: notification.href || (notification.metadata && notification.metadata.href) || null,
    metadata: notification.metadata || null,
  })
}
