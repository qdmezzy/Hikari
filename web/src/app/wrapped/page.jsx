"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Film,
  Flame,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  Star,
  Trophy,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import RequireAuth from "@/components/common/RequireAuth"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { fetchAniListMediaByIds, getMediaTitle } from "@/lib/anilist"
import { computeWrapped, MONTH_NAMES } from "@/lib/wrapped"

const SLIDE_DURATION = 6000

// ---- data adapters -----------------------------------------------------

const coverOf = (entry) =>
  entry?.media?.coverImage?.large || entry?.media?.coverImage?.extraLarge || null

const trailerOf = (entry) => {
  const tr = entry?.media?.trailer
  return tr && tr.site === "youtube" ? tr.id : null
}

const formatScore = (score) =>
  Number(score) > 10 ? (Number(score) / 10).toFixed(1) : Number(score)

const formatWatchDate = (value) => {
  try {
    return new Date(value).toLocaleDateString(undefined, { month: "long", day: "numeric" })
  } catch {
    return ""
  }
}

const highlight = (entry, meta) =>
  entry?.media
    ? { title: getMediaTitle(entry.media), cover: coverOf(entry), trailerId: trailerOf(entry), meta }
    : null

// Map computeWrapped() output into the shape the story slides expect.
function buildView(w, prev, username) {
  const vsLastYear =
    prev && prev.totals.hoursWatched > 0
      ? Math.round(((w.totals.hoursWatched - prev.totals.hoursWatched) / prev.totals.hoursWatched) * 100)
      : null

  return {
    username,
    hasData: w.hasData,
    totals: w.totals,
    personality: w.personality,
    topGenres: w.topGenres,
    longestStreak: w.longestStreak,
    months: w.months,
    busiestMonthIndex: w.busiestMonthIndex,
    vsLastYear,
    topRated: highlight(w.topRated, `You scored it ${formatScore(w.topRated?.score)}/10`),
    mostBinged: highlight(
      w.mostBinged,
      `${w.mostBinged?.media_type === "MANGA" ? "Chapters" : "Episodes"}: ${w.mostBinged?.progress || 0}`,
    ),
    firstWatch: w.firstWatch?.media
      ? {
          title: getMediaTitle(w.firstWatch.media),
          cover: coverOf(w.firstWatch),
          trailerId: trailerOf(w.firstWatch),
          date: formatWatchDate(w.firstWatch.updated_at),
        }
      : null,
  }
}

// ---- small pieces ------------------------------------------------------

function CountUp({ value, duration = 1.4, decimals = 0, className = "" }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let raf
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - start) / (duration * 1000))
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(value * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()
  return <span className={className}>{formatted}</span>
}

// Muted, looping anime trailer behind a slide; cover image is a graceful fallback.
function TrailerBackdrop({ trailerId, cover, active }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <motion.img
          src={cover}
          alt=""
          aria-hidden="true"
          initial={{ scale: 1.05 }}
          animate={{ scale: 1.18 }}
          transition={{ duration: 18, ease: "linear" }}
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
      ) : null}
      {active && trailerId ? (
        <div className="absolute inset-0 scale-110 opacity-70 blur-md">
          <iframe
            title="Trailer"
            aria-hidden="true"
            tabIndex={-1}
            className="absolute left-1/2 top-1/2 h-[260%] w-[260%] -translate-x-1/2 -translate-y-1/2 md:h-[150%] md:w-[150%]"
            src={`https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerId}&playsinline=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0`}
            allow="autoplay; encrypted-media"
            frameBorder="0"
          />
        </div>
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/65 to-background/95" />
      <div className="absolute inset-0 bg-background/35" />
    </div>
  )
}

const slideMotion = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.02 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
}

const itemUp = { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } }

// ---- slides ------------------------------------------------------------

