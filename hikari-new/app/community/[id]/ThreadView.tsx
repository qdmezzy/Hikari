"use client";

import { FormEvent, useState } from "react";

import { AppShell } from "../../components/AppShell";
import { anime } from "../../lib/data";

export function ThreadView({ id }: { id: string }) {
  const [draft, setDraft] = useState("");
  const [replies, setReplies] = useState([{ user: "Maya", text: "That pause before the answer was brutal in the best way.", time: "8m" }, { user: "Jun", text: "This is why I love a show that trusts silence.", time: "3m" }]);
  function reply(event: FormEvent) { event.preventDefault(); if (!draft.trim()) return; setReplies((current) => [...current, { user: "rays", text: draft.trim(), time: "now" }]); setDraft(""); }
  return <AppShell active="Community"><main className="thread-page"><a href="/community">← Community</a><article className="thread-root"><header><span className="avatar">M</span><div><strong>Mina</strong><small>@minalog · thread {id}</small></div></header><div className="thread-content"><img src={anime[1].cover} alt="" /><div><p>The quieter scenes did all the work this week. That final conversation felt more dangerous than the fight.</p><a href={`/anime/${anime[1].id}`}>Daemons of the Shadow Realm ↗</a></div></div><footer><span>♡ 184</span><span>{replies.length} replies</span><button>Share ↗</button></footer></article><section className="thread-replies">{replies.map((item, index) => <article key={`${item.user}-${index}`}><span className="avatar">{item.user[0]}</span><div><strong>{item.user} <small>· {item.time}</small></strong><p>{item.text}</p></div></article>)}</section><form className="thread-reply-form" onSubmit={reply}><span className="avatar">R</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add to the conversation" /><button disabled={!draft.trim()}>Reply</button></form></main></AppShell>;
}
