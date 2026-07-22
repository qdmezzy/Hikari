import type { Metadata } from "next"

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://hikari.raycodes.net").replace(/\/$/, "")

export const metadata: Metadata = {
  title: "The Founding 25",
  description: "Meet Hikari's first 25 approved community members and see how this invitation-only group helps shape the product.",
  alternates: { canonical: `${siteUrl}/founding` },
  openGraph: {
    type: "website",
    url: `${siteUrl}/founding`,
    title: "The Founding 25 · Hikari",
    description: "An invitation-only group of the first 25 community members helping shape Hikari.",
  },
}

export default function FoundingLayout({ children }: { children: React.ReactNode }) {
  return children
}
