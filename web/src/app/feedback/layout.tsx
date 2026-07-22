import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Feedback",
  description: "Share feedback and help improve Hikari.",
  alternates: { canonical: "/feedback" },
  openGraph: {
    title: "Feedback · Hikari",
    description: "Share feedback and help improve Hikari.",
    url: "/feedback",
  },
}

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children
}
