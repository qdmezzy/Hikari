"use client";

import { useState } from "react";
import { AppShell, PageHeader } from "../components/AppShell";
import { days, schedule } from "../lib/data";

export default function SchedulePage() {
  const [day, setDay] = useState(0);
  const [view, setView] = useState<"week" | "day">("week");
  const [reminders, setReminders] = useState<Set<string>>(() => new Set());
  const airings = view === "week" ? schedule : schedule.filter((item) => item.day === day);
  function toggle(key: string) { setReminders((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }
  function syncCalendar() {
    const events = schedule.map((item) => `BEGIN:VEVENT\nSUMMARY:${item.title} ${item.episode}\nDESCRIPTION:Hikari release reminder\nEND:VEVENT`).join("\n");
    const blob = new Blob([`BEGIN:VCALENDAR\nVERSION:2.0\n${events}\nEND:VCALENDAR`], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hikari-schedule.ics";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <AppShell active="Schedule">
      <main className="inner-page">
        <PageHeader code="Upcoming" title="Seven days. No clutter." description="Release times are converted to your timezone: EDT (UTC−4)." action={<button className="signal-action" onClick={syncCalendar}>Sync calendar</button>} />
        <div className="week-switcher">
          {days.map((label, index) => <button key={label} onClick={() => { setDay(index); setView("day"); }} className={view === "day" && day === index ? "active" : ""}><span>{label.split(" ")[0]}</span><strong>{label.split(" ")[1]}</strong><i>{schedule.filter((item) => item.day === index).length || "—"}</i></button>)}
        </div>
        <div className="schedule-view-toggle"><button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>All episodes this week <span>{schedule.length}</span></button><button className={view === "day" ? "active" : ""} onClick={() => setView("day")}>Selected day</button></div>
        <section className="day-sheet">
          <header><div><p>{view === "week" ? "All available airings" : `${days[day].split(" ")[0]} / August ${days[day].split(" ")[1]}`}</p><h2>{view === "week" ? "Every episode airing this week" : airings.length ? `${airings.length} release${airings.length > 1 ? "s" : ""} on your radar` : "A quiet day"}</h2></div><span>LOCAL TIME</span></header>
          {airings.length ? airings.map((item) => (
            <article className="airing-row" key={`${item.day}-${item.title}-${item.language}`}>
              <time>{item.time}<small>{view === "week" ? days[item.day].split(" ")[0] : "EDT"}</small></time><img src={item.cover} alt="" /><div><strong>{item.title}</strong><span>{item.episode} · {item.language}</span></div><button className={reminders.has(`${item.day}-${item.title}-${item.language}`) ? "reminded" : ""} onClick={() => toggle(`${item.day}-${item.title}-${item.language}`)}>{reminders.has(`${item.day}-${item.title}-${item.language}`) ? "Reminder set ✓" : "Remind me ＋"}</button>
            </article>
          )) : <div className="empty-day"><strong>No scheduled releases.</strong><span>Good night to catch up—or touch grass.</span><a href="/discover">Browse the archive ↗</a></div>}
        </section>
      </main>
    </AppShell>
  );
}
