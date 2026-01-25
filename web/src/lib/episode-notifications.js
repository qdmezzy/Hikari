import client from "@/lib/client"
import { addNotification, getNotifications } from "@/lib/notifications-store"

const CHECK_KEY = (userId) => `hikari-notify-last-check:${userId}`
const DIGEST_KEY = (userId, dateKey) => `hikari-notify-digest:${userId}:${dateKey}`
const MIN_INTERVAL_MS = 5 * 60 * 1000
const PRE_AIR_WINDOW_SECONDS = 30 * 60
const RECENT_WINDOW_SECONDS = 2 * 60 * 60

const AIRING_QUERY = `
  query ($ids: [Int], $perPage: Int) {
    Page(perPage: $perPage) {
      media(id_in: $ids, type: ANIME) {
        id
        title { romaji english }
        nextAiringEpisode { airingAt timeUntilAiring episode }
      }
    }
  }
`

const chunkIds = (ids, size) => {
  const batches = []
  for (let i = 0; i < ids.length; i += size) {
    batches.push(ids.slice(i, i + size))
  }
  return batches
}

const buildDigestMessage = (items) => {
  const titles = items.slice(0, 3).map((item) => item.title)
  const extra = items.length > 3 ? ` +${items.length - 3} more` : ""
  return `${titles.join(", ")}${extra}`
}

export const scheduleEpisodeNotifications = async ({
  user,
  notifyEpisodes,
  notifyPreAir,
  notifyDigest,
}) => {
  if (!user || typeof window === "undefined") return
  if (!notifyEpisodes && !notifyPreAir && !notifyDigest) return

  const now = Date.now()
  const lastCheck = Number(window.localStorage.getItem(CHECK_KEY(user.id)) || 0)
  if (now - lastCheck < MIN_INTERVAL_MS) return
  window.localStorage.setItem(CHECK_KEY(user.id), String(now))

  const { data, error } = await client
    .from("list_entries")
    .select("media_id, status, media_type")
    .eq("user_id", user.id)
    .eq("media_type", "ANIME")
    .in("status", ["watching", "rewatching", "on_hold"])

  if (error || !data?.length) return

  const ids = Array.from(new Set(data.map((entry) => entry.media_id).filter(Boolean)))
  if (!ids.length) return

  const mediaById = new Map()
  const batches = chunkIds(ids, 50)

  for (const batch of batches) {
    const res = await fetch("/api/anilist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: AIRING_QUERY,
        variables: { ids: batch, perPage: batch.length },
      }),
    })

    const json = await res.json()
    if (!res.ok || json?.errors) {
      continue
    }

    const mediaList = json?.data?.Page?.media ?? []
    mediaList.forEach((media) => {
      mediaById.set(media.id, media)
    })
  }

  const nowSeconds = Math.floor(now / 1000)
  const existing = getNotifications(user.id)
  const existingIds = new Set(existing.map((item) => item.id))

  const upcoming = ids
    .map((id) => mediaById.get(id))
    .filter((media) => media?.nextAiringEpisode)
    .map((media) => {
      const title = media.title?.english || media.title?.romaji || "Untitled"
      const episode = media.nextAiringEpisode.episode
      const airingAt = media.nextAiringEpisode.airingAt
      return {
        id: media.id,
        title,
        episode,
        airingAt,
        deltaSeconds: airingAt - nowSeconds,
      }
    })

  if (notifyEpisodes) {
    upcoming
      .filter((item) => item.deltaSeconds <= 0 && item.deltaSeconds >= -RECENT_WINDOW_SECONDS)
      .forEach((item) => {
        const id = `episode-${item.id}-${item.episode}`
        if (existingIds.has(id)) return
        addNotification(user.id, {
          id,
          title: `${item.title} • Episode ${item.episode} aired`,
          message: "Tap to open your calendar or update progress.",
          type: "episode",
          metadata: { mediaId: item.id, episode: item.episode },
        })
        existingIds.add(id)
      })
  }

  if (notifyPreAir) {
    upcoming
      .filter((item) => item.deltaSeconds > 0 && item.deltaSeconds <= PRE_AIR_WINDOW_SECONDS)
      .forEach((item) => {
        const id = `preair-${item.id}-${item.episode}`
        if (existingIds.has(id)) return
        addNotification(user.id, {
          id,
          title: `${item.title} • Episode ${item.episode} soon`,
          message: "Airing in under 30 minutes.",
          type: "preair",
          metadata: { mediaId: item.id, episode: item.episode },
        })
        existingIds.add(id)
      })
  }

  if (notifyDigest) {
    const dateKey = new Date().toISOString().slice(0, 10)
    const digestKey = DIGEST_KEY(user.id, dateKey)
    if (!window.localStorage.getItem(digestKey)) {
      const dayAhead = upcoming.filter((item) => item.deltaSeconds > 0 && item.deltaSeconds <= 24 * 60 * 60)
      if (dayAhead.length) {
        const id = `digest-${dateKey}`
        if (!existingIds.has(id)) {
          addNotification(user.id, {
            id,
            title: "Today’s airing digest",
            message: buildDigestMessage(dayAhead),
            type: "digest",
            metadata: { count: dayAhead.length },
          })
          existingIds.add(id)
        }
        window.localStorage.setItem(digestKey, "sent")
      }
    }
  }
}
