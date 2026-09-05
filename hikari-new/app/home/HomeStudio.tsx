"use client";

import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { Icon } from "../components/Studio";
import { anime } from "../lib/data";
import { collectionSeed, librarySeed, previewKeys, profileSeed, usePreviewState } from "../lib/preview-state";

export default function HomeStudio() {
  const library = usePreviewState(previewKeys.library, librarySeed);
  const profile = usePreviewState(previewKeys.profile, profileSeed);
  const collections = usePreviewState(previewKeys.collections, collectionSeed);
  const [message, setMessage] = useState("");
  const watching = library.value.filter((entry) => entry.status === "Watching" || entry.status === "Rewatching").slice(0, 3);
  function logEpisode(id: number) { if (library.update((items) => items.map((entry) => entry.id === id ? { ...entry, progress: entry.progress + 1, status: entry.total && entry.progress + 1 >= entry.total ? "Completed" : "Watching" } : entry))) setMessage("Episode logged in My list."); }
  return <AppShell active="Home"><main className="studio-page home-studio">
    <header className="home-welcome"><h1>Welcome back, <span>{profile.value.name}.</span></h1><a href="/library">Your list <Icon name="arrow" size={18} /></a></header>
    <section className="home-feature-layout"><article className="home-feature"><img src={anime[0].banner} alt="" /><div className="home-feature-shade" /><div className="home-feature-copy"><p>ON OUR RADAR <span>•</span> BLEACH</p><h2>The final<br />stand.</h2><p className="home-feature-summary">Thousand-Year Blood War returns for its final chapter.</p><a className="studio-button primary" href={`/anime/${anime[0].id}`}>Explore the series <Icon name="arrow" size={17} /></a></div><span className="home-feature-credit">THOUSAND-YEAR BLOOD WAR — THE CALAMITY</span></article>
    <aside className="home-side-feature"><a href={`/anime/${anime[5].id}`} className="home-side-art"><img src={anime[5].cover} alt="Jaadugar: A Witch in Mongolia" /></a><div><span className="studio-eyebrow">THE ONE TO MAKE TIME FOR</span><h2>A different<br />kind of magic.</h2><p>Jaadugar: A Witch in Mongolia</p><a href={`/anime/${anime[5].id}`}>Take a closer look <Icon name="arrow" size={17} /></a></div></aside></section>
    <section className="home-continue"><div className="section-title-line"><h2>Pick up where you left off</h2><a href="/library">All watching <Icon name="arrow" size={17} /></a></div><div className="continue-grid">{watching.map((entry) => { const item = anime.find((a) => a.id === entry.id)!; return <article className="continue-card" key={entry.id}><a href={`/anime/${entry.id}`}><img src={item.cover} alt="" /></a><div><span className="studio-eyebrow">WATCHING</span><h3><a href={`/anime/${entry.id}`}>{item.title}</a></h3><p>Episode {entry.progress} <span>/ {entry.total ?? "ongoing"}</span></p><button onClick={() => logEpisode(entry.id)}><Icon name="plus" size={16} /> Log episode {entry.progress + 1}</button></div></article>; })}{watching.length === 0 && <div className="empty-state"><h3>Your next story starts here.</h3><a className="studio-button" href="/browse">Find anime to watch</a></div>}</div><p className="inline-status" role="status">{library.error || message}</p></section>
    <section className="home-lower"><div><div className="section-title-line"><h2>Around the community</h2><a href="/community">Join in <Icon name="arrow" size={17} /></a></div><a className="home-discussion" href="/community/2"><span className="person-avatar mauve">K</span><div><small>Kenji on Jaadugar</small><h3>“The art direction is absurdly confident.”</h3><span>14 replies · A conversation worth joining</span></div><Icon name="arrow" /></a><a className="home-discussion" href="/community/3"><span className="person-avatar blue">A</span><div><small>Aya on BLEACH</small><h3>Back to Soul Society, one more time.</h3><span>43 replies · Rewatch discussion</span></div><Icon name="arrow" /></a></div><div><div className="section-title-line"><h2>From your shelf</h2><a href="/library">Collections <Icon name="arrow" size={17} /></a></div>{collections.value.slice(0, 2).map((collection) => <a className="home-collection" href={`/lists/${collection.slug}`} key={collection.slug}><div>{collection.ids.slice(0, 3).map((id) => <img src={anime.find((a) => a.id === id)?.cover} alt="" key={id} />)}</div><span><strong>{collection.name}</strong><small>{collection.ids.length} titles · {collection.visibility.toLowerCase()} draft</small></span><Icon name="arrow" /></a>)}</div></section>
  </main></AppShell>;
}
