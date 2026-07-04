import type { Metadata } from "next"
import { fetchMediaMeta } from "./media-meta"

// The media page itself is a client component; this layout adds server-side
// metadata so shared links unfurl with the actual title, description and a
// branded per-title card instead of the generic site embed.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const media = await fetchMediaMeta(id)
  if (!media) return {}

  const bits = [
    media.type,
    media.year ? String(media.year) : "",
    media.score ? `★ ${(media.score / 10).toFixed(1)}` : "",
    media.genres.join(", "),
  ].filter(Boolean)

  const description = media.description || bits.join(" · ")

  return {
    title: media.title,
    description,
    openGraph: {
      title: `${media.title} · Hikari`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${media.title} · Hikari`,
      description,
    },
  }
}

export default function MediaLayout({ children }: { children: React.ReactNode }) {
  return children
}
