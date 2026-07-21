import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Bot,
  Check,
  Clock3,
  ExternalLink,
  GitCompareArrows,
  ListChecks,
  MessageCircleMore,
  PlayCircle,
  Sparkles,
  Trophy,
  UserRound,
  UsersRound,
} from "lucide-react"

import { Navigation } from "@/components/layout/Navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hikari.raycodes.net"
const canonicalUrl = `${siteUrl.replace(/\/$/, "")}/discord-bot`

export const metadata: Metadata = {
  title: "Hikari for Discord",
  description:
    "Add Hikari to Discord for anime recommendations, airing alerts, episode tracking, shared lists, taste comparisons, server stats, and leaderboards.",
  alternates: { canonical: canonicalUrl },
  openGraph: {
    type: "website",
    siteName: "Hikari",
    url: canonicalUrl,
    title: "Hikari for Discord",
    description: "Discover, track, compare, and share anime without leaving Discord.",
    images: [{ url: "/brand/og.jpg", width: 2560, height: 1440, alt: "Hikari for Discord" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hikari for Discord",
    description: "Anime recommendations, tracking, alerts, stats, and shared lists inside Discord.",
    images: ["/brand/og.jpg"],
  },
}

const features = [
  { icon: Sparkles, title: "Anime recommendations", description: "Find a tailored next watch by mood, tags, and your Hikari history." },
  { icon: BellRing, title: "Airing alerts", description: "Send timely episode alerts and daily schedules to the channel you choose." },
  { icon: ListChecks, title: "Episode tracking", description: "Update progress, status, scores, and lists with quick slash commands." },
  { icon: UserRound, title: "Profiles", description: "Bring your Hikari profile, favorites, watch time, and top genres into chat." },
  { icon: UsersRound, title: "Shared lists", description: "Share polished anime, profile, and list cards with your community." },
  { icon: GitCompareArrows, title: "Taste comparisons", description: "See shared shows, genre overlap, and compatibility with friends." },
  { icon: BarChart3, title: "Server stats", description: "Turn watching activity into useful server-wide snapshots and streaks." },
  { icon: Trophy, title: "Leaderboards", description: "Celebrate the most active watchers with weekly and monthly rankings." },
]

const commands = [
  { command: "/discover recommend", detail: "Get a pick based on mood, tags, and taste." },
  { command: "/list next", detail: "Advance the episode you are watching." },
  { command: "/profile", detail: "Show a Hikari profile in Discord." },
  { command: "/compare @friend", detail: "Compare your anime taste with a friend." },
  { command: "/share list", detail: "Post a clean, shareable list preview." },
  { command: "/stats server", detail: "See server activity and community stats." },
]

const steps = [
  { number: "01", title: "Add Hikari", description: "Choose your Discord server and approve the requested bot permissions." },
  { number: "02", title: "Link your account", description: "Run /account and securely connect your own Hikari profile." },
  { number: "03", title: "Start watching", description: "Recommend, track, share, compare, and configure optional airing alerts." },
]

const discordBotInviteUrl = process.env.NEXT_PUBLIC_DISCORD_BOT_INVITE_URL || "#install"
const discordInviteUrl = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "#community"

const externalProps = (href: string) =>
  href.startsWith("http") ? { target: "_blank" as const, rel: "noreferrer" } : {}

function DiscordMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 127.14 96.36" className={className} fill="currentColor" aria-hidden="true">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21a105.73,105.73,0,0,0,32.17,16.15A77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  )
}

export default function DiscordBotPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <Navigation />

      <main>
        <section className="relative px-4 pb-24 pt-32 md:px-8 md:pb-28 md:pt-40">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute left-[8%] top-24 size-72 rounded-full bg-[#5865F2]/20 blur-3xl md:size-[28rem]" />
            <div className="absolute right-[4%] top-44 size-72 rounded-full bg-primary/15 blur-3xl md:size-[24rem]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#5865F2]/50 to-transparent" />
          </div>

          <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="animate-rise text-center lg:text-left">
              <Badge className="mb-6 border-[#5865F2]/25 bg-[#5865F2]/12 px-4 py-1.5 text-[#a3a9f9] shadow-[0_12px_40px_-24px_rgba(88,101,242,0.9)]">
                <DiscordMark className="size-4" />
                Your anime companion, now in Discord
              </Badge>
              <p className="font-jp text-sm font-semibold tracking-[0.32em] text-primary/70">ヒカリ・フォー・ディスコード</p>
              <h1 className="mt-4 text-balance text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
                Hikari for <span className="text-gradient">Discord</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl lg:mx-0">
                Discover your next anime, track every episode, compare taste with friends, and keep your server up to date — all without leaving Discord.
              </p>
              <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
                <Button asChild size="lg" className="h-14 rounded-2xl bg-[#5865F2] px-7 text-base font-bold text-white shadow-[0_18px_55px_-22px_rgba(88,101,242,0.95)] hover:bg-[#4752c4]">
                  <Link href={discordBotInviteUrl} {...externalProps(discordBotInviteUrl)}>
                    <DiscordMark />
                    Add Hikari to Discord
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-14 rounded-2xl border-border/70 bg-card/40 px-7 text-base backdrop-blur-sm">
                  <Link href={discordInviteUrl} {...externalProps(discordInviteUrl)}>
                    <MessageCircleMore className="size-5" />
                    Join the Hikari Server
                  </Link>
                </Button>
              </div>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground lg:justify-start">
                {["Free to add", "Slash commands", "Optional account linking"].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-400"><Check className="size-3" /></span>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="animate-slide-in-right [animation-delay:160ms]">
              <div className="relative mx-auto max-w-xl rounded-[28px] border border-white/10 bg-[#111827]/90 p-3 shadow-[0_32px_90px_-38px_rgba(0,0,0,0.9)] backdrop-blur-xl">
                <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3 text-xs font-medium text-white/45">
                  <span className="size-2.5 rounded-full bg-red-400/80" />
                  <span className="size-2.5 rounded-full bg-amber-300/80" />
                  <span className="size-2.5 rounded-full bg-emerald-400/80" />
                  <span className="ml-2"># anime-club</span>
                </div>
                <div className="space-y-5 p-4 sm:p-6">
                  <div className="flex gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground"><Bot className="size-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><span className="font-bold text-white">Hikari</span><span className="rounded bg-[#5865F2] px-1 py-0.5 text-[9px] font-bold text-white">APP</span><span className="text-xs text-white/35">Today at 8:42 PM</span></div>
                      <div className="mt-2 rounded-xl border-l-4 border-primary bg-[#0b1220] p-4">
                        <p className="text-sm font-semibold text-primary">✨ Recommendation</p>
                        <p className="mt-2 text-lg font-bold text-white">Frieren: Beyond Journey&apos;s End</p>
                        <p className="mt-1 text-sm leading-6 text-white/55">A thoughtful fantasy journey with a strong match for your adventure and drama favorites.</p>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/60">
                          <span className="rounded-lg bg-white/5 px-3 py-2">Match <b className="text-white">94%</b></span>
                          <span className="rounded-lg bg-white/5 px-3 py-2">Score <b className="text-white">9.0</b></span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-md bg-[#5865F2] px-3 py-1.5 text-xs font-semibold text-white">Next Pick</span>
                        <span className="rounded-md bg-[#248046] px-3 py-1.5 text-xs font-semibold text-white">Add to List</span>
                        <span className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">Open on Hikari</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.035] px-4 py-3 font-mono text-sm text-white/65">
                    <span className="text-[#a3a9f9]">/discover recommend</span> mood:<span className="text-primary">chill</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/45 bg-card/20 px-4 py-24 md:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="font-jp text-xs font-semibold tracking-[0.3em] text-primary/65">サーバーをもっと楽しく</p>
              <h2 className="mt-3 text-balance text-3xl font-bold sm:text-4xl">Everything your anime community needs</h2>
              <p className="mt-4 text-muted-foreground">Useful when you need it, quiet when you do not. Hikari responds to commands and only posts scheduled alerts where an admin enables them.</p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => (
                <Card key={feature.title} className="group gap-4 border-border/55 bg-card/55 py-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-xl" style={{ animationDelay: `${index * 60}ms` }}>
                  <CardHeader className="gap-4 px-5">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110"><feature.icon className="size-5" /></div>
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5"><CardDescription className="leading-6">{feature.description}</CardDescription></CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-24 md:px-8">
          <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary"><PlayCircle className="size-3.5" /> Slash commands</Badge>
              <h2 className="mt-5 text-balance text-3xl font-bold sm:text-4xl">Simple commands, useful answers</h2>
              <p className="mt-4 max-w-xl leading-7 text-muted-foreground">Hikari uses Discord&apos;s native command picker, so members can discover options as they type. No prefix to remember and no noisy automatic replies.</p>
              <div className="mt-8 grid gap-3">
                {commands.map((item) => (
                  <div key={item.command} className="group flex flex-col gap-2 rounded-2xl border border-border/50 bg-card/40 p-4 transition-colors hover:border-[#5865F2]/35 sm:flex-row sm:items-center sm:justify-between">
                    <code className="font-mono text-sm font-semibold text-[#a3a9f9]">{item.command}</code>
                    <span className="text-sm text-muted-foreground sm:text-right">{item.detail}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-8 rounded-full bg-gradient-to-br from-[#5865F2]/15 to-primary/10 blur-3xl" aria-hidden="true" />
              <Card className="relative gap-0 overflow-hidden rounded-[28px] border-border/60 bg-card/80 py-0 shadow-2xl backdrop-blur-xl">
                <CardHeader className="border-b border-border/50 p-7">
                  <Badge className="w-fit bg-emerald-500/10 text-emerald-400"><Clock3 className="size-3.5" /> About two minutes</Badge>
                  <CardTitle className="mt-3 text-2xl">Set up Hikari in three steps</CardTitle>
                  <CardDescription>No dashboard maze. Add it, connect, and start using commands.</CardDescription>
                </CardHeader>
                <CardContent className="p-7">
                  <ol className="space-y-7">
                    {steps.map((step, index) => (
                      <li key={step.number} className="relative flex gap-4">
                        {index < steps.length - 1 ? <span className="absolute left-5 top-11 h-[calc(100%+0.75rem)] w-px bg-border" aria-hidden="true" /> : null}
                        <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 font-mono text-xs font-bold text-primary">{step.number}</span>
                        <div><h3 className="font-semibold">{step.title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{step.description}</p></div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="install" className="scroll-mt-24 px-4 pb-24 md:px-8">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] border border-[#5865F2]/25 bg-gradient-to-br from-[#5865F2]/18 via-card to-primary/10 px-6 py-14 text-center shadow-[0_30px_90px_-45px_rgba(88,101,242,0.8)] sm:px-12 sm:py-16">
            <div className="absolute -left-20 -top-20 size-56 rounded-full bg-[#5865F2]/20 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#5865F2] text-white shadow-lg"><DiscordMark className="size-7" /></div>
              <h2 className="mt-6 text-balance text-3xl font-black sm:text-5xl">Bring Hikari to your server</h2>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">Give your community a better way to discover, track, and celebrate anime together.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-14 rounded-2xl bg-[#5865F2] px-8 text-base font-bold text-white hover:bg-[#4752c4]">
                  <Link href={discordBotInviteUrl} {...externalProps(discordBotInviteUrl)}><DiscordMark /> Add Hikari to Discord <ExternalLink className="size-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-14 rounded-2xl bg-background/45 px-8 text-base backdrop-blur-sm">
                  <Link href={discordInviteUrl} {...externalProps(discordInviteUrl)}><MessageCircleMore className="size-5" /> Join the Hikari Server</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer id="community" className="scroll-mt-24 border-t border-border/50 bg-card/25">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>光 Hikari — your anime journey, shared.</p>
          <div className="flex items-center gap-5">
            <Link href="/" className="transition-colors hover:text-foreground">Hikari Home</Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href={discordInviteUrl} {...externalProps(discordInviteUrl)} className="transition-colors hover:text-[#a3a9f9]">Discord Server</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