function IntroSlide({ data, year }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <motion.p {...itemUp} transition={{ delay: 0.1 }} className="font-jp text-base tracking-[0.4em] text-primary/80">
        まとめ
      </motion.p>
      <motion.h1 {...itemUp} transition={{ delay: 0.25 }} className="mt-4 text-6xl font-black leading-none tracking-tight md:text-8xl">
        <span className="text-gradient">{year}</span>
        <br />
        Wrapped
      </motion.h1>
      <motion.p {...itemUp} transition={{ delay: 0.45 }} className="mt-6 max-w-sm text-balance text-lg text-muted-foreground">
        Hey {data.username} — let&apos;s rewind your year in anime &amp; manga.
      </motion.p>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-10 text-sm text-muted-foreground/70">
        Tap to begin
      </motion.p>
    </div>
  )
}

function BigStatSlide({ icon: Icon, eyebrow, value, decimals, suffix, label, footnote }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <motion.div {...itemUp} transition={{ delay: 0.1 }} className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </motion.div>
      <motion.p {...itemUp} transition={{ delay: 0.2 }} className="text-sm uppercase tracking-[0.28em] text-muted-foreground">
        {eyebrow}
      </motion.p>
      <motion.div {...itemUp} transition={{ delay: 0.3 }} className="mt-3 text-7xl font-black tracking-tight text-gradient md:text-8xl">
        <CountUp value={value} decimals={decimals} />
        {suffix}
      </motion.div>
      <motion.p {...itemUp} transition={{ delay: 0.45 }} className="mt-4 max-w-xs text-balance text-xl font-semibold text-foreground">
        {label}
      </motion.p>
      {footnote ? (
        <motion.p {...itemUp} transition={{ delay: 0.6 }} className="mt-2 text-sm text-muted-foreground">
          {footnote}
        </motion.p>
      ) : null}
    </div>
  )
}

function PersonalitySlide({ data, year }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <motion.p {...itemUp} transition={{ delay: 0.1 }} className="text-sm uppercase tracking-[0.28em] text-muted-foreground">
        Your {year} watcher type
      </motion.p>
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 140, damping: 14 }}
        className="mt-5 rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/15 via-transparent to-accent/20 px-8 py-10"
      >
        <Sparkles className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-4 text-4xl font-black text-gradient md:text-5xl">{data.personality.title}</h2>
      </motion.div>
      <motion.p {...itemUp} transition={{ delay: 0.6 }} className="mt-6 max-w-sm text-balance text-lg text-muted-foreground">
        {data.personality.blurb}
      </motion.p>
    </div>
  )
}

function GenresSlide({ data }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <motion.h3 {...itemUp} transition={{ delay: 0.1 }} className="mb-8 text-center text-3xl font-black text-foreground">
        Your top genres
      </motion.h3>
      <div className="flex flex-col gap-4">
        {data.topGenres.map((genre, i) => {
          const pct = Math.round((genre.count / data.topGenres[0].count) * 100)
          return (
            <motion.div key={genre.name} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.12 }}>
              <div className="mb-1.5 flex items-end justify-between">
                <span className="text-lg font-bold text-foreground">
                  <span className="text-muted-foreground">{i + 1}.</span> {genre.name}
                </span>
                <span className="text-sm text-muted-foreground">{genre.count} titles</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.35 + i * 0.12, duration: 0.7, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                />
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function HighlightSlide({ eyebrow, icon: Icon, item }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <motion.p {...itemUp} transition={{ delay: 0.1 }} className="flex items-center gap-2 text-sm uppercase tracking-[0.28em] text-foreground/80">
        <Icon className="h-4 w-4 text-primary" /> {eyebrow}
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 40, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.25, type: "spring", stiffness: 120, damping: 14 }} className="mt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.cover || "/placeholder.svg"} alt={item.title} className="h-72 w-48 rounded-2xl object-cover shadow-2xl shadow-primary/20 ring-1 ring-border/60" />
      </motion.div>
      <motion.h3 {...itemUp} transition={{ delay: 0.5 }} className="mt-6 max-w-xs text-balance text-2xl font-black text-foreground">
        {item.title}
      </motion.h3>
      <motion.p {...itemUp} transition={{ delay: 0.62 }} className="mt-2 text-base text-primary">
        {item.meta}
      </motion.p>
    </div>
  )
}

