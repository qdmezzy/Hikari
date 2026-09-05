"use client";

import { useState } from "react";
import { AppShell } from "../../components/AppShell";
import { anime } from "../../lib/data";

const lists = [
  { slug: "starter-pack-for-maya", title: "Starter pack for Maya", note: "A little action, a little wonder, zero 500-episode commitments.", items: [0, 1, 5] },
  { slug: "perfect-first-episodes", title: "Perfect first episodes", note: "Shows that knew exactly what they were in minute one.", items: [3, 4, 1] },
  { slug: "rainy-day-rewatches", title: "Rainy-day rewatches", note: "Comfort shows for staying in.", items: [2, 3, 5] },
];

export function PublicProfile({ handle }: { handle: string }) {
  const [following, setFollowing] = useState(false);
  const [shared, setShared] = useState(false);
  async function share() { await navigator.clipboard?.writeText(window.location.href); setShared(true); window.setTimeout(() => setShared(false), 1500); }
  return (
    <AppShell active="">
      <main className="public-profile">
        <section className="public-hero">
          <img src={anime[0].banner} alt="" /><div className="public-hero-shade" />
          <div className="public-identity"><div className="public-avatar">R</div><div><span>@{handle}</span><h1>rays</h1><p>Finding stories that stay with me after the credits.</p></div></div>
          <div className="public-actions"><button className={following ? "following" : ""} onClick={() => setFollowing((value) => !value)}>{following ? "Following ✓" : "Follow"}</button><button onClick={share}>{shared ? "Link copied ✓" : "Share profile"}</button></div>
        </section>

        <section className="profile-stats" aria-label="Anime statistics">
          <div><strong>148</strong><span>Completed</span></div><div><strong>66.4</strong><span>Days watched</span></div><div><strong>17</strong><span>Day streak</span></div><div><strong>8.2</strong><span>Mean score</span></div><div><strong>2,418</strong><span>Episodes</span></div>
        </section>

        <section className="profile-showcase">
          <div className="profile-main-column">
            <div className="simple-section-heading"><div><span>Recently watched</span><h2>What rays has been into</h2></div><a href="/history">Full history</a></div>
            <div className="recent-watch-grid">{anime.slice(0, 5).map((item, index) => <a href={`/anime/${item.id}`} key={item.id}><img src={item.cover} alt="" /><div><strong>{item.title}</strong><span>{["Finished", "Episode 10", "Episode 2", "Episode 1146", "Finished"][index]}</span></div></a>)}</div>
            <div className="activity-list"><h2>Recent activity</h2><article><span>Today</span><p>Rated <a href={`/anime/${anime[5].id}`}>Jaadugar</a> an <b>8.5</b></p></article><article><span>Yesterday</span><p>Finished <a href={`/anime/${anime[4].id}`}>BLACK TORCH</a></p></article><article><span>3 days ago</span><p>Made a list for Maya</p></article></div>
          </div>
          <aside className="profile-list-column"><div className="simple-section-heading"><div><span>Shared collections</span><h2>Anime lists</h2></div></div>{lists.map((list) => <a className="public-list-card" href={`/lists/${list.slug}`} key={list.slug}><div className="list-cover-stack">{list.items.map((item) => <img key={anime[item].id} src={anime[item].cover} alt="" />)}</div><div><strong>{list.title}</strong><p>{list.note}</p><span>{list.items.length} anime · View list →</span></div></a>)}</aside>
        </section>
      </main>
    </AppShell>
  );
}
