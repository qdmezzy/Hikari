// Per-user accent color. Overrides the brand tokens (--primary / --accent /
// --ring, etc.) at runtime so the chosen accent applies app-wide. "banana" is
// the brand default and applies the per-mode values from globals.css (so light
// mode stays navy-on-cream); the other accents override with a single color
// that reads well in both modes. Persisted in localStorage for an instant,
// no-flash apply on reload; the settings page also mirrors it into the user's
// saved metadata so it follows them across devices.

export const ACCENT_STORAGE_KEY = "hikari-accent"
export const DEFAULT_ACCENT = "banana"

// swatch = the dot shown in settings. primary/accent/ring = token overrides.
// foreground = readable text color on top of the accent.
export const ACCENTS = {
  banana: { label: "Banana", swatch: "#faf0c7", primary: "#faf0c7", foreground: "#171a3d", accent: "#f4dd92", ring: "#faf0c7" },
  teal: { label: "Teal", swatch: "#22d3ee", primary: "#34d6e6", foreground: "#04313a", accent: "#7ce4ef", ring: "#34d6e6" },
  blue: { label: "Blue", swatch: "#0ea5e9", primary: "#38bdf8", foreground: "#052a44", accent: "#7dd3fc", ring: "#38bdf8" },
  purple: { label: "Purple", swatch: "#8b5cf6", primary: "#a78bfa", foreground: "#1d1240", accent: "#c4b5fd", ring: "#a78bfa" },
  pink: { label: "Pink", swatch: "#d946ef", primary: "#e879f9", foreground: "#3b0a40", accent: "#f0abfc", ring: "#e879f9" },
  orange: { label: "Orange", swatch: "#f97316", primary: "#fb923c", foreground: "#3a1702", accent: "#fdba74", ring: "#fb923c" },
  green: { label: "Green", swatch: "#10b981", primary: "#34d399", foreground: "#053527", accent: "#6ee7b7", ring: "#34d399" },
}

const OVERRIDE_PROPS = [
  "--primary",
  "--primary-foreground",
  "--accent",
  "--accent-foreground",
  "--ring",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-ring",
]

export const resolveAccent = (id) => (id && ACCENTS[id] ? id : DEFAULT_ACCENT)

export const applyAccentColor = (id) => {
  if (typeof document === "undefined") return
  const resolved = resolveAccent(id)
  const root = document.documentElement.style

  // Brand default: clear overrides so globals.css per-mode values take over.
  if (resolved === DEFAULT_ACCENT) {
    OVERRIDE_PROPS.forEach((prop) => root.removeProperty(prop))
    return
  }

  const a = ACCENTS[resolved]
  root.setProperty("--primary", a.primary)
  root.setProperty("--primary-foreground", a.foreground)
  root.setProperty("--accent", a.accent)
  root.setProperty("--accent-foreground", a.foreground)
  root.setProperty("--ring", a.ring)
  root.setProperty("--sidebar-primary", a.primary)
  root.setProperty("--sidebar-primary-foreground", a.foreground)
  root.setProperty("--sidebar-ring", a.ring)
}

export const loadAccentColor = () => {
  if (typeof window === "undefined") return DEFAULT_ACCENT
  try {
    return resolveAccent(window.localStorage.getItem(ACCENT_STORAGE_KEY))
  } catch {
    return DEFAULT_ACCENT
  }
}

// Persist + apply in one call. Returns the resolved id.
export const saveAccentColor = (id) => {
  const resolved = resolveAccent(id)
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, resolved)
    } catch {
      /* ignore storage failures */
    }
  }
  applyAccentColor(resolved)
  return resolved
}