function FirstWatchSlide({ data, year }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <motion.p {...itemUp} transition={{ delay: 0.1 }} className="text-sm uppercase tracking-[0.28em] text-foreground/80">
        Where it all started
      </motion.p>
      <motion.p {...itemUp} transition={{ delay: 0.2 }} className="mt-2 text-base text-foreground/70">
        On <span className="font-semibold text-gradient">{data.firstWatch.date}</span>, you pressed play on…
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 40, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.3, type: "spring", stiffness: 120, damping: 14 }} className="mt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.firstWatch.cover || "/placeholder.svg"} alt={data.firstWatch.title} className="h-64 w-44 rounded-2xl object-cover shadow-2xl shadow-primary/20 ring-1 ring-border/60" />
      </motion.div>
      <motion.h3 {...itemUp} transition={{ delay: 0.5 }} className="mt-6 max-w-xs text-balance text-2xl font-black text-foreground">
        {data.firstWatch.title}
      </motion.h3>
      <motion.p {...itemUp} transition={{ delay: 0.62 }} className="mt-2 text-base text-foreground/70">
        …and your {year} was never the same.
      </motion.p>
    </div>
  )
}

function MonthsSlide({ data }) {
  const maxMonth = Math.max(1, ...data.months)
  return (
    <div className="flex h-full flex-col justify-center">
      <motion.h3 {...itemUp} transition={{ delay: 0.1 }} className="text-center text-3xl font-black text-foreground">
        Your watch year
      </motion.h3>
      <motion.p {...itemUp} transition={{ delay: 0.2 }} className="mb-8 mt-2 text-center text-muted-foreground">
        You went hardest in <span className="font-semibold text-gradient">{MONTH_NAMES[data.busiestMonthIndex]}</span>.
      </motion.p>
      <div className="flex items-end justify-between gap-1.5">
        {data.months.map((count, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <motion.div
              initial={{ height: 4 }}
              animate={{ height: `${Math.max(8, (count / maxMonth) * 160)}px` }}
              transition={{ delay: 0.3 + i * 0.05, duration: 0.5, ease: "easeOut" }}
              className={`w-full rounded-lg ${i === data.busiestMonthIndex ? "bg-gradient-to-t from-primary to-accent" : "bg-secondary"}`}
            />
            <span className="text-[10px] text-muted-foreground">{MONTH_NAMES[i][0]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FinaleSlide({ data, year, onShare, onReplay }) {
  const t = data.totals
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <motion.p {...itemUp} transition={{ delay: 0.1 }} className="font-jp text-sm tracking-[0.34em] text-primary/80">
        ひかり
      </motion.p>
      <motion.h2 {...itemUp} transition={{ delay: 0.2 }} className="mt-2 text-4xl font-black text-foreground md:text-5xl">
        That&apos;s your <span className="text-gradient">{year}</span>.
      </motion.h2>

      <motion.div {...itemUp} transition={{ delay: 0.35 }} className="mt-7 grid w-full max-w-sm grid-cols-2 gap-3">
        {[
          { k: "Hours", v: `${t.hoursWatched}h` },
          { k: "Episodes", v: t.episodesWatched.toLocaleString() },
          { k: "Completed", v: t.completed },
          { k: "Top genre", v: data.topGenres[0]?.name || "—" },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm">
            <div className="text-2xl font-black text-foreground">{s.v}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.k}</div>
          </div>
        ))}
      </motion.div>

      {typeof data.vsLastYear === "number" ? (
        <motion.p {...itemUp} transition={{ delay: 0.5 }} className="mt-6 text-muted-foreground">
          {data.vsLastYear >= 0 ? "Up" : "Down"}{" "}
          <span className="font-semibold text-foreground">{Math.abs(data.vsLastYear)}%</span> in hours vs last year.
        </motion.p>
      ) : null}

      <motion.div {...itemUp} transition={{ delay: 0.62 }} className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onShare} size="lg" className="gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-8 text-white">
          <Share2 className="h-5 w-5" /> Share my Wrapped
        </Button>
        <Button onClick={onReplay} size="lg" variant="outline" className="gap-2 rounded-full px-6">
          <RotateCcw className="h-4 w-4" /> Replay
        </Button>
      </motion.div>
    </div>
  )
}

// ---- share card ----------------------------------------------------------

// Draws the story-format (1080x1920) share image: navy sky, sparkles, the
// watcher type and the year's headline stats. Returns a PNG blob.
async function renderShareCard(data, year) {
  try {
    const W = 1080
    const H = 1920
    const canvas = document.createElement("canvas")
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    const BANANA = "#f2d16b"
    const CREAM = "#f7f0d8"

    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, "#181f52")
    bg.addColorStop(0.55, "#0f1133")
    bg.addColorStop(1, "#0a0c26")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    let s = 1013 + Number(year)
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296
      return s / 4294967296
    }
    for (let i = 0; i < 110; i += 1) {
      const x = rnd() * W
      const y = rnd() * H
      const r = rnd() * 2.4 + 0.4
      ctx.fillStyle = `rgba(247,240,216,${(0.1 + rnd() * 0.28).toFixed(2)})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    const wrapLines = (text, font, maxWidth) => {
      ctx.font = font
      const words = String(text || "").split(/\s+/).filter(Boolean)
      const lines = []
      let line = ""
      words.forEach((word) => {
        const next = line ? `${line} ${word}` : word
        if (ctx.measureText(next).width > maxWidth && line) {
          lines.push(line)
          line = word
        } else {
          line = next
        }
      })
      if (line) lines.push(line)
      return lines
    }

    ctx.textAlign = "center"
    ctx.fillStyle = "rgba(242,209,107,0.8)"
    ctx.font = "600 42px Montserrat, sans-serif"
    ctx.fillText("ひ か り", W / 2, 200)

    ctx.fillStyle = BANANA
    ctx.font = "800 56px Montserrat, sans-serif"
    ctx.fillText("H I K A R I   W R A P P E D", W / 2, 292)

    ctx.fillStyle = CREAM
    ctx.font = "900 240px Montserrat, sans-serif"
    ctx.fillText(String(year), W / 2, 560)

    ctx.fillStyle = "rgba(247,240,216,0.6)"
    ctx.font = "600 34px Montserrat, sans-serif"
    ctx.fillText("W A T C H E R   T Y P E", W / 2, 705)

    const titleFont = "800 76px Montserrat, sans-serif"
    const titleLines = wrapLines(data.personality?.title || "Anime Fan", titleFont, 900)
    ctx.fillStyle = BANANA
    ctx.font = titleFont
    titleLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, W / 2, 810 + i * 88)
    })

    const t = data.totals
    const stats = [
      [`${t.hoursWatched}h`, "WATCHED"],
      [`${t.episodesWatched.toLocaleString()}`, "EPISODES"],
      [`${t.completed}`, "COMPLETED"],
      [data.topGenres?.[0]?.name || "—", "TOP GENRE"],
    ]
    const boxW = 470
    const boxH = 290
    const gap = 40
    const x0 = (W - boxW * 2 - gap) / 2
    const y0 = 1050
    stats.forEach(([value, label], i) => {
      const bx = x0 + (i % 2) * (boxW + gap)
      const by = y0 + Math.floor(i / 2) * (boxH + gap)
      ctx.fillStyle = "rgba(255,255,255,0.055)"
      ctx.strokeStyle = "rgba(242,209,107,0.3)"
      ctx.lineWidth = 2
      ctx.beginPath()
      if (typeof ctx.roundRect === "function") ctx.roundRect(bx, by, boxW, boxH, 36)
      else ctx.rect(bx, by, boxW, boxH)
      ctx.fill()
      ctx.stroke()

      const isLong = String(value).length > 8
      ctx.fillStyle = CREAM
      ctx.font = `900 ${isLong ? 58 : 92}px Montserrat, sans-serif`
      ctx.fillText(String(value), bx + boxW / 2, by + (isLong ? 165 : 178))
      ctx.fillStyle = "rgba(247,240,216,0.55)"
      ctx.font = "600 30px Montserrat, sans-serif"
      ctx.fillText(label, bx + boxW / 2, by + 242)
    })

    ctx.fillStyle = "rgba(247,240,216,0.6)"
    ctx.font = "500 36px Montserrat, sans-serif"
    ctx.fillText("hikari.raycodes.net/wrapped", W / 2, H - 120)

    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"))
  } catch {
    return null
  }
}

// ---- story player ------------------------------------------------------

function WrappedStory({ data, year, years, onYearChange, onClose }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const t = data.totals

  // Restart whenever the active year/data changes.
  useEffect(() => {
    setIndex(0)
  }, [year])

  const handleShare = useCallback(async () => {
    const text = `My ${year} Hikari Wrapped 🌸 — ${t.completed} titles, ${t.episodesWatched} episodes, ${t.hoursWatched}h watched. I'm "${data.personality.title}". Make yours:`
    const url = typeof window !== "undefined" ? `${window.location.origin}/wrapped` : "/wrapped"

    // Preferred path: share the rendered story card as an image. Fall back to
    // downloading it (with the caption copied), then to plain text sharing.
    const blob = await renderShareCard(data, year)
    if (blob) {
      const file = new File([blob], `hikari-wrapped-${year}.png`, { type: "image/png" })
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: "Hikari Wrapped", text, url, files: [file] })
          return
        }
      } catch {
        return // user cancelled the share sheet
      }
      try {
        const href = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = href
        a.download = `hikari-wrapped-${year}.png`
        a.click()
        URL.revokeObjectURL(href)
        await navigator.clipboard.writeText(`${text} ${url}`).catch(() => {})
        toast.success("Card saved & caption copied — post it anywhere!")
        return
      } catch {
        /* fall through to text */
      }
    }

    try {
      if (navigator.share) {
        await navigator.share({ title: "Hikari Wrapped", text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      toast.success("Copied your Wrapped to share!")
    } catch {
      /* cancelled */
    }
  }, [year, t, data])

  const bd = (item) => (item ? { id: item.trailerId, cover: item.cover } : null)

  const slides = useMemo(() => {
    const list = []
    list.push({
      key: "intro",
      grad: "from-primary/25 via-background to-background",
      trailer: bd(data.mostBinged || data.topRated || data.firstWatch),
      render: () => <IntroSlide data={data} year={year} />,
    })
    if (data.firstWatch) {
      list.push({
        key: "first",
        grad: "from-primary/15 via-background to-background",
        trailer: bd(data.firstWatch),
        render: () => <FirstWatchSlide data={data} year={year} />,
      })
    }
    list.push({
      key: "hours",
      grad: "from-primary/20 via-background to-background",
      render: () => (
        <BigStatSlide
          icon={CalendarDays}
          eyebrow={`${data.username}, you spent`}
          value={t.hoursWatched}
          suffix="h"
          label="watching anime this year"
          footnote={
            typeof data.vsLastYear === "number"
              ? `That's about ${t.daysWatched} full days — ${data.vsLastYear >= 0 ? "up" : "down"} ${Math.abs(data.vsLastYear)}% from last year.`
              : `That's about ${t.daysWatched} full days.`
          }
        />
      ),
    })
    list.push({
      key: "episodes",
      grad: "from-accent/20 via-background to-background",
      render: () => <BigStatSlide icon={Film} eyebrow="You watched" value={t.episodesWatched} label="episodes, start to finish" />,
    })
    if (data.longestStreak >= 2) {
      list.push({
        key: "streak",
        grad: "from-chart-3/25 via-background to-background",
        render: () => (
          <BigStatSlide icon={Flame} eyebrow="Your longest streak" value={data.longestStreak} suffix=" days" label="in a row tracking anime" footnote="Discipline of a true protagonist." />
        ),
      })
    }
    list.push({
      key: "completed",
      grad: "from-accent/15 via-background to-background",
      render: () => (
        <BigStatSlide icon={Trophy} eyebrow="You completed" value={t.completed} label="titles" footnote={t.chaptersRead ? `and read ${t.chaptersRead.toLocaleString()} manga chapters.` : undefined} />
      ),
    })
    list.push({ key: "personality", grad: "from-primary/20 via-background to-accent/10", render: () => <PersonalitySlide data={data} year={year} /> })
    if (data.topGenres.length) {
      list.push({ key: "genres", grad: "from-accent/15 via-background to-background", render: () => <GenresSlide data={data} /> })
    }
    if (data.topRated) {
      list.push({ key: "rated", grad: "from-accent/15 via-background to-background", trailer: bd(data.topRated), render: () => <HighlightSlide eyebrow="Highest rated" icon={Star} item={data.topRated} /> })
    }
    if (data.mostBinged) {
      list.push({ key: "binged", grad: "from-chart-3/20 via-background to-background", trailer: bd(data.mostBinged), render: () => <HighlightSlide eyebrow="Most binged" icon={Flame} item={data.mostBinged} /> })
    }
    list.push({ key: "months", grad: "from-primary/15 via-background to-background", render: () => <MonthsSlide data={data} /> })
    list.push({
      key: "finale",
      grad: "from-primary/25 via-background to-accent/15",
      trailer: bd(data.topRated || data.mostBinged),
      render: () => <FinaleSlide data={data} year={year} onShare={handleShare} onReplay={() => setIndex(0)} />,
    })
    return list
  }, [data, year, t, handleShare])

  const total = slides.length
  const safeIndex = Math.min(index, total - 1)
  const isLast = safeIndex === total - 1

  const goNext = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total])
  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    if (paused || isLast) return
    const timer = setTimeout(() => setIndex((i) => Math.min(total - 1, i + 1)), SLIDE_DURATION)
    return () => clearTimeout(timer)
  }, [safeIndex, paused, isLast, total])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") goNext()
      else if (e.key === "ArrowLeft") goPrev()
      else if (e.key === "Escape") onClose?.()
      else if (e.key === " ") {
        e.preventDefault()
        setPaused((p) => !p)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goNext, goPrev, onClose])

  const touchX = useRef(null)
  const onTouchStart = (e) => {
    touchX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e) => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 50) (dx < 0 ? goNext : goPrev)()
    touchX.current = null
  }

  const current = slides[safeIndex]

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <div className="absolute inset-x-0 top-0 z-30 flex gap-1.5 px-3 pt-3 md:px-6 md:pt-5">
        {slides.map((s, i) => (
          <div key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/15">
            <motion.div
              className="h-full rounded-full bg-foreground"
              initial={false}
              animate={{ width: i < safeIndex ? "100%" : i === safeIndex ? "100%" : "0%" }}
              transition={i === safeIndex && !paused && !isLast ? { duration: SLIDE_DURATION / 1000, ease: "linear" } : { duration: 0.2 }}
              style={i === safeIndex && (paused || isLast) ? { width: "100%" } : undefined}
            />
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-7 md:px-7 md:pt-9">
        <div className="flex items-center gap-2">
          <span className="font-jp text-sm tracking-[0.3em] text-primary/80">ひかり</span>
          <span className="text-sm font-semibold text-muted-foreground">Wrapped</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-border/60 bg-card/70 p-0.5 backdrop-blur">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => onYearChange(y)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${year === y ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {y}
              </button>
            ))}
          </div>
          <button onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play" : "Pause"} className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-card/70 text-foreground backdrop-blur transition-colors hover:bg-card">
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button onClick={() => onClose?.()} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-card/70 text-foreground backdrop-blur transition-colors hover:bg-card">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button aria-label="Previous" onClick={goPrev} className="absolute left-0 top-0 z-20 h-full w-1/3 cursor-default focus:outline-none" />
        <button aria-label="Next" onClick={goNext} className="absolute right-0 top-0 z-20 h-full w-2/3 cursor-default focus:outline-none" />

        <AnimatePresence mode="wait">
          <motion.div key={`${year}-${current.key}`} {...slideMotion} className={`absolute inset-0 bg-gradient-to-b ${current.grad}`}>
            {current.trailer && (current.trailer.id || current.trailer.cover) ? (
              <TrailerBackdrop trailerId={current.trailer.id} cover={current.trailer.cover} active={!paused} />
            ) : (
              <>
                <div className="pointer-events-none absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
                <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
              </>
            )}
            <div className="relative mx-auto flex h-full w-full max-w-md flex-col px-6 py-20 md:py-24">{current.render()}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      <button onClick={goPrev} aria-label="Previous slide" disabled={safeIndex === 0} className="absolute left-3 top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-card/70 text-foreground backdrop-blur transition hover:bg-card disabled:opacity-0 md:flex">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button onClick={goNext} aria-label="Next slide" disabled={isLast} className="absolute right-3 top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-card/70 text-foreground backdrop-blur transition hover:bg-card disabled:opacity-0 md:flex">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}

