import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Anime airing calendar",
  description: "See when currently airing anime episodes are scheduled and plan what to watch next.",
  alternates: { canonical: "/calendar" },
  openGraph: {
    title: "Anime airing calendar · Hikari",
    description: "See upcoming anime episodes and build your weekly watch schedule.",
    url: "/calendar",
  },
}

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return children
}
