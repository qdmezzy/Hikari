"use client";

import { useState } from "react";
import { AppShell } from "../../components/AppShell";
import { anime } from "../../lib/data";

const listCopy: Record<string, { title: string; note: string; owner: string; ids: number[] }> = {
  "rainy-night-anime": { title: "Rainy night anime", note: "Slow, strange, and a little magical. Best watched with the lights low.", owner: "rays · made for Maya", ids: [190569, 195600, 185874, 182205] },
  "starter-shonen": { title: "Shonen starter pack", note: "The shows I’d hand someone who wants to understand why the genre hits.", owner: "rays · shared with 12 people", ids: [185874, 187538, 21, 182205] },
  "rays-all-timers": { title: "My all-timers", note: "The stories I keep coming back to—and won’t stop recommending.", owner: "rays · public list", ids: [21, 185874, 182205, 190569] },
};

function titleFromSlug(slug: string) {
  return slug.split("-").filter(Boolean).map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`).join(" ") || "Untitled list";
}

export function SharedList({ slug }: { slug: string }) {
  const data = listCopy[slug] ?? { title: titleFromSlug(slug), note: "A hand-picked anime list shared through Hikari.", owner: "rays · fresh list", ids: [185874, 182205, 190569] };
  const entries = data.ids.map((id) => anime.find((item) => item.id === id)).filter((item): item is (typeof anime)[number] => Boolean(item));
  const [saved, setSaved] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);

  async function copyList() {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return <AppShell active="Library">
    <main className="shared-list-page">
      <header className="shared-list-hero">
        <div><span className="eyebrow">A list from the community</span><h1>{data.title}</h1><p>{data.note}</p><div className="shared-by"><span className="avatar">R</span><div><strong>{data.owner}</strong><span>{entries.length} picks · updated today</span></div></div></div>
        <div className="shared-list-actions"><button className="signal-action" onClick={() => setSaved(entries.map((item) => item.id))}>+ Save every title</button><button className="quiet-action" onClick={copyList}>{copied ? "Link copied!" : "Share list ↗"}</button></div>
      </header>
      <section className="shared-picks" aria-label="Anime in this list">
        {entries.map((entry, index) => <article key={entry.id}><span className="pick-number">{String(index + 1).padStart(2, "0")}</span><a href={`/anime/${entry.id}`}><img src={entry.cover} alt="" /></a><div><span>{entry.kicker}</span><a href={`/anime/${entry.id}`}><h2>{entry.title}</h2></a><p>{entry.summary}</p><small>{entry.year} · {entry.genres.join(" · ")} · ★ {entry.score / 10}</small></div><button className={saved.includes(entry.id) ? "saved" : ""} onClick={() => setSaved((current) => current.includes(entry.id) ? current.filter((id) => id !== entry.id) : [...current, entry.id])}>{saved.includes(entry.id) ? "Saved ✓" : "+ My list"}</button></article>)}
      </section>
    </main>
  </AppShell>;
}
