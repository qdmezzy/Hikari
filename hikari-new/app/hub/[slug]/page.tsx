"use client";

import { useState } from "react";
import { AppShell } from "../../components/AppShell";
import { anime } from "../../lib/data";

export default function HubPage() {
  const [joined, setJoined] = useState(false);
  return <AppShell active="Community"><main className="hub-page"><section className="hub-hero"><img src={anime[4].banner} alt="" /><div><span className="eyebrow">Hikari watch club</span><h1>After Midnight Club</h1><p>Strange shows, patient movies, and the kind of endings you need to talk through.</p><div><span>842 members</span><span>Saturday · 9 PM EST</span></div><button className={joined ? "joined" : ""} onClick={() => setJoined((value) => !value)}>{joined ? "Joined ✓" : "Join the club"}</button></div></section><section className="hub-content"><div><span className="eyebrow">This week</span><h2>Perfect Blue</h2><p>Watch anytime before Saturday. The room opens fifteen minutes before discussion.</p><button className="signal-action">Set reminder</button></div><div><span className="eyebrow">Club shelf</span>{anime.slice(0,3).map((item) => <a href={`/anime/${item.id}`} key={item.id}><img src={item.cover} alt="" /><strong>{item.title}</strong></a>)}</div></section></main></AppShell>;
}
