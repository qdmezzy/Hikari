"use client"

import React from "react"
import { useState } from "react"
import {
  Play,
  CheckCircle2,
  Clock,
  TrendingUp,
  Plus,
  Minus,
  ChevronDown,
  ExternalLink,
  Settings,
  Sparkles,
  Zap,
  ArrowRight,
  Link2,
  Check,
  ChevronLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type View = "onboarding" | "dashboard" | "detected" | "settings" | "quicklinks"

const STREAMING_SITES = [
  { id: "crunchyroll", name: "Crunchyroll", color: "#F47521", icon: "CR" },
  { id: "funimation", name: "Funimation", color: "#5B0BB5", icon: "FN" },
  { id: "netflix", name: "Netflix", color: "#E50914", icon: "NF" },
  { id: "hulu", name: "Hulu", color: "#1CE783", icon: "HU" },
  { id: "hidive", name: "HIDIVE", color: "#00BAFF", icon: "HD" },
  { id: "amazon", name: "Prime Video", color: "#00A8E1", icon: "PV" },
]

const MANGA_SITES = [
  { id: "mangaplus", name: "Manga Plus", color: "#DC0016", icon: "M+" },
  { id: "mangadex", name: "MangaDex", color: "#FF6740", icon: "MD" },
  { id: "viz", name: "VIZ", color: "#F47521", icon: "VZ" },
  { id: "webtoon", name: "Webtoon", color: "#00D564", icon: "WT" },
]

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode
  value: string
  label: string
  color: string
}) {
  return (
    <div className="flex items-center gap-3 bg-[#1a1a1a] rounded-xl px-3 py-2.5">
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          color
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <span className="text-base font-semibold text-white block">{value}</span>
        <span className="text-[11px] text-[#737373]">{label}</span>
      </div>
    </div>
  )
}

function AnimeCard({
  title,
  episode,
  total,
  image,
  onIncrement,
}: {
  title: string
  episode: number
  total: number
  image: string
  onIncrement: () => void
}) {
  const progressPercent = (episode / total) * 100

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-3">
      <div className="flex gap-3">
        <div className="w-11 h-[60px] rounded-lg bg-[#262626] overflow-hidden flex-shrink-0">
          <img src={image || "/placeholder.svg"} alt={title} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-white truncate">{title}</h3>
          <p className="text-xs text-[#737373] mt-0.5">
            Ep {episode} of {total}
          </p>
          <div className="mt-2 h-1 bg-[#262626] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#f97316] rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <button
          onClick={onIncrement}
          className="w-8 h-8 rounded-lg bg-[#f97316] text-black flex items-center justify-center self-center hover:bg-[#ea580c] transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function SiteButton({
  site,
  selected,
  onToggle,
}: {
  site: { id: string; name: string; color: string; icon: string }
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl transition-all border",
        selected
          ? "bg-[#1a1a1a] border-[#f97316]"
          : "bg-[#141414] border-[#262626] hover:border-[#404040]"
      )}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold"
        style={{ backgroundColor: site.color }}
      >
        {site.icon}
      </div>
      <span className="flex-1 text-sm text-white text-left">{site.name}</span>
      <div
        className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
          selected ? "bg-[#f97316] border-[#f97316]" : "border-[#404040]"
        )}
      >
        {selected && <Check className="w-3 h-3 text-black" />}
      </div>
    </button>
  )
}

