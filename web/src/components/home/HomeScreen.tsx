"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, ChevronRight } from "lucide-react"
import { Navigation } from "@/components/layout/Navigation"
import { FeaturedCinema } from "./FeaturedCinema"
import { RecommendedForYou } from "./RecommendedForYou"
import { Button } from "@/components/ui/button"
import { ScrollReveal } from "@/components/common/ScrollReveal"
import { getMediaHref } from "@/lib/anilist"
import type { AnimeItem, useHomeData } from "@/hooks/useHomeData"

export function HomePoster({ anime }: { anime: AnimeItem }) {
  return <Link className="hk-poster" href={getMediaHref(anime.id, anime.title)}>
    <div className="hk-poster-art"><Image src={anime.cover} alt="" fill sizes="(max-width: 640px) 135px, (max-width: 1180px) 22vw, 14vw" /></div>
    <div className="hk-poster-meta"><span>{anime.episodes ? `${anime.episodes} episodes` : anime.status || "Anime"}</span>{anime.rating ? <span>★ {anime.rating}</span> : null}</div>
    <h3>{anime.title}</h3>
  </Link>
}

function SectionTitle({ eyebrow, title, href, link }: { eyebrow: string; title: string; href: string; link: string }) {
  return <div className="hk-section-title"><h2><small lang="ja">{eyebrow}</small>{title}</h2><Link href={href}>{link}<ArrowUpRight size={15} /></Link></div>
}

function PosterLoading() {
  return <div className="hk-home-posters" role="status" aria-label="Loading anime">{Array.from({ length: 6 }, (_, i) => <div key={i} className="hk-poster-art animate-pulse" />)}</div>
}

export function HomeScreen({ data: d }: { data: ReturnType<typeof useHomeData> }) {
  const airing = [...d.seasonalAnime].sort((a, b) => (a.airingAt || 0) - (b.airingAt || 0)).slice(0, 4)
  return <div className="hikari-revamp hk-home min-h-screen bg-background">
    <Navigation />
    <main id="main-content">
      <FeaturedCinema items={d.featuredAnime} index={d.currentFeatured} onSelect={d.setCurrentFeatured} onAdd={d.handleAddFeatured} adding={d.addingFeatured} loading={d.homeLoading} error={d.homeError} onRetry={d.retry} paused={d.carouselPaused} running={d.carouselRunning} onPause={() => d.setCarouselPaused(value => !value)} onFocus={d.setCarouselFocused} />
      <div className="hk-home-body">
        <ScrollReveal><section className="hk-home-section" aria-labelledby="watching-heading">
          <div className="hk-section-title"><h2 id="watching-heading"><small lang="ja">視聴中</small>Continue watching</h2><Link href="/lists">My List <ArrowUpRight size={15} /></Link></div>
          {d.continueLoading ? <p role="status" className="text-sm text-muted-foreground">Loading your watch log…</p> : d.continueError ? <p role="alert" className="text-sm text-muted-foreground">{d.continueError} <Link href="/lists" className="underline">Open My List</Link></p> : d.continueWatching.length ? <div className="hk-watch-strip">
            {d.continueWatching.map(anime => <Link className="hk-watch-item" key={anime.id} href={getMediaHref(anime.id, anime.title)}>
              <Image src={anime.cover} width={56} height={80} alt="" />
              <div><h3>{anime.title}</h3><p>Episode {anime.currentEp}{anime.totalEp ? ` / ${anime.totalEp}` : ""}{anime.nextEpIn ? ` · Next ${anime.nextEpIn}` : ""}</p><div className="hk-watch-progress" role="progressbar" aria-label={`${anime.title} progress`} aria-valuenow={anime.currentEp} aria-valuemin={0} aria-valuemax={anime.totalEp || undefined}><span style={{ width: `${anime.progress || 0}%` }} /></div></div><ChevronRight size={15} className="shrink-0 text-muted-foreground" />
            </Link>)}
          </div> : <div className="hk-home-signin"><div><h3>{d.user ? "Start your watch log" : "Your watch log"}</h3><p>{d.user ? "Start tracking a title and your latest watch progress will appear here." : "Keep your episodes, favorites, and collections together."}</p></div><Button asChild variant="outline"><Link href={d.user ? "/search" : "/login?next=%2F"}>{d.user ? "Find something to watch" : "Sign in to your list"}<ArrowUpRight size={15} /></Link></Button></div>}
        </section></ScrollReveal>

        <ScrollReveal><section className="hk-home-section">
          <SectionTitle eyebrow="話題のアニメ" title="Trending anime" href="/search" link="Browse all" />
          {d.homeLoading ? <PosterLoading /> : d.trendingAnime.length ? <div className="hk-home-posters">{d.trendingAnime.map(anime => <HomePoster key={anime.id} anime={anime} />)}</div> : <p className="text-sm text-muted-foreground">Titles couldn't load. <button onClick={d.retry} className="underline">Try again</button></p>}
        </section></ScrollReveal>

        {d.user ? <RecommendedForYou /> : null}

        <ScrollReveal><div className="hk-home-lower">
          <section className="hk-home-section">
            <SectionTitle eyebrow="今期のアニメ" title="Airing this season" href="/search" link="Explore" />
            {d.homeLoading ? <PosterLoading /> : <div className="hk-home-posters">{d.seasonalAnime.slice(0, 4).map(anime => <HomePoster key={anime.id} anime={anime} />)}</div>}
            {!d.homeLoading && !d.seasonalAnime.length ? <p role={d.seasonalError ? "alert" : undefined} className="text-sm text-muted-foreground">{d.seasonalError || "No upcoming seasonal titles available."}{d.seasonalError ? <> <button onClick={d.retry} className="underline">Try again</button></> : null}</p> : null}
          </section>
          <aside className="hk-home-airing">
            <SectionTitle eyebrow="放送予定" title="Next episodes" href="/calendar" link="Schedule" />
            {airing.map(anime => <Link className="hk-airing-line" href={getMediaHref(anime.id, anime.title)} key={anime.id}><Image src={anime.cover} width={33} height={48} alt="" /><div><p>{anime.title}</p><small>{anime.isToday ? "Today" : anime.day} · {anime.time} · Ep {anime.nextEpisode}</small></div></Link>)}
            <p className="mt-4 text-[10px] text-muted-foreground">Times shown in your local timezone.</p>
          </aside>
        </div></ScrollReveal>

        <nav className="hk-home-social" aria-label="More from Hikari">
          <Link href="/community"><h3>Community <ArrowUpRight size={18} /></h3><p>Reviews, watch updates, and conversations with other fans.</p></Link>
          <Link href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "/discord-bot"}><h3>Join the Discord <ArrowUpRight size={18} /></h3><p>Talk about what you're watching with the Hikari community.</p></Link>
          <Link href="/discord-bot"><h3>Hikari for Discord <ArrowUpRight size={18} /></h3><p>Tracking and airing alerts, right inside your server.</p></Link>
        </nav>
        <footer className="hk-footer"><span>Hikari · Anime & manga</span><nav aria-label="Footer"><Link href="/founding">The Founding 25</Link><Link href="/feedback">Feedback</Link><Link href="/status">Status</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></nav></footer>
      </div>
    </main>
  </div>
}
