import type { MetadataRoute } from "next"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hikari.raycodes.net"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/mod", "/settings", "/onboarding", "/import", "/banned", "/reset-password"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
