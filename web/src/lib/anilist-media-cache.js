// Lightweight client-side cache for AniList "media" objects to avoid
// hammering AniList on every reload (and to reduce "Unknown title" flashes).
//
// Uses sessionStorage so it survives reloads but won't bloat persisted storage forever.

const INDEX_KEY = "hikari:anilistMediaIndex:v1"
const ITEM_PREFIX = "hikari:anilistMedia:v1:"
const MAX_ITEMS = 600

const canUseStorage = () => typeof window !== "undefined" && typeof window.sessionStorage !== "undefined"

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const pickMedia = (media) => {
  if (!media || typeof media !== "object") return null
  return {
    id: media.id,
    type: media.type,
    title: media.title ? { romaji: media.title.romaji || null, english: media.title.english || null } : null,
    coverImage: media.coverImage ? { large: media.coverImage.large || null } : null,
    episodes: media.episodes ?? null,
    chapters: media.chapters ?? null,
    averageScore: media.averageScore ?? null,
    genres: Array.isArray(media.genres) ? media.genres : null,
  }
}

const loadIndex = () => {
  if (!canUseStorage()) return []
  const raw = window.sessionStorage.getItem(INDEX_KEY)
  const parsed = safeJsonParse(raw)
  return Array.isArray(parsed) ? parsed : []
}

const saveIndex = (index) => {
  if (!canUseStorage()) return
  try {
    window.sessionStorage.setItem(INDEX_KEY, JSON.stringify(index))
  } catch {
    // ignore storage quota issues
  }
}

export const getCachedAniListMedia = (ids) => {
  const map = new Map()
  if (!canUseStorage()) return map
  ;(ids || []).forEach((id) => {
    if (!id) return
    const raw = window.sessionStorage.getItem(`${ITEM_PREFIX}${id}`)
    if (!raw) return
    const media = safeJsonParse(raw)
    if (media && media.id) {
      map.set(media.id, media)
    }
  })
  return map
}

export const cacheAniListMedia = (mediaList) => {
  if (!canUseStorage()) return
  const incoming = Array.isArray(mediaList) ? mediaList : []
  if (!incoming.length) return

  const index = loadIndex()
  const indexSet = new Set(index)

  // Put newest at the front.
  for (const media of incoming) {
    const picked = pickMedia(media)
    if (!picked?.id) continue
    try {
      window.sessionStorage.setItem(`${ITEM_PREFIX}${picked.id}`, JSON.stringify(picked))
    } catch {
      // ignore quota/write errors
    }

    if (indexSet.has(picked.id)) {
      // move-to-front
      const pos = index.indexOf(picked.id)
      if (pos > -1) index.splice(pos, 1)
    } else {
      indexSet.add(picked.id)
    }
    index.unshift(picked.id)
  }

  while (index.length > MAX_ITEMS) {
    const removed = index.pop()
    try {
      window.sessionStorage.removeItem(`${ITEM_PREFIX}${removed}`)
    } catch {
      // ignore
    }
  }

  saveIndex(index)
}

