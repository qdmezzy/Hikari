import { AppShell, PageHeader } from "../components/AppShell";
import { anime } from "../lib/data";

export default function HistoryPage() {
  const events = [
    { id: 21, episode: 1146, when: "Today · 8:42 PM" },
    { id: 185874, episode: 6, when: "Today · 6:10 PM" },
    { id: 190569, episode: 4, when: "Yesterday" },
    { id: 182205, episode: 2, when: "Saturday" },
    { id: 187538, episode: 7, when: "Friday" },
    { id: 195600, episode: 9, when: "Thursday" },
  ];
  return <AppShell active=""><main className="inner-page"><PageHeader code="Watch history" title="The trail behind you." description="Every episode update, together and easy to undo." /><section className="history-list">{events.map((event) => { const entry = anime.find((item) => item.id === event.id) ?? anime[0]; return <article key={`${event.id}-${event.episode}`}><img src={entry.cover} alt="" /><div><span>{event.when}</span><a href={`/anime/${entry.id}`}><strong>{entry.title}</strong></a><p>Logged episode {event.episode} as watched</p></div><a href={`/anime/${entry.id}`}>View title →</a></article>; })}</section></main></AppShell>;
}
