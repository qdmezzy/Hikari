"use client"

import { useCallback, useEffect, useState } from "react"
import { Navigation } from "@/components/layout/Navigation"
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Circle,
  CircleDot,
  Database,
  Globe,
  Loader2,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react"

type ServiceStatus = "operational" | "down" | "unknown"

type Service = {
  id: string
  label: string
  status: ServiceStatus
  ms?: number | null
  lastSeen?: string | null
}

type Incident = {
  id: string | number
  created_at: string
  severity?: string | null
  title: string
  body?: string | null
  resolved?: boolean | null
  resolved_at?: string | null
}

type StatusPayload = {
  updatedAt: string
  overall: "operational" | "degraded"
  services: Service[]
  catalogCount: number | null
  incidents: Incident[]
}

const SERVICE_ICONS: Record<string, typeof Globe> = {
  web: Globe,
  bot: Bot,
  database: Database,
  anilist: Server,
  mangadex: Server,
}

// Roadmap toward Hikari's own public API. `min` = catalog size at which a
// milestone is considered reached (purely for the visual progress bar).
const ROADMAP = [
  { key: "cache", title: "Cache-first media API", desc: "Every title viewed is absorbed into our own catalog.", state: "done" },
  { key: "catalog", title: "Canonical multi-source catalog", desc: "Merge AniList, MyAnimeList & MangaDex into one schema.", state: "in_progress" },
  { key: "public", title: "Public read API", desc: "API keys, rate limits, docs & versioning.", state: "planned" },
  { key: "open", title: "Open to developers", desc: "Anyone can build on the Hikari catalog.", state: "planned" },
] as const

const statusTone = (status: ServiceStatus) => {
  if (status === "operational") return { dot: "bg-emerald-400", text: "text-emerald-400", label: "Operational" }
  if (status === "down") return { dot: "bg-red-400", text: "text-red-400", label: "Down" }
  return { dot: "bg-muted-foreground/50", text: "text-muted-foreground", label: "Unknown" }
}

const timeAgo = (iso?: string | null) => {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export default function StatusPage() {
  const [data, setData] = useState<StatusPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" })
      if (!res.ok) throw new Error("bad status")
      setData((await res.json()) as StatusPayload)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 30_000)
    return () => clearInterval(timer)
  }, [load])

  const overallOk = data?.overall === "operational"

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-24 md:px-6 lg:pt-28">
        <header className="animate-rise">
          <p className="font-jp text-sm font-medium tracking-[0.3em] text-primary/70">状態</p>
          <h1 className="mt-1 text-balance text-3xl font-bold tracking-tight md:text-4xl">System Status</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Live health of Hikari&apos;s services and progress toward our own open API.
          </p>
        </header>

        <div
          className={`mt-8 flex items-center justify-between gap-4 rounded-2xl border p-5 ${
            error
              ? "border-amber-500/30 bg-amber-500/10"
              : overallOk
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-amber-500/30 bg-amber-500/10"
          }`}
        >
          <div className="flex items-center gap-3">
            {loading ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : error ? (
              <AlertTriangle className="size-6 text-amber-400" />
            ) : overallOk ? (
              <CheckCircle2 className="size-6 text-emerald-400" />
            ) : (
              <AlertTriangle className="size-6 text-amber-400" />
            )}
            <div>
              <p className="font-semibold">
                {loading
                  ? "Checking systems…"
                  : error
                    ? "Couldn't reach the status service"
                    : overallOk
                      ? "All systems operational"
                      : "Some systems are degraded"}
              </p>
              {data?.updatedAt ? (
                <p className="text-xs text-muted-foreground">Updated {timeAgo(data.updatedAt)}</p>
              ) : null}
            </div>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <RefreshCw className="size-3.5" /> Refresh
          </button>
        </div>

        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Activity className="size-5 text-primary" /> Services
          </h2>
          <div className="mt-3 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card/40">
            {(data?.services || []).map((svc) => {
              const tone = statusTone(svc.status)
              const Icon = SERVICE_ICONS[svc.id] || Server
              return (
                <div key={svc.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{svc.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {typeof svc.ms === "number" && svc.status === "operational" ? (
                      <span className="text-xs text-muted-foreground">{svc.ms}ms</span>
                    ) : svc.id === "bot" && svc.lastSeen ? (
                      <span className="text-xs text-muted-foreground">{timeAgo(svc.lastSeen)}</span>
                    ) : null}
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${tone.text}`}>
                      <span className={`size-2 rounded-full ${tone.dot}`} />
                      {tone.label}
                    </span>
                  </div>
                </div>
              )
            })}
            {!data && !error
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-[52px] animate-pulse bg-muted/20" />
                ))
              : null}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-lg font-semibold">Our own API</h2>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-primary">
                {data?.catalogCount != null ? data.catalogCount.toLocaleString() : "—"}
              </p>
              <p className="text-xs text-muted-foreground">titles in catalog</p>
            </div>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Hikari is building its own anime &amp; manga catalog. Once it&apos;s big enough, developers will be able to
            build on it.
          </p>

          <ol className="mt-5 space-y-3">
            {ROADMAP.map((step) => {
              const done = step.state === "done"
              const active = step.state === "in_progress"
              return (
                <li key={step.key} className="flex gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
                  <div className="mt-0.5">
                    {done ? (
                      <CheckCircle2 className="size-5 text-emerald-400" />
                    ) : active ? (
                      <CircleDot className="size-5 text-primary" />
                    ) : (
                      <Circle className="size-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{step.title}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          done
                            ? "bg-emerald-500/15 text-emerald-400"
                            : active
                              ? "bg-primary/15 text-primary"
                              : "bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        {done ? "Done" : active ? "In progress" : "Planned"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Recent incidents</h2>
          {data?.incidents?.length ? (
            <div className="mt-3 space-y-3">
              {data.incidents.map((inc) => (
                <div key={inc.id} className="rounded-xl border border-border/60 bg-card/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 font-medium">
                      {inc.resolved ? (
                        <CheckCircle2 className="size-4 text-emerald-400" />
                      ) : (
                        <XCircle className="size-4 text-red-400" />
                      )}
                      {inc.title}
                    </p>
                    <span className="text-xs text-muted-foreground">{timeAgo(inc.created_at)}</span>
                  </div>
                  {inc.body ? <p className="mt-2 text-sm text-muted-foreground">{inc.body}</p> : null}
                  {inc.resolved ? (
                    <p className="mt-2 text-xs font-medium text-emerald-400">
                      Resolved{inc.resolved_at ? ` · ${timeAgo(inc.resolved_at)}` : ""}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-400" />
              No incidents reported. All clear.
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
