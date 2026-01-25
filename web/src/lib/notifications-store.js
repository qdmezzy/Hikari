const buildKey = (userId) => `hikari_notifications:${userId || "anon"}`;

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

export const getNotifications = (userId) => {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(buildKey(userId)), []);
};

export const saveNotifications = (userId, notifications) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildKey(userId), JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent("hikari:notifications"));
};

export const addNotification = (userId, notification) => {
  if (!userId || typeof window === "undefined") return;
  const existing = getNotifications(userId);
  const next = [
    {
      id: notification.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: notification.title || "Notification",
      message: notification.message || "",
      created_at: notification.created_at || new Date().toISOString(),
      unread: true,
      type: notification.type || "system",
      metadata: notification.metadata || null,
    },
    ...existing,
  ];
  saveNotifications(userId, next.slice(0, 50));
};

export const markAllNotificationsRead = (userId) => {
  if (!userId) return;
  const existing = getNotifications(userId);
  const next = existing.map((item) => ({ ...item, unread: false }));
  saveNotifications(userId, next);
};

export const markNotificationRead = (userId, notificationId) => {
  if (!userId) return;
  const existing = getNotifications(userId);
  const next = existing.map((item) =>
    item.id === notificationId ? { ...item, unread: false } : item,
  );
  saveNotifications(userId, next);
};

export const subscribeNotifications = (callback) => {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("hikari:notifications", handler);
  return () => window.removeEventListener("hikari:notifications", handler);
};
