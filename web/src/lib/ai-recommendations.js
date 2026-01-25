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
    media(type: ANIME, sort: TRENDING_DESC) {
      id
      title { romaji english native }
      coverImage { large }
      averageScore
      genres
      tags { name rank }
    }
  }
}
`

const GENRE_POOL_QUERY = `
query ($genres: [String], $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(type: ANIME, sort: POPULARITY_DESC, genre_in: $genres) {
      id
      title { romaji english native }
      coverImage { large }
      averageScore
      genres
      tags { name rank }
    }
  }
}
`

const mapMediaToCard = (media, reason) => ({
  id: media.id,
  title: media.title?.english || media.title?.romaji || media.title?.native || "Untitled",
  image: media.coverImage?.large || "",
  score: media.averageScore ? media.averageScore / 10 : null,
  reason,
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

    const weight = statusWeight * recencyBoost

    ;(media.genres || []).forEach((genre) => {
      genreWeights[genre] = (genreWeights[genre] || 0) + weight
    })

    ;(media.tags || []).forEach((tag) => {
      const tagWeight = weight * ((tag.rank || 50) / 100)
      tagWeights[tag.name] = (tagWeights[tag.name] || 0) + tagWeight
    })
  })

  return { genreWeights, tagWeights }
}

const getTopKeys = (weights, limit = 3) => {
  return Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key)
}

const scoreCandidate = (candidate, profile) => {
  const genreScore = (candidate.genres || []).reduce(
    (sum, genre) => sum + (profile.genreWeights[genre] || 0),
    0,
  )
  const tagScore = (candidate.tags || []).reduce((sum, tag) => {
    const weight = profile.tagWeights[tag.name] || 0
    const rankFactor = (tag.rank || 50) / 100
    return sum + weight * rankFactor
  }, 0)
  const scoreBoost = candidate.averageScore ? candidate.averageScore / 100 : 0
  const sourceBoost = candidate._source === "trending" ? 0.2 : 0
  return genreScore + tagScore + scoreBoost + sourceBoost
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

export const buildAiRecommendations = async ({ listEntries = [], excludeIds = new Set(), limit = 9 }) => {
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
  const topGenres = getTopKeys(profile.genreWeights, 3)

  if (topGenres.length === 0) {
    return { items: [], subtitle: "Trending right now" }
  }

  const [genreData, trendingData] = await Promise.all([
    fetchAniList(GENRE_POOL_QUERY, { genres: topGenres, perPage: 60 }),
    fetchAniList(TRENDING_QUERY, { perPage: 30 }),
  ])

  const genrePool = (genreData?.Page?.media || []).map((item) => ({ ...item, _source: "genre" }))
  const trendingPool = (trendingData?.Page?.media || []).map((item) => ({
    ...item,
    _source: "trending",
  }))
  const candidates = dedupeById([...genrePool, ...trendingPool]).filter(
    (item) => !excludeIds.has(item.id),
  )

  if (!candidates.length) {
    return { items: [], subtitle: "Trending right now" }
  }

  const ranked = candidates
    .map((item) => ({ item, score: scoreCandidate(item, profile) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) =>
      mapMediaToCard(entry.item, `Based on your taste: ${topGenres.join(", ")}`),
    )

  return { items: ranked, subtitle: `Based on your taste: ${topGenres.join(", ")}` }
}
