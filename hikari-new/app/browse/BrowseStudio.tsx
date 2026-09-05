"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { Heading, Icon } from "../components/Studio";
import { anime } from "../lib/data";
import { librarySeed, previewKeys, usePreviewState } from "../lib/preview-state";

const genres = [...new Set(anime.flatMap((item) => item.genres))].sort();

export default function BrowseStudio() {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All genres");
  const [year, setYear] = useState("All years");
  const [sort, setSort] = useState("Highest rated");
  const [hideSaved, setHideSaved] = useState(false);
  const library = usePreviewState(previewKeys.library, librarySeed);
  useEffect(() => { setQuery(new URLSearchParams(window.location.search).get("q") ?? ""); }, []);
  const results = useMemo(() => anime.filter((item) => `${item.title} ${item.genres.join(" ")}`.toLowerCase().includes(query.toLowerCase()) && (genre === "All genres" || item.genres.includes(genre)) && (year === "All years" || String(item.year) === year) && (!hideSaved || !library.value.some((entry) => entry.id === item.id))).sort((a, b) => sort === "Highest rated" ? b.score - a.score : sort === "Title A–Z" ? a.title.localeCompare(b.title) : b.year - a.year), [query, genre, year, sort, hideSaved, library.value]);
  function reset() { setQuery(""); setGenre("All genres"); setYear("All years"); setHideSaved(false); }
  function add(id: number) { library.update((items) => items.some((item) => item.id === id) ? items : [...items, { id, progress: 0, total: null, score: null, status: "Planning" }]); }
  return <AppShell active="Browse"><main className="studio-page"><Heading title="Browse anime" text="Find your next obsession."><a className="studio-button ghost" href="/">Discover trailers <Icon name="arrow" size={17} /></a></Heading>
    <label className="browse-search studio-search"><Icon name="search" size={22} /><input autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search anime or a genre…" aria-label="Search anime" />{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery("")}><Icon name="close" size={18} /></button>}</label>
    <div className="browse-workspace"><aside className="browse-sidebar"><header><h2>Filters</h2><button onClick={reset}>Reset</button></header><label>Genre<select value={genre} onChange={(e) => setGenre(e.target.value)}><option>All genres</option>{genres.map((item) => <option key={item}>{item}</option>)}</select></label><label>Year<select value={year} onChange={(e) => setYear(e.target.value)}><option>All years</option>{[...new Set(anime.map((item) => item.year))].sort((a, b) => b - a).map((item) => <option key={item}>{item}</option>)}</select></label><label className="studio-checkbox"><input type="checkbox" checked={hideSaved} onChange={(e) => setHideSaved(e.target.checked)} /><span>Hide titles in my list</span></label><div className="browse-genres"><span>EXPLORE A GENRE</span>{["Action", "Fantasy", "Mystery", "Drama"].map((item, index) => <button key={item} className={`genre-choice genre-${index} ${genre === item ? "selected" : ""}`} onClick={() => setGenre(item)}>{item}<Icon name="arrow" size={15} /></button>)}</div></aside>
    <section className="browse-results"><div className="browse-results-heading"><h2>{query ? `Results for “${query}”` : genre === "All genres" ? "Something worth watching" : `${genre} anime`}<span>{results.length} titles</span></h2><select aria-label="Sort anime" value={sort} onChange={(e) => setSort(e.target.value)}><option>Highest rated</option><option>Newest first</option><option>Title A–Z</option></select></div><div className="catalog-grid">{results.map((item) => { const saved = library.value.some((entry) => entry.id === item.id); return <article className="catalog-card" key={item.id}><a className="catalog-cover" href={`/anime/${item.id}`}><img src={item.cover} alt={item.title} /><span className="catalog-rating">★ {item.score / 10}</span></a><div className="catalog-title"><h3><a href={`/anime/${item.id}`}>{item.title}</a></h3><button className={`icon-button ${saved ? "is-saved" : ""}`} disabled={saved} aria-label={saved ? `${item.title} is in My list` : `Add ${item.title} to My list`} onClick={() => add(item.id)}><Icon name={saved ? "check" : "plus"} size={19} /></button></div><p>{item.year} <span>·</span> {item.genres.slice(0, 2).join(" / ")}</p></article>; })}</div>{results.length === 0 && <div className="empty-state"><Icon name="search" size={32} /><h3>No anime found</h3><p>Try a different title or loosen a filter.</p><button className="studio-button" onClick={reset}>Reset filters</button></div>}<p className="catalog-sample-note">A six-title catalog for exploring the redesign.</p>{library.error && <p className="studio-error" role="alert">{library.error}</p>}</section></div>
  </main></AppShell>;
}
