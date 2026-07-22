const LOCAL_ORIGIN = "https://hikari.local"

export const getSafeNextPath = (value, fallback = "/") => {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== "string") return fallback

  const candidate = raw.trim()
  if (
    !candidate ||
    candidate.length > 2048 ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback
  }

  try {
    const parsed = new URL(candidate, LOCAL_ORIGIN)
    if (parsed.origin !== LOCAL_ORIGIN) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

export const buildLoginPath = (nextPath) =>
  `/login?next=${encodeURIComponent(getSafeNextPath(nextPath))}`

export const getPostLoginDestination = (nextPath, { requiresOnboarding = false } = {}) => {
  const safeNext = getSafeNextPath(nextPath)
  return requiresOnboarding ? `/onboarding?next=${encodeURIComponent(safeNext)}` : safeNext
}
