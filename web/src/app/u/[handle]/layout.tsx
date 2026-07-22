import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://hikari.raycodes.net").replace(/\/$/, "")

const normalizeHandle = (value: string) =>
  String(value || "").replace(/^@/, "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "")

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle: rawHandle } = await params
  const handle = normalizeHandle(rawHandle)
  const canonical = `${siteUrl}/u/${encodeURIComponent(handle)}`
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!handle || !supabaseUrl || !key) {
    return { title: "Profile", alternates: { canonical }, robots: { index: false, follow: false } }
  }

  const supabase = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data } = await supabase
    .from("public_profiles")
    .select("handle, display_name, bio, avatar_url, public_profile")
    .eq("handle", handle)
    .maybeSingle()

  if (!data || data.public_profile === false) {
    return {
      title: data?.public_profile === false ? "Private profile" : "Profile not found",
      alternates: { canonical },
      robots: { index: false, follow: false, noarchive: true },
    }
  }

  const name = data.display_name || `@${data.handle}`
  const description = data.bio || `See ${name}'s public anime profile, lists, favorites, and stats on Hikari.`
  return {
    title: name,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "profile",
      url: canonical,
      title: `${name} · Hikari`,
      description,
      images: data.avatar_url ? [{ url: data.avatar_url, alt: name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} · Hikari`,
      description,
    },
  }
}

export default function PublicProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
