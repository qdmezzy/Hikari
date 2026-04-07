"use client"

import Link from "next/link"
import { Navigation } from "@/components/Navigation"
import RequireAuth from "@/components/RequireAuth"
import useAuth from "@/hooks/useAuth"
import { SocialFeed } from "@/components/social/SocialFeed"
import { SocialSidebar } from "@/components/social/SocialSidebar"
import { Button } from "@/components/ui/button"
import { MessageCircle } from "lucide-react"

const DISCORD_COMMUNITY_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "/discord/link"

export default function SocialPage() {
  const { user, loading } = useAuth()
  const isMod = user?.user_metadata?.is_mod === true || user?.user_metadata?.isMod === true

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <RequireAuth>
      {!isMod ? (
        <div className="min-h-screen bg-background">
          <Navigation />
          <main className="pt-28 pb-20 md:pb-8">
            <div className="mx-auto max-w-3xl px-4">
              <div className="rounded-2xl border border-border/50 bg-card/60 p-8 text-center shadow-xl shadow-black/10">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-400">Coming Soon</p>
                <h1 className="mt-3 text-2xl font-semibold text-foreground">Social is launching soon</h1>
                <p className="mt-3 text-muted-foreground">
                  Social is still being finished for the wider community. Moderators can access it now while we keep
                  building things out.
                </p>
                <p className="mt-2 text-sm text-muted-foreground/80">
                  Join the Discord community in the meantime to hang out, get updates, and be first in when it opens.
                </p>
                <div className="mt-6 flex items-center justify-center">
                  <Button asChild size="lg" className="rounded-full px-6">
                    <Link href={DISCORD_COMMUNITY_URL} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-4 w-4" />
                      Join the Discord
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </main>
        </div>
      ) : (
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
      )}
    </RequireAuth>
  )
}