// ---- loader / empty / page --------------------------------------------

function EmptyState({ year, years, onYearChange, onClose }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background px-6 text-center">
      <button onClick={onClose} aria-label="Close" className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/70 text-foreground">
        <X className="h-4 w-4" />
      </button>
      <p className="font-jp text-sm tracking-[0.34em] text-primary/70">まとめ</p>
      <Sparkles className="mt-4 h-10 w-10 text-primary/60" />
      <h1 className="mt-4 text-2xl font-bold text-foreground">No {year} Wrapped yet</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Track some anime or manga and your {year} recap fills in automatically.
      </p>
      <div className="mt-5 flex rounded-full border border-border/60 bg-card/70 p-0.5">
        {years.map((y) => (
          <button key={y} onClick={() => onYearChange(y)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${year === y ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {y}
          </button>
        ))}
      </div>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href="/search">Browse titles</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/lists">My list</Link>
        </Button>
      </div>
    </div>
  )
}

function WrappedLoader() {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(currentYear)

  const years = useMemo(() => [currentYear, currentYear - 1], [currentYear])

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

  const username = user?.user_metadata?.display_name || user?.user_metadata?.username || "fan"

  const view = useMemo(() => {
    const w = computeWrapped(entries, year)
    const prev = computeWrapped(entries, year - 1)
    return buildView(w, prev, username)
  }, [entries, year, username])

  const close = () => {
    if (typeof window !== "undefined") window.location.assign("/profile")
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!view.hasData) {
    return <EmptyState year={year} years={years} onYearChange={setYear} onClose={close} />
  }

  return <WrappedStory data={view} year={year} years={years} onYearChange={setYear} onClose={close} />
}

// Wrapped is currently moderator-only — everyone else is redirected away.
export default function WrappedPage() {
  const { user, loading } = useAuth()
  const isMod = user?.app_metadata?.is_mod === true || user?.app_metadata?.isMod === true
  const previewEnabled = process.env.NEXT_PUBLIC_ENABLE_WRAPPED === "true"

  useEffect(() => {
    if (!loading && (!previewEnabled || !isMod) && typeof window !== "undefined") {
      window.location.replace("/profile")
    }
  }, [loading, isMod, previewEnabled])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }
  if (!previewEnabled || !isMod) return null

  return (
    <RequireAuth>
      <WrappedLoader />
    </RequireAuth>
  )
}
