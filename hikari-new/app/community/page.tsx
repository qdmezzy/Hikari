"use client";

import { FormEvent, useMemo, useState } from "react";

import { AppShell, PageHeader } from "../components/AppShell";
import { anime } from "../lib/data";

type Post = { id: number; user: string; handle: string; text: string; title?: string; cover?: string; likes: number; replies: number; time: string };
const seed: Post[] = [
  { id: 1, user: "Mina", handle: "@minalog", text: "The quieter scenes did all the work this week. That final conversation felt more dangerous than the fight.", title: "Daemons of the Shadow Realm", cover: anime[1].cover, likes: 184, replies: 27, time: "12m" },
  { id: 2, user: "Kenji", handle: "@nighttrain", text: "Jaadugar is the show I wish more people were talking about. The art direction is absurdly confident.", title: "Jaadugar: A Witch in Mongolia", cover: anime[5].cover, likes: 96, replies: 14, time: "38m" },
  { id: 3, user: "Aya", handle: "@hollowstar", text: "Rewatching the Soul Society arc before the final cour. It still moves like nothing else from that era.", title: "BLEACH", cover: anime[0].cover, likes: 241, replies: 43, time: "1h" },
];

export default function CommunityPage() {
  const [posts, setPosts] = useState(seed);
  const [draft, setDraft] = useState("");
  const [sort, setSort] = useState<"live" | "popular">("live");
  const visible = useMemo(() => sort === "popular" ? [...posts].sort((a, b) => b.likes - a.likes) : posts, [posts, sort]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setPosts((current) => [{ id: Date.now(), user: "rays", handle: "@rays", text: draft.trim(), likes: 0, replies: 0, time: "now" }, ...current]);
    setDraft("");
  }
  function like(id: number) { setPosts((current) => current.map((post) => post.id === id ? { ...post, likes: post.likes + 1 } : post)); }

  return (
    <AppShell active="Community">
      <main className="inner-page">
        <PageHeader code="Community" title="Talk about what you watch." description="Live reactions, long thoughts, and people who care about the same stories." />
        <div className="community-layout">
          <div className="feed-column">
            <form className="composer" onSubmit={submit}>
              <div className="avatar">R</div>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What are you watching?" aria-label="Create a community post" />
              <div className="composer-bottom"><span>{draft.length}/320</span><button disabled={!draft.trim()}>Transmit</button></div>
            </form>
            <div className="feed-tabs"><div><button className={sort === "live" ? "active" : ""} onClick={() => setSort("live")}>Live feed</button><button className={sort === "popular" ? "active" : ""} onClick={() => setSort("popular")}>Popular</button></div><span>{visible.length} active transmissions</span></div>
            <div className="post-list">
              {visible.map((post) => (
                <article className="post" key={post.id}>
                  <div className="post-author"><div className="avatar small">{post.user[0]}</div><div><strong>{post.user}</strong><span>{post.handle} · {post.time}</span></div><button aria-label="More options">•••</button></div>
                  <div className="post-body">{post.cover && <img src={post.cover} alt="" />}<div><p>{post.text}</p>{post.title && <a href="/browse">Discussing / {post.title} ↗</a>}</div></div>
                  <div className="post-actions"><button onClick={() => like(post.id)}>♡ {post.likes}</button><a href={`/community/${post.id}`}>Reply {post.replies}</a><button>Share ↗</button></div>
                </article>
              ))}
            </div>
          </div>
          <aside className="community-side">
            <section><p>Room tone</p><h2>Trending now</h2>{["#BLEACHFinalCour", "#Jaadugar", "#Spring2026", "#OnePiece"].map((tag, i) => <a href={`/community?topic=${encodeURIComponent(tag.slice(1))}`} key={tag}><span>0{i + 1}</span><div><strong>{tag}</strong><small>{["2.8k", "914", "632", "8.1k"][i]} posts</small></div></a>)}</section>
            <section className="club-callout"><p>Weekly watch club</p><h3>Perfect Blue</h3><span>Saturday · 9 PM EST</span><a href="/hub/after-midnight">Join the room</a></section>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
