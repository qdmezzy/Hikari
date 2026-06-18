// Compute a year-in-review ("Hikari Wrapped") from a user's list entries.
//
// We don't store per-episode watch timestamps, so "your year" is derived from
// entries whose updated_at falls in the target year — the same activity proxy
// the rest of the app uses. Good enough for a fun recap.

const isManga = (entry) => entry?.media_type === "MANGA" || entry?.media?.type === "MANGA"

const displayProgress = (entry) => {
  const total = isManga(entry)
    ? Number(entry?.media?.chapters || 0)
    : Number(entry?.media?.episodes || 0)
  if (entry?.status === "completed" && total > 0) return total
  return Number(entry?.progress || 0)
}

const PERSONALITIES = {
  Action: { title: "The Adrenaline Junkie", blurb: "You live for the fight scenes and never skip an OP." },
  Adventure: { title: "The Explorer", blurb: "Always chasing the next world to get lost in." },
  Comedy: { title: "The Good-Vibes Curator", blurb: "Life's too short for anime that doesn't make you laugh." },
  Drama: { title: "The Emotional-Damage Collector", blurb: "You sign up for the heartbreak on purpose." },
  Romance: { title: "The Hopeless Romantic", blurb: "Slow burns are your love language." },
  "Sci-Fi": { title: "The Future Thinker", blurb: "Big ideas, bigger worlds. You watch with your brain on." },
  Fantasy: { title: "The Worldbuilder", blurb: "Magic systems and lore are basically your personality." },
  "Slice of Life": { title: "The Comfort Seeker", blurb: "Cozy beats chaos. You watch to feel at home." },
  Horror: { title: "The Thrill Seeker", blurb: "The creepier, the better." },
  Mystery: { title: "The Detective", blurb: "You solved it three episodes ago, didn't you?" },
  Psychological: { title: "The Deep Diver", blurb: "You like anime that messes with your head." },
  Supernatural: { title: "The Believer", blurb: "Ghosts, gods, and curses — you're here for all of it." },
  Sports: { title: "The Hype Beast", blurb: "Every match has you on the edge of your seat." },
  Music: { title: "The Maestro", blurb: "Bangers only. You watch with the volume up." },
  Mecha: { title: "The Pilot", blurb: "Giant robots are objectively peak fiction." },
  Thriller: { title: "The Edge-of-Seat", blurb: "You don't breathe during the climax." },
}

export const getWrappedPersonality = (topGenre) =>
  PERSONALITIES[topGenre] || { title: "The Completionist", blurb: "A little bit of everything — your taste has no ceiling." }

export function computeWrapped(entries, year) {
  const yearEntries = (entries || []).filter((entry) => {
    const updated = entry?.updated_at ? new Date(entry.updated_at) : null
    return updated && updated.getFullYear() === year
  })

  const animeEntries = yearEntries.filter((entry) => !isManga(entry))
  const mangaEntries = yearEntries.filter((entry) => isManga(entry))
  const completed = yearEntries.filter((entry) => entry.status === "completed")
  const completedAnime = completed.filter((entry) => !isManga(entry))

  const episodesWatched = animeEntries.reduce((sum, entry) => sum + displayProgress(entry), 0)
  const chaptersRead = mangaEntries.reduce((sum, entry) => sum + displayProgress(entry), 0)
  const minutesWatched = animeEntries.reduce(
    (sum, entry) => sum + displayProgress(entry) * (Number(entry?.media?.duration) || 24),
    0,
  )
  const hoursWatched = Math.round(minutesWatched / 60)
  const daysWatched = Number((minutesWatched / 60 / 24).toFixed(1))

  // Genre tally across the year.
  const genreCounts = new Map()
  yearEntries.forEach((entry) => {
    ;(entry?.media?.genres || []).forEach((genre) => {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1)
    })
  })
  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // Scores.
  const scored = yearEntries.filter((entry) => Number(entry?.score) > 0)
  const meanScore = scored.length
    ? Number((scored.reduce((sum, entry) => sum + Number(entry.score), 0) / scored.length).toFixed(1))
    : 0

  const topRated = [...scored].sort((a, b) => Number(b.score) - Number(a.score))[0] || null

  // Most-watched single series (by episodes/chapters progressed).
  const mostBinged = [...yearEntries].sort((a, b) => displayProgress(b) - displayProgress(a))[0] || null

  // Longest completed series.
  const longest = [...completedAnime]
    .sort((a, b) => Number(b?.media?.episodes || 0) - Number(a?.media?.episodes || 0))[0] || null

  // Per-month activity (count of entries touched each month).
  const months = Array.from({ length: 12 }, () => 0)
  yearEntries.forEach((entry) => {
    const m = new Date(entry.updated_at).getMonth()
    months[m] += 1
  })
  const busiestMonthIndex = months.indexOf(Math.max(...months))

  // First title you touched this year (proxy: earliest updated_at).
  const firstWatch =
    [...yearEntries].sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at))[0] || null

  // Longest run of consecutive days with any tracking activity this year.
  const dayKeys = Array.from(
    new Set(yearEntries.map((entry) => new Date(entry.updated_at).toISOString().slice(0, 10))),
  ).sort()
  let longestStreak = dayKeys.length ? 1 : 0
  let run = dayKeys.length ? 1 : 0
  for (let i = 1; i < dayKeys.length; i += 1) {
    const prev = new Date(dayKeys[i - 1])
    const cur = new Date(dayKeys[i])
    const diffDays = Math.round((cur - prev) / 86400000)
    run = diffDays === 1 ? run + 1 : 1
    if (run > longestStreak) longestStreak = run
  }

  const personality = getWrappedPersonality(topGenres[0]?.name)

  return {
    year,
    hasData: yearEntries.length > 0,
    firstWatch,
    longestStreak,
    totals: {
      titles: yearEntries.length,
      completed: completed.length,
      anime: animeEntries.length,
      manga: mangaEntries.length,
      episodesWatched,
      chaptersRead,
      hoursWatched,
      daysWatched,
      meanScore,
    },
    topGenres,
    topRated,
    mostBinged,
    longest,
    months,
    busiestMonthIndex,
    personality,
  }
}

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]
