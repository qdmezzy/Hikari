"use client"

import Link from "next/link"
import { ArrowRight, Brain, Calendar, Compass, Eye, ListVideo, Search, Shield, Sparkles, Users, Zap } from "lucide-react"
import { V2Header } from "@/components/V2Header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

const featuredSeries = [
  {
    title: "Frieren: Beyond Journey's End",
    blurb: "A colder, calmer redesign direction with cinematic hero storytelling and cleaner section hierarchy.",
    tags: ["Adventure", "Fantasy", "Drama"],
  },
  {
    title: "Solo Leveling",
    blurb: "Sharper cards, softer frosted surfaces, and stronger visual separation between discovery and tracking tools.",
    tags: ["Action", "Fantasy", "Hype"],
  },
]

const previewFeatures = [
  {
    icon: Brain,
    title: "AI-forward surfaces",
    text: "Spotlights recommendations, reasons, and confidence in a more editorial way.",
  },
  {
    icon: Shield,
    title: "Spoiler-safe structure",
    text: "Keeps spoiler controls prominent instead of hiding them behind utility menus.",
  },
  {
    icon: ListVideo,
    title: "Tracking-first layout",
    text: "Progress, lists, and continue-watching sections get more visual weight.",
  },
  {
    icon: Users,
    title: "Community-ready shell",
    text: "Makes room for social/community actions without forcing them into every screen yet.",
  },
]

const previewRoutes = [
  { href: "/", label: "Current Home" },
  { href: "/discover", label: "Current Discover" },
  { href: "/lists", label: "Current My List" },
  { href: "/social", label: "Current Social" },
]

export default function V2PreviewPage() {
  return (
    <div className="glacier-preview text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="glacier-float absolute -left-28 top-20 h-72 w-72 rounded-full bg-sky-400/18 blur-3xl" />
        <div className="glacier-float absolute right-0 top-1/3 h-80 w-80 rounded-full bg-cyan-300/12 blur-3xl" style={{ animationDelay: "2s" }} />
        <div className="glacier-float absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-blue-500/14 blur-3xl" style={{ animationDelay: "4s" }} />
      </div>

      <V2Header />

      <main className="relative z-10 px-4 pb-20 pt-8">
        <section className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="glacier-panel rounded-[36px] p-8 md:p-10">
            <Badge className="rounded-full border-0 bg-sky-400/15 px-4 py-1 text-sky-200">New website design preview</Badge>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">
              <span className="glacier-title">Hikari with the new design direction</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              This preview brings the new `b_8p0mcDWLqIF` visual language into the live app as a safe `v2` route, so
              we can iterate without overwriting the current experience or losing pages the redesign has not covered yet.
            </p>

            <div className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
              <div className="glacier-chip flex flex-1 items-center rounded-full px-4">
                <Search className="h-4 w-4 text-sky-200" />
                <Input
                  readOnly
                  value="Search anime, lists, and people..."
                  className="border-0 bg-transparent text-white shadow-none focus-visible:ring-0"
                />
              </div>
              <Button asChild className="rounded-full bg-gradient-to-r from-sky-400 to-cyan-300 px-6 font-semibold text-slate-950 hover:opacity-90">
                <Link href="/search">
                  Explore
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {featuredSeries.map((item) => (
                <div key={item.title} className="glacier-chip rounded-[28px] p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-200/70">Featured direction</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">{item.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{item.blurb}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="glacier-panel rounded-[32px] p-7">
              <p className="text-xs uppercase tracking-[0.26em] text-sky-200/70">What got added</p>
              <div className="mt-5 space-y-4">
                {previewFeatures.map((feature) => {
                  const Icon = feature.icon
                  return (
                    <div key={feature.title} className="flex gap-4 rounded-[24px] border border-white/8 bg-white/5 p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-300/12 text-sky-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{feature.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{feature.text}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="glacier-panel rounded-[32px] p-7">
              <p className="text-xs uppercase tracking-[0.26em] text-sky-200/70">Live routes to compare</p>
              <div className="mt-5 grid gap-3">
                {previewRoutes.map((route) => (
                  <Link
                    key={route.href}
                    href={route.href}
                    className="glacier-chip flex items-center justify-between rounded-[22px] px-4 py-3 text-sm text-slate-200 hover:text-white"
                  >
                    <span>{route.label}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-8 max-w-7xl">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="glacier-panel rounded-[30px] p-6">
              <Compass className="h-6 w-6 text-sky-200" />
              <h3 className="mt-4 text-xl font-semibold">Cleaner discovery</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                More space for hero storytelling, editorial callouts, and stronger visual grouping of content shelves.
              </p>
            </div>
            <div className="glacier-panel rounded-[30px] p-6">
              <Eye className="h-6 w-6 text-sky-200" />
              <h3 className="mt-4 text-xl font-semibold">Softer frosted UI</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                The preview leans into icy glass cards and cooler gradients instead of the current warmer neon palette.
              </p>
            </div>
            <div className="glacier-panel rounded-[30px] p-6">
              <Calendar className="h-6 w-6 text-sky-200" />
              <h3 className="mt-4 text-xl font-semibold">Safe migration path</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                We can now port page-by-page into the redesign without removing moderation, dashboard, social, or account flows.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-8 max-w-7xl">
          <div className="glacier-panel rounded-[36px] p-8 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-sky-200/70">Next step</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">Pick which pages should migrate first</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  The new design source currently covers only part of the app. We can now roll it into real pages one
                  section at a time instead of doing a risky all-at-once replacement.
                </p>
              </div>
              <Button asChild className="rounded-full bg-white text-slate-950 hover:bg-slate-100">
                <Link href="/lists">
                  Start from my list
                  <Zap className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
