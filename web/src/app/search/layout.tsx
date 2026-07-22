import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Browse anime and manga",
  description: "Search anime and manga, filter by genre, and find your next watch or read.",
  alternates: { canonical: "/search" },
  openGraph: {
    title: "Browse anime and manga · Hikari",
    description: "Search the catalog, filter by genre, and find your next watch or read.",
    url: "/search",
  },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
