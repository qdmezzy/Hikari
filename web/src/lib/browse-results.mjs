export function mergeBrowseResults(current, incoming, append = false) {
  const seen = new Set()
  return [...(append ? current : []), ...incoming].filter(title => {
    if (!Number.isSafeInteger(title?.id) || title.id <= 0 || seen.has(title.id)) return false
    seen.add(title.id)
    return true
  })
}
