const MEDIA_DETAILS_QUERY = `
query ($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids) {
      id
      genres
      tags { name rank }
      averageScore
      format
    }
  }
}
`

const TRENDING_QUERY = `
query ($perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
      id
      title { romaji english native }
      coverImage { large }
      averageScore
      genres
      tags { name rank }
      format
      season
      seasonYear
      popularity
      episodes
    }
  }
}
`

const GENRE_POOL_QUERY = `
query ($genres: [String], $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(type: ANIME, sort: POPULARITY_DESC, genre_in: $genres, isAdult: false) {
      id
      title { romaji english native }
      coverImage { large }
      averageScore
      genres
      tags { name rank }
      format
      season
      seasonYear
      popularity
      episodes
    }
  }
}
`

const TAG_POOL_QUERY = `
query ($tags: [String], $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(type: ANIME, sort: POPULARITY_DESC, tag_in: $tags, isAdult: false) {
      id
      title { romaji english native }
      coverImage { large }
      averageScore
      genres
      tags { name rank }
      format
      season
      seasonYear
      popularity
      episodes
    }
  }
}
`

const SEASONAL_QUERY = `
query ($season: MediaSeason, $seasonYear: Int, $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(type: ANIME, sort: POPULARITY_DESC, season: $season, seasonYear: $seasonYear, isAdult: false) {
      id
      title { romaji english native }
      coverImage { large }
      averageScore
      genres
      tags { name rank }
      format
      season
      seasonYear
      popularity
      episodes
    }
  }
}
`

const normalizeToken = (value = "") =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")

const toTitleCase = (value = "") =>
  String(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ")

const stableHash = (value = "") => {
  const text = String(value)
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }
  return hash >>> 0
}

const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const mapMediaToCard = (media, reason, extra = {}) => ({
  id: media.id,
  title: media.title?.english || media.title?.romaji || media.title?.native || "Untitled",
  image: media.coverImage?.large || "",
  score: media.averageScore ? media.averageScore / 10 : null,
  reason,
  genres: media.genres || [],
  tags: (media.tags || []).map((tag) => ({ name: tag.name, rank: tag.rank || 50 })),
  format: media.format || null,
  season: media.season || null,
  seasonYear: media.seasonYear || null,
  episodes: typeof media.episodes === "number" ? media.episodes : null,
  popularity: typeof media.popularity === "number" ? media.popularity : null,
  ...extra,
})

