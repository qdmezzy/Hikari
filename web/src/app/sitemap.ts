import type { MetadataRoute } from "next"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hikari.raycodes.net"

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "", priority: 1 },
    { path: "/discover", priority: 0.9 },
    { path: "/search", priority: 0.9 },
    { path: "/community", priority: 0.8 },
    { path: "/calendar", priority: 0.7 },
    { path: "/extension", priority: 0.7 },
    { path: "/register", priority: 0.6 },
    { path: "/login", priority: 0.5 },
    { path: "/status", priority: 0.3 },
    { path: "/privacy", priority: 0.2 },
    { path: "/terms", priority: 0.2 },
  ]

  return pages.map(({ path, priority }) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: "weekly" as const,
    priority,
  }))
}
