// Global appearance preferences (reduce motion, high contrast) applied as
// classes on <html>, mirrored to localStorage so they persist and apply on
// every page (same pattern as the accent color).

export const APPEARANCE_STORAGE_KEY = "hikari-appearance"

export const applyReduceMotion = (on) => {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle("reduce-motion", !!on)
}

export const applyHighContrast = (on) => {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle("high-contrast", !!on)
}

export const applyAppearance = (prefs = {}) => {
  applyReduceMotion(prefs.reduceMotion)
  applyHighContrast(prefs.highContrast)
}

export const loadAppearance = () => {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY) || "{}") || {}
  } catch {
    return {}
  }
}

// Merge + persist + apply in one call.
export const saveAppearance = (patch = {}) => {
  const next = { ...loadAppearance(), ...patch }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore storage failures */
    }
  }
  applyAppearance(next)
  return next
}
