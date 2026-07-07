import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"

// Called by the scheduled GitHub Action every ~30 minutes. Finds tracked
// titles whose next episode airs inside the coming window (or just aired)
// and sends a web push to every subscribed browser of each alerting user.

const WINDOW_MS = 40 * 60 * 1000

const AIRING_QUERY = `
query ($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      title { romaji english }
      nextAiringEpisode { airingAt episode }
    }
  }
}
`

const readFirstEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim()
    if (value) return value
  }
  return ""
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function POST(req: Request) {
  try {
    const cronSecret = readFirstEnv("CRON_SECRET")
    const provided =
      req.headers.get("x-cron-key") || new URL(req.url).searchParams.get("key") || ""
    if (!cronSecret || provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = readFirstEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
    const serviceKey = readFirstEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY")
    const vapidPublic = readFirstEnv("VAPID_PUBLIC_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY")
    const vapidPrivate = readFirstEnv("VAPID_PRIVATE_KEY")
    if (!url || !serviceKey || !vapidPublic || !vapidPrivate) {
      return NextResponse.json({ error: "Push not configured" }, { status: 500 })
    }

    webpush.setVapidDetails(
      readFirstEnv("VAPID_SUBJECT") || "mailto:hello@hikari.app",
      vapidPublic,
      vapidPrivate,
    )

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

    const { data: alerts, error: alertsError } = await admin
      .from("episode_alerts")
      .select("user_id, media_id, last_notified_episode")
    if (alertsError) return NextResponse.json({ error: alertsError.message }, { status: 500 })
    if (!alerts?.length) return NextResponse.json({ ok: true, sent: 0, reason: "no alerts" })

    const mediaIds = Array.from(new Set(alerts.map((a) => Number(a.media_id)).filter(Number.isFinite)))
    const airingById = new Map<number, { title: string; episode: number; airingAt: number }>()

    for (const batch of chunk(mediaIds, 50)) {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: AIRING_QUERY, variables: { ids: batch } }),
      })
      if (!res.ok) continue
      const json = await res.json().catch(() => null)
      for (const media of json?.data?.Page?.media || []) {
        const next = media?.nextAiringEpisode
        if (!next?.airingAt || !next?.episode) continue
        airingById.set(Number(media.id), {
          title: media.title?.english || media.title?.romaji || "An anime you track",
          episode: Number(next.episode),
          airingAt: Number(next.airingAt) * 1000,
        })
      }
    }

    const now = Date.now()
    const due = alerts.filter((alert) => {
      const airing = airingById.get(Number(alert.media_id))
      if (!airing) return false
      return airing.airingAt <= now + WINDOW_MS && airing.episode > Number(alert.last_notified_episode || 0)
    })
    if (!due.length) return NextResponse.json({ ok: true, sent: 0, reason: "nothing due" })

    const userIds = Array.from(new Set(due.map((a) => a.user_id)))
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", userIds)
    const subsByUser = new Map<string, any[]>()
    for (const sub of subs || []) {
      const list = subsByUser.get(sub.user_id) || []
      list.push(sub)
      subsByUser.set(sub.user_id, list)
    }

    let sent = 0
    const deadEndpoints: string[] = []

    for (const alert of due) {
      const airing = airingById.get(Number(alert.media_id))
      if (!airing) continue
      const minutes = Math.max(Math.round((airing.airingAt - now) / 60000), 0)
      const body =
        minutes > 1
          ? `Episode ${airing.episode} airs in about ${minutes} minutes.`
          : `Episode ${airing.episode} is airing now!`
      const payload = JSON.stringify({
        title: airing.title,
        body,
        url: `/media/${alert.media_id}`,
        tag: `airing-${alert.media_id}-${airing.episode}`,
      })

      for (const sub of subsByUser.get(alert.user_id) || []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
          sent += 1
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            deadEndpoints.push(sub.endpoint)
          }
        }
      }

      await admin
        .from("episode_alerts")
        .update({ last_notified_episode: airing.episode })
        .eq("user_id", alert.user_id)
        .eq("media_id", alert.media_id)
    }

    if (deadEndpoints.length) {
      await admin.from("push_subscriptions").delete().in("endpoint", deadEndpoints)
    }

    return NextResponse.json({ ok: true, sent, due: due.length, pruned: deadEndpoints.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
