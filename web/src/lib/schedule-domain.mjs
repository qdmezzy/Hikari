export function validTimeZone(value) {
  if (typeof value !== "string" || !value) return false
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); return true } catch { return false }
}

const dateKey = (date, timeZone) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)

export function buildScheduleWeek(schedule, timeZone, now = new Date()) {
  const zone = validTimeZone(timeZone) ? timeZone : "UTC"
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now)
  const value = type => Number(parts.find(part => part.type === type)?.value)
  const week = Array.from({ length: 7 }, (_, index) => {
    // UTC noon is only a calendar arithmetic anchor; air times use the selected zone.
    const day = new Date(Date.UTC(value("year"), value("month") - 1, value("day") + index, 12))
    return { key: dateKey(day, "UTC"), label: index === 0 ? "Today" : index === 1 ? "Tomorrow" : day.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }), sub: day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), dayNumber: day.getUTCDate(), month: day.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), isToday: index === 0, items: [] }
  })
  const byKey = new Map(week.map(day => [day.key, day]))
  const later = []
  for (const item of schedule) {
    if (!Number.isFinite(item.airingAt) || item.airingAt * 1000 < now.getTime()) continue
    const date = new Date(item.airingAt * 1000)
    const day = byKey.get(dateKey(date, zone))
    if (day) day.items.push({ ...item, date })
    else later.push({ ...item, date })
  }
  return { week, later }
}
