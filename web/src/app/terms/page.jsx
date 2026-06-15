import Link from "next/link"
import { Navigation } from "@/components/layout/Navigation"

export const metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Hikari.",
}

const sections = [
  {
    h: "1. Acceptance of terms",
    p: "By creating an account or using Hikari (the \"Service\"), you agree to these Terms of Service. If you do not agree, please do not use the Service. Hikari is currently in a closed beta and is provided as-is while we build it.",
  },
  {
    h: "2. Your account",
    p: "You are responsible for your account and for keeping your login secure. You must be at least 13 years old (or the minimum age in your country) to use Hikari. You may sign in with email or a supported third-party provider (Google, Discord). You are responsible for activity that happens under your account.",
  },
  {
    h: "3. Acceptable use",
    p: "Don't use Hikari to post unlawful, hateful, harassing, or infringing content; to spam; to scrape or abuse our APIs; or to attempt to break, overload, or gain unauthorized access to the Service. We may remove content and suspend or terminate accounts that violate these terms.",
  },
  {
    h: "4. Your content",
    p: "You keep ownership of the lists, reviews, posts, and other content you create. By posting it, you grant Hikari a non-exclusive license to display and distribute it within the Service. You are responsible for the content you post, and you can delete your content or account at any time.",
  },
  {
    h: "5. Anime data & third parties",
    p: "Anime and manga metadata is provided by third-party services including AniList and MyAnimeList, and is subject to their terms. Hikari is not affiliated with or endorsed by AniList, MyAnimeList, Crunchyroll, Discord, or any streaming platform. Links to streaming sites are provided for convenience only.",
  },
  {
    h: "6. Service availability",
    p: "Hikari is in beta and provided \"as is\" and \"as available,\" without warranties of any kind. Features may change, break, or be removed, and data may occasionally be lost. We are not liable for any indirect or consequential damages arising from your use of the Service, to the extent permitted by law.",
  },
  {
    h: "7. Termination",
    p: "You may stop using Hikari and delete your account at any time from Settings. We may suspend or terminate accounts that violate these terms or the rights of others.",
  },
  {
    h: "8. Changes",
    p: "We may update these terms as Hikari evolves. We'll update the date below when we do; continued use after changes means you accept the updated terms.",
  },
  {
    h: "9. Contact",
    p: "Questions about these terms? Reach us in the Hikari Discord server.",
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-24 md:px-6 lg:pt-28">
        <header className="animate-rise">
          <p className="font-jp text-sm font-medium tracking-[0.3em] text-primary/70">利用規約</p>
          <h1 className="mt-1 text-balance text-3xl font-bold tracking-tight md:text-4xl">Terms of Service</h1>
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
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </main>
    </div>
  )
}
