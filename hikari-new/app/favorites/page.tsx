"use client";

import { useMemo, useState } from "react";

import { AppShell, PageHeader } from "../components/AppShell";
import { anime } from "../lib/data";

export default function FavoritesPage() {
  const [saved, setSaved] = useState(() => anime.slice(0, 5));
  const [query, setQuery] = useState("");
  const shown = useMemo(() => saved.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())), [query, saved]);
  return <AppShell active=""><main className="inner-page"><PageHeader code="Saved clips" title="The trailers worth keeping." description="Rewatch the moments that sold you, then jump straight to the full title." action={<a className="signal-action" href="/">Find more clips</a>} /><div className="favorites-toolbar"><label>⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved clips" /></label><span>{shown.length} saved</span></div><section className="favorite-grid">{shown.map((item) => <article key={item.id}><a href={`/anime/${item.id}`}><img src={item.banner} alt="" /><span>▶</span></a><div><small>{item.kicker}</small><strong>{item.title}</strong><button onClick={() => setSaved((current) => current.filter((entry) => entry.id !== item.id))}>Remove</button></div></article>)}</section></main></AppShell>;
}