function OnboardingView({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1)
  const [selectedSites, setSelectedSites] = useState<string[]>(["crunchyroll"])

  const toggleSite = (id: string) => {
    setSelectedSites((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  if (step === 1) {
    return (
      <div className="flex flex-col h-full p-5">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Welcome to Hikari</h1>
          <p className="text-sm text-[#737373]">
            Track your anime progress automatically while you watch
          </p>
        </div>

        <div className="flex-1 space-y-4">
          <div className="bg-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#f97316]/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-[#f97316]" />
              </div>
              <span className="text-sm font-medium text-white">Auto-tracking</span>
            </div>
            <p className="text-xs text-[#737373]">
              We detect when you{"'"}re watching and update your progress
            </p>
          </div>

          <div className="bg-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Link2 className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-white">Quicklinks</span>
            </div>
            <p className="text-xs text-[#737373]">
              Jump to your favorite sites from any anime page on Hikari
            </p>
          </div>
        </div>

        <Button
          onClick={() => setStep(2)}
          className="w-full bg-[#f97316] hover:bg-[#ea580c] text-black font-medium"
        >
          Get Started
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#262626]">
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="w-4 h-4 text-[#f97316]" />
          <span className="text-sm font-medium text-white">Choose Quicklinks</span>
        </div>
        <p className="text-xs text-[#737373]">
          Select your favorite streaming and reading sites
        </p>
      </div>

      <div className="flex-1 overflow-auto scrollbar-hide p-4 space-y-4">
        <div>
          <span className="text-xs text-[#737373] uppercase tracking-wide mb-2 block">
            Streaming
          </span>
          <div className="space-y-2">
            {STREAMING_SITES.map((site) => (
              <SiteButton
                key={site.id}
                site={site}
                selected={selectedSites.includes(site.id)}
                onToggle={() => toggleSite(site.id)}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs text-[#737373] uppercase tracking-wide mb-2 block">
            Manga
          </span>
          <div className="space-y-2">
            {MANGA_SITES.map((site) => (
              <SiteButton
                key={site.id}
                site={site}
                selected={selectedSites.includes(site.id)}
                onToggle={() => toggleSite(site.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-[#262626]">
        <Button
          onClick={onComplete}
          disabled={selectedSites.length === 0}
          className="w-full bg-[#f97316] hover:bg-[#ea580c] text-black font-medium disabled:opacity-50"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <p className="text-[11px] text-[#737373] text-center mt-2">
          {selectedSites.length} site{selectedSites.length !== 1 ? "s" : ""} selected
        </p>
      </div>
    </div>
  )
}

function QuicklinksView({ onBack }: { onBack: () => void }) {
  const [selectedSites, setSelectedSites] = useState<string[]>(["crunchyroll", "mangaplus"])

  const toggleSite = (id: string) => {
    setSelectedSites((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#262626]">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[#737373] hover:text-white text-sm mb-2 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="w-4 h-4 text-[#f97316]" />
          <span className="text-sm font-medium text-white">Manage Quicklinks</span>
        </div>
        <p className="text-xs text-[#737373]">
          These appear on every anime page in Hikari
        </p>
      </div>

      <div className="flex-1 overflow-auto scrollbar-hide p-4 space-y-4">
        <div>
          <span className="text-xs text-[#737373] uppercase tracking-wide mb-2 block">
            Streaming
          </span>
          <div className="space-y-2">
            {STREAMING_SITES.map((site) => (
              <SiteButton
                key={site.id}
                site={site}
                selected={selectedSites.includes(site.id)}
                onToggle={() => toggleSite(site.id)}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs text-[#737373] uppercase tracking-wide mb-2 block">
            Manga
          </span>
          <div className="space-y-2">
            {MANGA_SITES.map((site) => (
              <SiteButton
                key={site.id}
                site={site}
                selected={selectedSites.includes(site.id)}
                onToggle={() => toggleSite(site.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-[#262626]">
        <Button
          onClick={onBack}
          className="w-full bg-[#f97316] hover:bg-[#ea580c] text-black font-medium"
        >
          Save Changes
        </Button>
      </div>
    </div>
  )
}

function DashboardView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [watchingList, setWatchingList] = useState([
    { id: 1, title: "JUJUTSU KAISEN S3", episode: 8, total: 24, image: "https://cdn.myanimelist.net/images/anime/1792/138022l.jpg" },
    { id: 2, title: "Frieren", episode: 22, total: 28, image: "https://cdn.myanimelist.net/images/anime/1015/138006l.jpg" },
  ])

  const incrementEpisode = (id: number) => {
    setWatchingList((prev) =>
      prev.map((anime) =>
        anime.id === id && anime.episode < anime.total
          ? { ...anime, episode: anime.episode + 1 }
          : anime
      )
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-2 gap-2 p-4">
        <StatCard
          icon={<Clock className="w-3.5 h-3.5 text-blue-400" />}
          value="142h"
          label="Watched"
          color="bg-blue-500/20"
        />
        <StatCard
          icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          value="61"
          label="Done"
          color="bg-emerald-500/20"
        />
        <StatCard
          icon={<Zap className="w-3.5 h-3.5 text-[#f97316]" />}
          value="5"
          label="Streak"
          color="bg-[#f97316]/20"
        />
        <StatCard
          icon={<TrendingUp className="w-3.5 h-3.5 text-pink-400" />}
          value="847"
          label="Eps"
          color="bg-pink-500/20"
        />
      </div>

      <div className="flex-1 overflow-auto scrollbar-hide px-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white flex items-center gap-2">
            <Play className="w-4 h-4 text-[#f97316]" />
            Watching
          </span>
          <button className="text-xs text-[#f97316] hover:underline">
            View all
          </button>
        </div>

        <div className="space-y-2">
          {watchingList.map((anime) => (
            <AnimeCard
              key={anime.id}
              title={anime.title}
              episode={anime.episode}
              total={anime.total}
              image={anime.image}
              onIncrement={() => incrementEpisode(anime.id)}
            />
          ))}
        </div>

        <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-[#f97316]/20 to-[#ea580c]/5 border border-[#f97316]/20">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Auto-tracking active</span>
          </div>
          <p className="text-xs text-[#737373]">Watching Crunchyroll - ready to sync</p>
        </div>
      </div>
    </div>
  )
}

function DetectedView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [episode, setEpisode] = useState(8)
  const [status, setStatus] = useState("Watching")
  const [isOpen, setIsOpen] = useState(false)
  const total = 24

  const statuses = ["Watching", "Completed", "Planned", "On Hold", "Dropped"]

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gradient-to-r from-[#f97316]/15 to-transparent px-4 py-2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#f97316] animate-pulse" />
        <span className="text-xs text-[#f97316]">Detected on Crunchyroll</span>
      </div>

      <div className="flex-1 overflow-auto scrollbar-hide p-4">
        <div className="bg-[#1a1a1a] rounded-xl overflow-hidden">
          <div className="relative h-20">
            <img
              src="https://cdn.myanimelist.net/images/anime/1792/138022l.jpg"
              alt=""
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] to-transparent" />
          </div>

          <div className="p-4 -mt-10 relative">
            <div className="flex gap-3">
              <div className="w-14 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 border-[#0a0a0a] shadow-lg">
                <img
                  src="https://cdn.myanimelist.net/images/anime/1792/138022l.jpg"
                  alt="JUJUTSU KAISEN"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="pt-8 flex-1 min-w-0">
                <h2 className="font-semibold text-white truncate">JUJUTSU KAISEN</h2>
                <p className="text-xs text-[#737373]">Season 3 - 24 episodes</p>
              </div>
            </div>

            <div className="mt-4 relative">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#262626] text-sm text-white"
              >
                {status}
                <ChevronDown className={cn("w-4 h-4 text-[#737373] transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#262626] rounded-lg overflow-hidden z-10 shadow-lg">
                  {statuses.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setStatus(s); setIsOpen(false) }}
                      className={cn(
                        "w-full px-3 py-2 text-sm text-left hover:bg-[#262626] transition-colors",
                        s === status ? "text-[#f97316] bg-[#f97316]/10" : "text-white"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-[#737373] mb-2">
                <span>Episode</span>
                <span>{episode}/{total}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEpisode(Math.max(0, episode - 1))}
                  className="w-9 h-9 rounded-lg bg-[#262626] hover:bg-[#333] flex items-center justify-center transition-colors"
                >
                  <Minus className="w-4 h-4 text-white" />
                </button>
                <div className="flex-1 h-2 bg-[#262626] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#f97316] rounded-full transition-all"
                    style={{ width: `${(episode / total) * 100}%` }}
                  />
                </div>
                <button
                  onClick={() => setEpisode(Math.min(total, episode + 1))}
                  className="w-9 h-9 rounded-lg bg-[#f97316] hover:bg-[#ea580c] flex items-center justify-center transition-colors"
                >
                  <Plus className="w-4 h-4 text-black" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" className="flex-1 bg-transparent border-[#262626] text-white hover:bg-[#1a1a1a]">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in Hikari
          </Button>
          <Button size="sm" className="flex-1 bg-[#f97316] hover:bg-[#ea580c] text-black">
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

function SettingsView({ onManageQuicklinks }: { onManageQuicklinks: () => void }) {
  const [autoTrack, setAutoTrack] = useState(true)
  const [notifications, setNotifications] = useState(true)
  const [spoilerShield, setSpoilerShield] = useState(true)

  return (
    <div className="flex flex-col h-full p-4">
      <span className="text-sm font-medium text-white mb-4">Settings</span>

      <div className="space-y-4">
        <Toggle label="Auto-track" desc="Update progress automatically" value={autoTrack} onChange={setAutoTrack} />
        <Toggle label="Notifications" desc="New episode alerts" value={notifications} onChange={setNotifications} />
        <Toggle label="Spoiler Shield" desc="Hide content past your progress" value={spoilerShield} onChange={setSpoilerShield} />
      </div>

      <button
        onClick={onManageQuicklinks}
        className="mt-6 flex items-center justify-between p-3 rounded-xl bg-[#1a1a1a] hover:bg-[#222] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#f97316]/20 flex items-center justify-center">
            <Link2 className="w-4 h-4 text-[#f97316]" />
          </div>
          <div className="text-left">
            <p className="text-sm text-white">Manage Quicklinks</p>
            <p className="text-xs text-[#737373]">2 sites enabled</p>
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-[#737373] -rotate-90" />
      </button>

      <div className="mt-auto pt-4 border-t border-[#262626]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center text-white font-semibold">
            R
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Ray</p>
            <p className="text-xs text-[#737373]">PRO Member</p>
          </div>
          <Sparkles className="w-4 h-4 text-[#f97316]" />
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-[#737373]">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn("w-10 h-6 rounded-full transition-colors relative", value ? "bg-[#f97316]" : "bg-[#262626]")}
      >
        <div className={cn("w-4 h-4 rounded-full bg-white absolute top-1 transition-transform", value ? "translate-x-5" : "translate-x-1")} />
      </button>
    </div>
  )
}

export function ExtensionPopup() {
  const [view, setView] = useState<View>("onboarding")
  const [hasOnboarded, setHasOnboarded] = useState(false)

  const handleCompleteOnboarding = () => {
    setHasOnboarded(true)
    setView("dashboard")
  }

  if (view === "onboarding" && !hasOnboarded) {
    return (
      <div className="w-[340px] h-[520px] bg-[#0a0a0a] rounded-2xl border border-[#262626] overflow-hidden flex flex-col shadow-2xl">
        <OnboardingView onComplete={handleCompleteOnboarding} />
      </div>
    )
  }

  if (view === "quicklinks") {
    return (
      <div className="w-[340px] h-[520px] bg-[#0a0a0a] rounded-2xl border border-[#262626] overflow-hidden flex flex-col shadow-2xl">
        <QuicklinksView onBack={() => setView("settings")} />
      </div>
    )
  }

  return (
    <div className="w-[340px] h-[520px] bg-[#0a0a0a] rounded-2xl border border-[#262626] overflow-hidden flex flex-col shadow-2xl">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#262626]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white">Hikari</span>
        </div>
        <nav className="flex gap-1">
          <NavBtn active={view === "dashboard"} onClick={() => setView("dashboard")}>
            <TrendingUp className="w-4 h-4" />
          </NavBtn>
          <NavBtn active={view === "detected"} onClick={() => setView("detected")}>
            <Play className="w-4 h-4" />
          </NavBtn>
          <NavBtn active={view === "settings"} onClick={() => setView("settings")}>
            <Settings className="w-4 h-4" />
          </NavBtn>
        </nav>
      </header>

      <main className="flex-1 overflow-hidden">
        {view === "dashboard" && <DashboardView onNavigate={setView} />}
        {view === "detected" && <DetectedView onNavigate={setView} />}
        {view === "settings" && <SettingsView onManageQuicklinks={() => setView("quicklinks")} />}
      </main>
    </div>
  )
}

function NavBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
        active ? "bg-[#f97316]/15 text-[#f97316]" : "text-[#737373] hover:text-white hover:bg-[#1a1a1a]"
      )}
    >
      {children}
    </button>
  )
}
