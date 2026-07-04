// Guards public API routes from being used as a free proxy by other websites.
// Browsers attach an Origin (or at least Referer) header to cross-site fetches,
// so a foreign origin is rejected. Requests without either header (server-to-
// server calls, internal route-to-route fetches, curl) are allowed — the goal
// is to stop other sites' frontends from burning our AniList rate limit, not
// to be an auth system.
export const isAllowedOrigin = (req: Request): boolean => {
  const raw = req.headers.get("origin") || req.headers.get("referer")
  if (!raw) return true

  let originHost: string
  try {
    originHost = new URL(raw).hostname
  } catch {
    return false
  }

  if (originHost === "localhost" || originHost === "127.0.0.1") return true

  try {
    if (originHost === new URL(req.url).hostname) return true
  } catch {
    /* fall through to the configured host check */
  }

  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").trim()
  if (appUrl) {
    try {
      if (originHost === new URL(appUrl).hostname) return true
    } catch {
      /* misconfigured env — ignore */
    }
  }

  return false
}
