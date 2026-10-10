export function calculatePublicStats(entries, now = new Date()) {
  const visible = entries.filter((entry) => !entry.hide_from_profile)
  const count = (status) => visible.filter((entry) => entry.status === status).length
  const progress = (entry) => Math.max(0, Number(entry.progress) || 0)
  const scores = visible.map((entry) => Number(entry.score)).filter((score) => Number.isFinite(score) && score > 0)
  const days = new Set()
  for (const entry of visible) {
    const dateValue = entry.status === 'completed'
      ? entry.finished_at || entry.updated_at
      : ['watching', 'rewatching'].includes(entry.status)
        ? entry.updated_at || entry.created_at
        : entry.created_at || entry.updated_at
    const date = new Date(dateValue)
    if (dateValue && !Number.isNaN(date.getTime())) days.add(date.toISOString().slice(0, 10))
  }
  let currentStreak = 0
  const cursor = new Date(now)
  while (days.has(cursor.toISOString().slice(0, 10))) {
    currentStreak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  let longestStreak = 0
  let run = 0
  let previous = 0
  for (const day of [...days].sort()) {
    const timestamp = Date.parse(day)
    run = previous && timestamp - previous === 86400000 ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
    previous = timestamp
  }
  const totalEpisodes = visible.filter((entry) => entry.media_type === 'ANIME').reduce((sum, entry) => sum + progress(entry), 0)
  return {
    watching: count('watching') + count('rewatching'),
    completed: count('completed'),
    onHold: count('on_hold'),
    dropped: count('dropped'),
    planToWatch: count('plan_to_watch'),
    totalTitles: visible.length,
    totalEpisodes,
    totalProgress: visible.reduce((sum, entry) => sum + progress(entry), 0),
    daysWatched: Number((Math.round((totalEpisodes * 24) / 60) / 24).toFixed(1)),
    meanScore: scores.length ? Number((scores.reduce((sum, score) => sum + (score > 10 ? score / 10 : score), 0) / scores.length).toFixed(1)) : 0,
    currentStreak,
    longestStreak,
    rewatches: count('rewatching'),
  }
}
