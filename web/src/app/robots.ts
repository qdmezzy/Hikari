import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/site-url"

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
