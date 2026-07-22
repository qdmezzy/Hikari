import type { MetadataRoute } from "next"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hikari.raycodes.net"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/discord/link",
        "/founding/join",
        "/mod",
        "/settings",
        "/profile",
        "/lists",
        "/favorites",
        "/history",
        "/onboarding",
        "/import",
        "/banned",
        "/wrapped",
        "/community",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
