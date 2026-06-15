import Link from "next/link"
import { Navigation } from "@/components/layout/Navigation"

export const metadata = {
  title: "Privacy Policy",
  description: "How Hikari collects, uses, and protects your data.",
}

const sections = [
  {
    h: "1. What we collect",
    p: "Account info (email, username, and any profile details you add like display name, avatar, bio); your anime/manga activity (lists, progress, scores, favorites, reviews, posts); and basic technical data needed to run the Service. If you connect MyAnimeList, AniList, or Discord, we store the data needed to link those accounts.",
  },
  {
    h: "2. How we use it",
    p: "To provide the core features — tracking, discovery, lists, profiles, and community — to personalize recommendations, and to keep the Service secure. We do not sell your personal data.",
  },
  {
    h: "3. What's public",
    p: "Your public profile (handle, display name, and the stats/lists you choose to share) is visible to others, including via shareable links. You control visibility from Settings → Privacy, including hiding individual entries and your watch activity, favorites, and stats.",
  },
  {
    h: "4. Third-party services",
    p: "We use Supabase for authentication and storage, AniList and MyAnimeList for anime data and imports, and Discord for the optional bot and account linking. Your use of those integrations is also subject to their privacy policies.",
  },
  {
    h: "5. Cookies & sessions",
    p: "We use essential cookies/local storage to keep you signed in and remember preferences like your theme. We don't use them for advertising.",
  },
  {
    h: "6. Your rights",
    p: "You can view and edit your data in Settings, control what's public, and delete your account and associated data at any time from Settings → Account. Deleting your account removes your profile, lists, and content from the Service.",
  },
  {
    h: "7. Data retention & security",
    p: "We keep your data while your account is active. We take reasonable measures to protect it, but no online service can guarantee absolute security — especially during beta.",
  },
  {
    h: "8. Changes",
    p: "We'll update this policy as Hikari grows and update the date below when we do.",
  },
  {
    h: "9. Contact",
    p: "Privacy questions? Reach us in the Hikari Discord server.",
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-24 md:px-6 lg:pt-28">
        <header className="animate-rise">
          <p className="font-jp text-sm font-medium tracking-[0.3em] text-primary/70">プライバシー</p>
          <h1 className="mt-1 text-balance text-3xl font-bold tracking-tight md:text-4xl">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: June 14, 2026</p>
        </header>

        <div className="selectable mt-8 space-y-7">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-semibold text-foreground">{s.h}</h2>
              <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">{s.p}</p>
            </section>
          ))}
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          See also our{" "}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </main>
    </div>
  )
}
