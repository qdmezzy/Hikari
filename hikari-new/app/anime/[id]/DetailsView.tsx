"use client";

import { useState } from "react";

import { AppShell } from "../../components/AppShell";
import type { Anime } from "../../lib/data";

export function DetailsView({ entry }: { entry: Anime }) {
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState("Overview");
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<number>>(() => new Set());

  function toggleEpisode(episode: number) {
    setWatchedEpisodes((current) => {
      const next = new Set(current);
      if (next.has(episode)) next.delete(episode);
      else next.add(episode);
      return next;
    });
  }
  return (
    <AppShell active="Discover">
      <main className="detail-page">
        <section className="detail-hero">
          <img className="detail-backdrop" src={entry.banner} alt="" /><div className="detail-shade" />
          <a className="back-link" href="/browse">← Back to index</a>
          <div className="detail-core"><img className="detail-cover" src={entry.cover} alt={`${entry.title} cover`} /><div className="detail-copy"><p>Featured on Hikari</p><h1>{entry.title}</h1><div className="feature-meta"><strong>{entry.score / 10}</strong><span>{entry.year}</span><span>{entry.episodes} EP</span><span>{entry.genres.join(" / ")}</span></div><p className="summary">{entry.summary}</p><div className="feature-actions">{entry.trailerId && <button className="watch-button" onClick={() => setTrailerOpen(true)}>Play official trailer <span>▶</span></button>}<button className={saved ? "save-button saved" : "save-button"} onClick={() => setSaved(!saved)}>{saved ? "In your library ✓" : "Add to library ＋"}</button></div></div></div>
        </section>
        <section className="detail-record">
          <nav>{["Overview", "Episodes", "Community", "Staff"].map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
          {tab === "Overview" && <div className="record-grid"><article><p>FIELD NOTES</p><h2>Why it’s on the signal</h2><p>{entry.summary} Hikari members are responding most to its atmosphere, character work, and visual direction.</p></article><dl><div><dt>Format</dt><dd>TV Series</dd></div><div><dt>Status</dt><dd>{entry.year > 2025 ? "Upcoming" : "Releasing"}</dd></div><div><dt>Source</dt><dd>Manga</dd></div><div><dt>Season</dt><dd>2026</dd></div></dl></div>}
          {tab === "Episodes" && <div className="episode-list">{[1, 2, 3, 4].map((ep) => <button className={watchedEpisodes.has(ep) ? "watched" : ""} onClick={() => toggleEpisode(ep)} key={ep}><span>EP {String(ep).padStart(2, "0")}</span><strong>{["A new signal", "Beyond the gate", "Terms of the promise", "The long night"][ep - 1]}</strong><i>{watchedEpisodes.has(ep) ? "Logged as watched" : "Mark watched"}</i><b>{watchedEpisodes.has(ep) ? "✓" : "＋"}</b></button>)}</div>}
          {tab === "Community" && <div className="tab-placeholder"><strong>684 people are discussing this title.</strong><a href="/community">Enter the conversation ↗</a></div>}
          {tab === "Staff" && <div className="tab-placeholder"><strong>Staff and studio credits</strong><span>Full production records will appear here.</span></div>}
        </section>
        {trailerOpen && entry.trailerId && <div className="trailer-modal" role="dialog" aria-modal="true" aria-label={`${entry.title} trailer`}><button className="trailer-close" onClick={() => setTrailerOpen(false)}>Close ×</button><div><iframe src={`https://www.youtube.com/embed/${entry.trailerId}?autoplay=1&rel=0&modestbranding=1`} title={`${entry.title} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div></div>}
      </main>
    </AppShell>
  );
}
