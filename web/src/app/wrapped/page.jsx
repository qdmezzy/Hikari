"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  CalendarDays,
  Clapperboard,
  Clock,
  Film,
  Flame,
  Loader2,
  Share2,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react"
import { Navigation } from "@/components/layout/Navigation"
import RequireAuth from "@/components/common/RequireAuth"
import { Button } from "@/components/ui/button"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { fetchAniListMediaByIds, getMediaTitle } from "@/lib/anilist"
import { computeWrapped, MONTH_NAMES } from "@/lib/wrapped"

const Reveal = ({ children, delay = 0, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 28 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
)

const StatTile = ({ icon: Icon, value, label, accent }) => (
  <div className="rounded-3xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm">
    <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${accent}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="text-4xl font-black tracking-tight text-foreground">{value}</div>
    <div className="mt-1 text-sm text-muted-foreground">{label}</div>
  </div>
)

function WrappedContent() {
  const { user } = useAuth()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!user) return
      setLoading(true)
      const { data, error } = await client
        .from("list_entries")
        .select("id, media_id, status, progress, score, media_type, updated_at")
        .eq("user_id", user.id)

      if (!active) return
      if (error || !data?.length) {
        setEntries([])
        setLoading(false)
        return
      }
      try {
        const mediaById = await fetchAniListMediaByIds(data.map((e) => e.media_id))
        if (!active) return
        setEntries(data.map((e) => ({ ...e, media: mediaById.get(e.media_id) || null })))
      } catch {
        if (active) setEntries(data.map((e) => ({ ...e, media: null })))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [user])

  const wrapped = useMemo(() => computeWrapped(entries, year), [entries, year])
  const years = useMemo(() => [now.getFullYear(), now.getFullYear() - 1], [now])

  const handleShare = async () => {
    const t = wrapped.totals
    const text = `My ${year} Hikari Wrapped 🌸 — ${t.completed} titles, ${t.episodesWatched} episodes, ${t.hoursWatched}h watched. I'm "${wrapped.personality.title}". Make yours:`
    const url = typeof window !== "undefined" ? `${window.location.origin}/wrapped` : "/wrapped"
    try {
      if (navigator.share) {
        await navigator.share({ title: "Hikari Wrapped", text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      toast.success("Copied your Wrapped to share!")
    } catch {
      /* user cancelled */
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const t = wrapped.totals
  const maxMonth = Math.max(1, ...wrapped.months)

  return (
    <main className="relative mx-auto max-w-3xl px-4 pb-28 pt-24 md:px-6">
      {/* Hero */}
      <div className="relative text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <Reveal className="relative">
          <p className="font-jp text-sm font-medium tracking-[0.34em] text-primary/70">まとめ</p>
          <h1 className="mt-3 text-5xl font-black tracking-tight md:text-7xl">
            <span className="text-gradient">{year}</span> Wrapped
          </h1>
          <p className="mt-3 text-pretty text-lg text-muted-foreground">
            Your year in anime &amp; manga, {user?.user_metadata?.display_name || "fan"}.
          </p>

          <div className="mt-6 inline-flex rounded-full border border-border/60 bg-card/60 p-1">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  year === y ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </Reveal>
      </div>

      {!wrapped.hasData ? (
        <Reveal className="mt-16 rounded-3xl border border-border/50 bg-card/60 p-10 text-center">
          <Sparkles className="mx-auto mb-4 h-10 w-10 text-primary/60" />
          <h2 className="text-xl font-bold text-foreground">No activity in {year} yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            Track some anime or manga and your Wrapped will fill in. Pick a different year above, or start watching.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild>
              <Link href="/search">Browse titles</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/lists">My list</Link>
            </Button>
          </div>
        </Reveal>
      ) : (
        <>
          {/* Headline stats */}
          <div className="mt-14 grid grid-cols-2 gap-4">
            <Reveal delay={0.05}>
              <StatTile icon={Clock} value={`${t.hoursWatched}h`} label={`${t.daysWatched} days of anime`} accent="bg-cyan-500/10 text-cyan-400" />
            </Reveal>
            <Reveal delay={0.1}>
              <StatTile icon={Film} value={t.episodesWatched.toLocaleString()} label="episodes watched" accent="bg-violet-500/10 text-violet-400" />
            </Reveal>
            <Reveal delay={0.15}>
              <StatTile icon={Trophy} value={t.completed.toLocaleString()} label="titles completed" accent="bg-amber-500/10 text-amber-400" />
            </Reveal>
            <Reveal delay={0.2}>
              <StatTile icon={Clapperboard} value={t.chaptersRead.toLocaleString()} label="chapters read" accent="bg-emerald-500/10 text-emerald-400" />
            </Reveal>
          </div>

          {/* Personality */}
          <Reveal className="mt-6">
            <div className="overflow-hidden rounded-3xl border border-primary/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(168,85,247,0.12))] p-8 text-center">
              <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Your {year} watcher type</p>
              <h2 className="mt-2 text-3xl font-black text-gradient md:text-4xl">{wrapped.personality.title}</h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">{wrapped.personality.blurb}</p>
            </div>
          </Reveal>

          {/* Top genres */}
          {wrapped.topGenres.length ? (
            <Reveal className="mt-6 rounded-3xl border border-border/50 bg-card/60 p-7">
              <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-foreground">
                <Sparkles className="h-5 w-5 text-primary" /> Your top genres
              </h3>
              <div className="space-y-3">
                {wrapped.topGenres.map((genre, i) => {
                  const pct = Math.round((genre.count / wrapped.topGenres[0].count) * 100)
                  return (
                    <div key={genre.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">
                          {i + 1}. {genre.name}
                        </span>
                        <span className="text-muted-foreground">{genre.count}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: i * 0.08 }}
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Reveal>
          ) : null}

          {/* Highlights */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {wrapped.topRated?.media ? (
              <Reveal>
                <HighlightCard
                  label="Highest rated"
                  icon={Star}
                  entry={wrapped.topRated}
                  meta={`You scored it ${Number(wrapped.topRated.score) > 10 ? (Number(wrapped.topRated.score) / 10).toFixed(1) : Number(wrapped.topRated.score)}/10`}
                />
              </Reveal>
            ) : null}
            {wrapped.mostBinged?.media ? (
              <Reveal delay={0.08}>
                <HighlightCard
                  label="Most binged"
                  icon={Flame}
                  entry={wrapped.mostBinged}
                  meta={`${wrapped.mostBinged.media_type === "MANGA" ? "Chapters" : "Episodes"}: ${wrapped.mostBinged.progress || 0}`}
                />
              </Reveal>
            ) : null}
          </div>

          {/* Busiest month */}
          <Reveal className="mt-6 rounded-3xl border border-border/50 bg-card/60 p-7">
            <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-foreground">
              <CalendarDays className="h-5 w-5 text-primary" /> Your watch year
            </h3>
            <p className="mb-5 text-sm text-muted-foreground">
              Busiest in <span className="font-medium text-foreground">{MONTH_NAMES[wrapped.busiestMonthIndex]}</span>.
            </p>
            <div className="flex items-end justify-between gap-1.5">
              {wrapped.months.map((count, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <motion.div
                    initial={{ height: 4 }}
                    whileInView={{ height: `${Math.max(6, (count / maxMonth) * 80)}px` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.03 }}
                    className={`w-full rounded-md ${i === wrapped.busiestMonthIndex ? "bg-gradient-to-t from-primary to-accent" : "bg-secondary"}`}
                  />
                  <span className="text-[10px] text-muted-foreground">{MONTH_NAMES[i][0]}</span>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Share card */}
          <Reveal className="mt-10">
            <div className="rounded-3xl border border-border/50 bg-gradient-to-br from-card/80 to-card/40 p-8 text-center backdrop-blur">
              <p className="font-jp text-xs tracking-[0.3em] text-primary/70">ひかり</p>
              <h3 className="mt-1 text-2xl font-black text-foreground">That&apos;s your {year}, wrapped.</h3>
              <p className="mt-2 text-muted-foreground">
                {t.hoursWatched}h watched · {t.completed} completed · top genre {wrapped.topGenres[0]?.name || "—"}
              </p>
              <Button onClick={handleShare} size="lg" className="mt-6 gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-8 text-white">
                <Share2 className="h-5 w-5" />
                Share my Wrapped
              </Button>
            </div>
          </Reveal>
        </>
      )}
    </main>
  )
}

function HighlightCard({ label, icon: Icon, entry, meta }) {
  const cover = entry?.media?.coverImage?.large || entry?.media?.coverImage?.extraLarge || "/placeholder.svg"
  return (
    <Link
      href={`/media/${entry.media_id}`}
      className="flex h-full items-center gap-4 rounded-3xl border border-border/50 bg-card/60 p-5 transition-colors hover:border-primary/40"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cover} alt={getMediaTitle(entry.media)} className="h-24 w-16 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </p>
        <p className="mt-1 line-clamp-2 font-semibold text-foreground">{getMediaTitle(entry.media)}</p>
        <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
      </div>
    </Link>
  )
}

export default function WrappedPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <Navigation />
        <WrappedContent />
      </div>
    </RequireAuth>
  )
}