const dedupeById = (items) => {
  const seen = new Set()
  return items.filter((item) => {
    if (!item || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

const fetchAniList = async (query, variables) => {
  const res = await fetch("/api/anilist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  })

  if (res.status === 429) {
    return null
  }

  const json = await res.json()
  if (!res.ok || json?.errors) {
    throw new Error(json?.errors?.[0]?.message || "AniList request failed.")
  }
  return json?.data || null
}

const buildTasteProfile = (entries, mediaById) => {
  const genreWeights = {}
  const tagWeights = {}
  const seedTitles = {}
  const formatWeights = {}

  entries.forEach((entry) => {
    const media = mediaById.get(entry.media_id)
    if (!media) return

    const status = entry.status || "watching"
    const statusWeight = {
      completed: 1.2,
      watching: 1.0,
      rewatching: 1.1,
      plan_to_watch: 0.4,
      on_hold: 0.3,
      dropped: 0.1,
    }[status] || 0.6

    const updatedAt = entry.updated_at ? new Date(entry.updated_at).getTime() : 0
    const daysAgo = updatedAt ? (Date.now() - updatedAt) / (1000 * 60 * 60 * 24) : 999
    const recencyBoost = Math.max(0.4, 1 - daysAgo / 180)

    // Personal rating signal: titles scored highly amplify their genres/tags;
    // poorly-rated ones dampen (and very low scores push slightly negative).
    // Centered on 7/10 as "good". No rating = neutral (1.0).
    const score = Number(entry.score) || 0
    const ratingMultiplier = score > 0 ? Math.max(-0.2, 1 + (score - 7) * 0.18) : 1

    const weight = statusWeight * recencyBoost * ratingMultiplier

    ;(media.genres || []).forEach((genre) => {
      const key = normalizeToken(genre)
      if (!key) return
      genreWeights[key] = (genreWeights[key] || 0) + weight
    })

    ;(media.tags || []).forEach((tag) => {
      const tagWeight = weight * ((tag.rank || 50) / 100)
      tagWeights[tag.name] = (tagWeights[tag.name] || 0) + tagWeight
    })

    const format = media.format || null
    if (format) {
      formatWeights[format] = (formatWeights[format] || 0) + weight * 0.35
    }

    const title = entry.media_title || null
    if (title) {
      seedTitles[title] = (seedTitles[title] || 0) + weight
    }
  })

  return { genreWeights, tagWeights, formatWeights, seedTitles }
}

const getTopKeys = (weights, limit = 3) => {
  return Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key)
}

const scoreCandidate = (candidate, profile) => {
  const genreScore = (candidate.genres || []).reduce(
    (sum, genre) => sum + (profile.genreWeights[normalizeToken(genre)] || 0),
    0,
  )
  const tagScore = (candidate.tags || []).reduce((sum, tag) => {
    const weight = profile.tagWeights[tag.name] || 0
    const rankFactor = (tag.rank || 50) / 100
    return sum + weight * rankFactor
  }, 0)

  const formatBoost = candidate.format ? (profile.formatWeights?.[candidate.format] || 0) * 0.18 : 0
  const scoreBoost = candidate.averageScore ? candidate.averageScore / 120 : 0
  const popularityBoost = candidate.popularity ? Math.min(candidate.popularity / 250000, 1) * 0.22 : 0
  const sourceBoost = candidate._source === "trending" ? 0.22 : candidate._source === "seasonal" ? 0.18 : 0
  return genreScore + tagScore + formatBoost + scoreBoost + popularityBoost + sourceBoost
}

export const fetchTrendingCards = async ({ excludeIds = new Set(), limit = 9 }) => {
  const data = await fetchAniList(TRENDING_QUERY, { perPage: Math.max(12, limit) })
  const media = data?.Page?.media || []
  return dedupeById(
    media
      .filter((item) => !excludeIds.has(item.id))
      .map((item) => mapMediaToCard(item, "Trending right now"))
      .slice(0, limit),
  )
}

const getCurrentSeason = () => {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  const season = month < 3 ? "WINTER" : month < 6 ? "SPRING" : month < 9 ? "SUMMER" : "FALL"
  return { season, year }
}

const getRootTitle = (title = "") => {
  const normalized = normalizeToken(title)
    .replace(/\b(season|part|cour|movie|ova|ona|special|episode|ep|the)\b/g, "")
    .replace(/\b\d+\b/g, "")
    .replace(/[:()\\[\\].,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return normalized || normalizeToken(title)
}

const buildExplain = ({ matchedGenres = [], matchedTags = [], seedTitles = [] }) => {
  const bits = []
  if (seedTitles.length) bits.push(`Because you liked: ${seedTitles.slice(0, 2).join(", ")}`)
  if (matchedGenres.length || matchedTags.length) {
    const tagBits = [...matchedGenres.slice(0, 3), ...matchedTags.slice(0, 3)]
    if (tagBits.length) bits.push(`Matches your taste: ${tagBits.join(" • ")}`)
  }
  return bits.join(" | ")
}

export const buildAiRecommendations = async ({
  listEntries = [],
  excludeIds = new Set(),
  limit = 12,
  sessionSeed = "default",
  extraProfile = null,
}) => {
  if (!listEntries.length) {
    return { items: [], subtitle: "Trending right now" }
  }

  const sortedEntries = [...listEntries].sort((a, b) => {
    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
    return bTime - aTime
  })
  const recentEntries = sortedEntries.slice(0, 50)
  const recentIds = recentEntries.map((entry) => Number(entry.media_id)).filter(Number.isFinite)

  const detailData = await fetchAniList(MEDIA_DETAILS_QUERY, { ids: recentIds })
  const mediaList = detailData?.Page?.media || []
  const mediaById = new Map(mediaList.map((item) => [item.id, item]))
  const profile = buildTasteProfile(recentEntries, mediaById)
  const topGenres = getTopKeys(profile.genreWeights, 3).map(toTitleCase)
  const topTags = getTopKeys(profile.tagWeights, 4)
  const topSeeds = getTopKeys(profile.seedTitles || {}, 3)

  if (extraProfile?.genreWeights) {
    Object.entries(extraProfile.genreWeights).forEach(([key, value]) => {
      const token = normalizeToken(key)
      if (!token || !Number.isFinite(value)) return
      profile.genreWeights[token] = (profile.genreWeights[token] || 0) + value
    })
  }
  if (extraProfile?.tagWeights) {
    Object.entries(extraProfile.tagWeights).forEach(([key, value]) => {
      if (!key || !Number.isFinite(value)) return
      profile.tagWeights[key] = (profile.tagWeights[key] || 0) + value
    })
  }
  if (extraProfile?.formatWeights) {
    profile.formatWeights = { ...(profile.formatWeights || {}) }
    Object.entries(extraProfile.formatWeights).forEach(([key, value]) => {
      if (!key || !Number.isFinite(value)) return
      profile.formatWeights[key] = (profile.formatWeights[key] || 0) + value
    })
  }

  if (topGenres.length === 0) {
    return { items: [], subtitle: "Trending right now" }
  }

  const { season, year } = getCurrentSeason()

  const [genreData, tagData, trendingData, seasonalData] = await Promise.all([
    fetchAniList(GENRE_POOL_QUERY, { genres: topGenres, perPage: 80 }),
    topTags.length ? fetchAniList(TAG_POOL_QUERY, { tags: topTags, perPage: 60 }) : Promise.resolve(null),
    fetchAniList(TRENDING_QUERY, { perPage: 40 }),
    fetchAniList(SEASONAL_QUERY, { season, seasonYear: year, perPage: 50 }),
  ])

  const genrePool = (genreData?.Page?.media || []).map((item) => ({ ...item, _source: "genre" }))
  const tagPool = (tagData?.Page?.media || []).map((item) => ({ ...item, _source: "tag" }))
  const trendingPool = (trendingData?.Page?.media || []).map((item) => ({
    ...item,
    _source: "trending",
  }))
  const seasonalPool = (seasonalData?.Page?.media || []).map((item) => ({ ...item, _source: "seasonal" }))
  const candidates = dedupeById([...genrePool, ...trendingPool]).filter(
    (item) => !excludeIds.has(item.id),
  )

  if (!candidates.length) {
    return { items: [], subtitle: "Trending right now" }
  }

  const expandedCandidates = dedupeById([...candidates, ...tagPool, ...seasonalPool]).filter((item) => !excludeIds.has(item.id))

  const seed = stableHash(`${sessionSeed}:${topGenres.join(",")}:${topTags.join(",")}:${topSeeds.join(",")}`)
  const rand = mulberry32(seed)

  const scored = expandedCandidates.map((item) => {
    const score = scoreCandidate(item, profile)
    const jitter = rand() * 0.35
    const boosted = score + jitter
    return { item, score: boosted }
  })

  scored.sort((a, b) => b.score - a.score)

  // Pick from the top slice, but enforce variety (avoid 4 sequels in a row).
  const pickFrom = scored.slice(0, Math.max(limit * 6, 60))
  const selected = []
  const usedIds = new Set()
  const usedRoots = {}

  for (const entry of pickFrom) {
    if (selected.length >= limit) break
    const media = entry.item
    if (!media || usedIds.has(media.id)) continue
    if (excludeIds.has(media.id)) continue
    const root = getRootTitle(media.title?.english || media.title?.romaji || media.title?.native || "")
    usedRoots[root] = (usedRoots[root] || 0) + 1
    if (usedRoots[root] > 1) continue
    usedIds.add(media.id)
    selected.push({ ...media, _score: entry.score })
  }

  const topGenreTokens = getTopKeys(profile.genreWeights, 5).map(toTitleCase)
  const topTagNames = getTopKeys(profile.tagWeights, 6)
  const subtitle = `Based on your taste: ${topGenreTokens.slice(0, 3).join(", ")}`

  const ranked = selected.map((media) => {
    const matchedGenres = (media.genres || [])
      .map((g) => ({ g, w: profile.genreWeights[normalizeToken(g)] || 0 }))
      .filter((row) => row.w > 0)
      .sort((a, b) => b.w - a.w)
      .map((row) => toTitleCase(normalizeToken(row.g)))
      .slice(0, 3)
    const matchedTags = (media.tags || [])
      .map((t) => ({ t: t.name, w: profile.tagWeights[t.name] || 0 }))
      .filter((row) => row.w > 0)
      .sort((a, b) => b.w - a.w)
      .map((row) => row.t)
      .slice(0, 3)

    const reason = buildExplain({
      matchedGenres,
      matchedTags,
      seedTitles: topSeeds,
    }) || `Based on your taste: ${topGenreTokens.slice(0, 3).join(", ")}`

    return mapMediaToCard(media, reason, {
      matchedGenres,
      matchedTags,
      source: media._source || "mix",
      internalScore: typeof media._score === "number" ? media._score : null,
    })
  })

  // If we couldn't fill (variety filter), fall back to top scored.
  if (ranked.length < limit) {
    const fallback = scored
      .filter((entry) => !excludeIds.has(entry.item.id))
      .slice(0, limit)
      .map((entry) =>
        mapMediaToCard(entry.item, `Based on your taste: ${topGenreTokens.slice(0, 3).join(", ")}`),
      )
    return { items: dedupeById([...ranked, ...fallback]).slice(0, limit), subtitle }
  }

  return { items: ranked, subtitle }
}
