import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHash, timingSafeEqual } from "node:crypto"
import webpush from "web-push"
import { processPushJob } from "@/lib/push-job.mjs"

export const runtime = "nodejs"
export const maxDuration = 60
const env = (...names: string[]) => names.map(name => process.env[name]?.trim()).find(Boolean) || ""
const digest = (value: string) => createHash("sha256").update(value).digest("hex")
const QUERY = `query ($ids:[Int]) { Page(perPage:50) { media(id_in:$ids,type:ANIME) { id title { english romaji } nextAiringEpisode { airingAt episode } } } }`

export async function POST(req: Request) {
  const secret = env("CRON_SECRET")
  const provided = req.headers.get("x-cron-key") || new URL(req.url).searchParams.get("key") || ""
  if (!secret || !timingSafeEqual(Buffer.from(digest(secret)), Buffer.from(digest(provided)))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const url = env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
  const key = env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY")
  const publicKey = env("VAPID_PUBLIC_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY")
  const privateKey = env("VAPID_PRIVATE_KEY")
  if (!url || !key || !publicKey || !privateKey) return NextResponse.json({ error: "Push not configured" }, { status: 503 })
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  webpush.setVapidDetails(env("VAPID_SUBJECT") || "mailto:hello@hikari.app", publicKey, privateKey)
  const started = Date.now()
  let enqueued = 0, sent = 0, retried = 0, cancelled = 0, dead = 0, sourceFailures = 0
  try {
    // Without migration 09, fail closed before any sends.
    const { error: queueError } = await admin.from("push_delivery_jobs").select("id").limit(0)
    if (queueError) return NextResponse.json({ error: "Notification queue is not ready" }, { status: 503 })
    const mediaIds = new Set<number>()
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await admin.from("episode_alerts").select("user_id,media_id")
        .order("user_id").order("media_id").range(offset, offset + 499)
      if (error) { sourceFailures++; break }
      for (const row of data || []) mediaIds.add(row.media_id)
      if ((data?.length || 0) < 500) break
      if (Date.now() - started > 10000) { sourceFailures++; break }
    }
    const ids = [...mediaIds]
    for (let offset = 0; offset < ids.length; offset += 50) {
      if (Date.now() - started > 20000) { sourceFailures++; break }
      try {
        const response = await fetch("https://graphql.anilist.co", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: QUERY, variables: { ids: ids.slice(offset, offset + 50) } }),
          signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) { sourceFailures++; continue }
        const json = await response.json()
        if (json.errors) sourceFailures++
        for (const media of json?.data?.Page?.media || []) {
          const next = media.nextAiringEpisode
          if (!next?.episode || !next?.airingAt) continue
          const airing = Number(next.airingAt) * 1000
          if (airing > Date.now() + 2400000 || airing < Date.now() - 86400000) continue
          const { data, error } = await admin.rpc("enqueue_episode_push", {
            p_media_id: media.id, p_episode: next.episode,
            p_title: media.title?.english || media.title?.romaji || "An anime you track",
            p_airing_at: new Date(airing).toISOString(),
          })
          if (error) sourceFailures++
          else enqueued += Number(data || 0)
        }
      } catch { sourceFailures++ }
    }
    // Existing retries drain even if AniList is offline or no new episode is due.
    while (Date.now() - started < 45000) {
      const { data, error } = await admin.rpc("claim_episode_push")
      if (error) throw new Error("Queue claim failed")
      const job = data?.[0]
      if (!job) break
      const state = await processPushJob(job, {
        currentSubscription: async (current: any) => {
          const { data: reminder, error: reminderError } = await admin.from("episode_alerts")
            .select("media_id").eq("user_id", current.user_id).eq("media_id", current.media_id).maybeSingle()
          if (reminderError) throw new Error("Consent lookup failed")
          if (!reminder) return null
          for (let offset = 0; ; offset += 100) {
            const { data: subs, error: subError } = await admin.from("push_subscriptions")
              .select("endpoint,p256dh,auth").eq("user_id", current.user_id).order("endpoint").range(offset, offset + 99)
            if (subError) throw new Error("Subscription lookup failed")
            const sub = subs?.find(s => digest(s.endpoint) === current.endpoint_hash)
            if (sub) return sub
            if ((subs?.length || 0) < 100) return null
          }
        },
        send: async (sub: any, payload: any) => webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload), { timeout: 5000, TTL: 3600 },
        ),
        finish: async (current: any, state: string, code: string | null) => {
          const { data: saved, error: saveError } = await admin.rpc("finish_episode_push", {
            p_id: current.id, p_token: current.lease_token, p_state: state, p_code: code,
          })
          if (saveError || saved !== true) throw new Error("Queue receipt failed")
        },
      })
      if (state === "sent") sent++
      else if (state === "pending") retried++
      else if (state === "cancelled") cancelled++
      else dead++
    }
    return NextResponse.json({ ok: sourceFailures === 0, enqueued, sent, retried, cancelled, dead, sourceFailures }, { status: sourceFailures ? 503 : 200 })
  } catch {
    return NextResponse.json({ error: "Notification processing failed; pending jobs remain retryable", sent }, { status: 503 })
  }
}
