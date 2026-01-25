import { Navigation } from "@/components/Navigation"
import { SocialFeed } from "@/components/social/SocialFeed"
import { SocialSidebar } from "@/components/social/SocialSidebar"

export default function SocialPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="relative pt-28 pb-20 md:pb-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-fuchsia-500/10 via-rose-500/5 to-transparent blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SocialFeed />
            </div>
            <div className="hidden lg:block">
              <SocialSidebar />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
