import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Accept a Founding 25 invitation",
  description: "Review and securely accept a private Hikari Founding 25 invitation.",
  robots: { index: false, follow: false, noarchive: true },
}

export default function FoundingJoinLayout({ children }: { children: React.ReactNode }) {
  return children
}
