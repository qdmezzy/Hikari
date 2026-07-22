import type { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://hikari.raycodes.net").replace(/\/$/, "")

const getPublicMedia = async () => {
  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: `query SitemapMedia { Page(page: 1, perPage: 100) { media(type: ANIME, isAdult: false, sort: POPULARITY_DESC) { id updatedAt } } }`,
      }),
      next: { revalidate: 86400 },
    })
    if (!response.ok) return []
    const body = await response.json()
    return body?.data?.Page?.media || []
  } catch {
    return []
  }
}

const getIndexableProfiles = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return []
  try {
    const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
    const { data, error } = await supabase
      .from("public_profiles")
      .select("handle, updated_at")
      .eq("public_profile", true)
      .limit(1000)
    return error ? [] : data || []
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = [
    { path: "", priority: 1 },
    { path: "/discover", priority: 0.9 },
    { path: "/search", priority: 0.9 },
    { path: "/calendar", priority: 0.7 },
    { path: "/discord-bot", priority: 0.8 },
    { path: "/founding", priority: 0.7 },
    { path: "/feedback", priority: 0.4 },
    { path: "/status", priority: 0.3 },
    { path: "/privacy", priority: 0.2 },
    { path: "/terms", priority: 0.2 },
  ].map(({ path, priority }) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: "weekly" as const,
    priority,
  }))

  const [media, profiles] = await Promise.all([getPublicMedia(), getIndexableProfiles()])
  const mediaEntries = media.map((item: { id: number; updatedAt?: number }) => ({
    url: `${siteUrl}/media/${item.id}`,
    lastModified: item.updatedAt ? new Date(item.updatedAt * 1000) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }))
  const profileEntries = profiles.map((profile: { handle: string; updated_at?: string }) => ({
    url: `${siteUrl}/u/${encodeURIComponent(profile.handle)}`,
    lastModified: profile.updated_at ? new Date(profile.updated_at) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.4,
  }))

  return [...pages, ...mediaEntries, ...profileEntries]
}
