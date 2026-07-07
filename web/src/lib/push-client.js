import client from "@/lib/client"

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window

// Registers the service worker, asks for permission, subscribes the browser,
// and stores the subscription server-side. Returns:
//   "subscribed" | "denied" | "unsupported" | "error"
export const ensurePushSubscription = async () => {
  if (!pushSupported()) return "unsupported"
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) return "unsupported"

  try {
    const permission = await Notification.requestPermission()
    if (permission !== "granted") return "denied"

    const registration = await navigator.serviceWorker.register("/sw.js")
    await navigator.serviceWorker.ready

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
    }

    const { data: sessionData } = await client.auth.getSession()
    const token = sessionData?.session?.access_token
    if (!token) return "error"

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    })
    return res.ok ? "subscribed" : "error"
  } catch {
    return "error"
  }
}
