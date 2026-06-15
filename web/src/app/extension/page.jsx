"use client"

import Link from "next/link"
import { Navigation } from "@/components/layout/Navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, Chrome, Clock, Eye, Sparkles, Zap } from "lucide-react"

const FEATURES = [
  {
    icon: Zap,
    title: "Auto-track",
    desc: "Update your progress automatically as you watch on supported sites.",
  },
  {
    icon: Eye,
    title: "Spoiler shield",
    desc: "Hide episode titles, thumbnails, and comments beyond where you are.",
  },
  {
    icon: Bell,
    title: "Episode alerts",
    desc: "Get a nudge the moment a new episode of something you follow drops.",
  },
]

export default function ExtensionPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="pt-24 pb-24 md:pb-8">
        <section className="relative px-4 md:px-8">
          <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-20 right-1/4 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />

          <div className="relative mx-auto max-w-3xl text-center">
            <p className="font-jp text-sm font-medium tracking-[0.3em] text-primary/70">拡張機能</p>

            <Badge className="mt-4 mb-5 border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-primary">
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Coming soon
            </Badge>

            <h1 className="text-balance text-4xl font-bold md:text-6xl">
              The Hikari <span className="text-gradient">browser extension</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-xl text-muted-foreground">
              Auto-track what you watch, block spoilers, and catch new episodes — right from your browser.
              We&apos;re putting the finishing touches on it.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                disabled
                className="h-14 gap-3 rounded-2xl bg-gradient-to-r from-primary to-accent px-8 text-lg opacity-70"
              >
                <Chrome className="h-6 w-6" />
                Install Extension
                <Badge className="ml-1 bg-white/20 text-xs text-white">Soon</Badge>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 rounded-2xl px-8 text-lg">
                <Link href="/discord/link">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Get notified on Discord
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="px-4 md:px-8 py-16">
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-border/50 bg-card/50 p-6 text-left backdrop-blur-sm"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-muted-foreground">
            Want it sooner?{" "}
            <Link href="/feedback" className="text-primary hover:underline">
              Tell us you&apos;re waiting
            </Link>{" "}
            — it bumps the priority.
          </p>
        </section>
      </main>
    </div>
  )
}
