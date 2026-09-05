"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "./components/AppShell";
import { anime } from "./lib/data";

const infiniteFeed = [...anime, ...anime, ...anime];

export default function DiscoverPage() {
  const [active, setActive] = useState(anime.length);
  const [muted, setMuted] = useState(true);
  const [saved, setSaved] = useState<Set<number>>(() => new Set([21]));
  const [shared, setShared] = useState<number | null>(null);
  const slides = useRef<Array<HTMLElement | null>>([]);
  const feed = useRef<HTMLElement | null>(null);
  const wheelLocked = useRef(false);
  const settleTimer = useRef<number | null>(null);

  const recenter = useCallback((index: number) => {
    const node = feed.current;
    if (!node) return;
    let middleIndex = index;
    if (index < anime.length) middleIndex = index + anime.length;
    if (index >= anime.length * 2) middleIndex = index - anime.length;
    if (middleIndex !== index) {
      node.scrollTo({ top: middleIndex * node.clientHeight, behavior: "auto" });
      setActive(middleIndex);
    }
  }, []);

  const move = useCallback((direction: number) => {
    if (wheelLocked.current) return;
    const height = feed.current?.clientHeight || 1;
    const current = Math.round((feed.current?.scrollTop || 0) / height);
    const target = Math.max(0, Math.min(infiniteFeed.length - 1, current + direction));
    wheelLocked.current = true;
    feed.current?.scrollTo({ top: target * height, behavior: "smooth" });
    window.setTimeout(() => {
      recenter(target);
      wheelLocked.current = false;
    }, 720);
  }, [recenter]);

  useEffect(() => {
    const node = feed.current;
    if (!node) return;
    const placeInMiddle = () => node.scrollTo({ top: anime.length * node.clientHeight, behavior: "auto" });
    placeInMiddle();
    window.addEventListener("resize", placeInMiddle);
    return () => window.removeEventListener("resize", placeInMiddle);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(Number((visible.target as HTMLElement).dataset.index));
      },
      { threshold: [0.55, 0.75] },
    );
    slides.current.forEach((slide) => { if (slide) observer.observe(slide); });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = feed.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= 18) return;
      event.preventDefault();
      move(event.deltaY > 0 ? 1 : -1);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "PageDown") { event.preventDefault(); move(1); }
      if (event.key === "ArrowUp" || event.key === "PageUp") { event.preventDefault(); move(-1); }
    };
    const onScroll = () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => {
        recenter(Math.round(node.scrollTop / Math.max(node.clientHeight, 1)));
      }, 180);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKeyDown);
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    };
  }, [move, recenter]);

  function toggleSaved(id: number) {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function share(id: number) {
    await navigator.clipboard?.writeText(`${window.location.origin}/anime/${id}`);
    setShared(id);
    window.setTimeout(() => setShared(null), 1500);
  }

  return (
    <AppShell active="Discover" showFooter={false}>
      <main className="discover-feed" aria-label="Discover anime" ref={feed}>
        {infiniteFeed.map((item, feedIndex) => {
          const isActive = active === feedIndex;
          return (
            <section
              className={isActive ? "discover-slide active" : "discover-slide"}
              data-index={feedIndex}
              key={`${item.id}-${feedIndex}`}
              ref={(element) => { slides.current[feedIndex] = element; }}
            >
              <img className="discover-slide-art" src={item.banner} alt="" />
              {isActive && item.trailerId && (
                <iframe
                  className="discover-trailer"
                  key={`${item.id}-${muted}`}
                  src={`https://www.youtube.com/embed/${item.trailerId}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${item.trailerId}&modestbranding=1&rel=0&playsinline=1`}
                  title={`${item.title} trailer`}
                  allow="autoplay; encrypted-media; picture-in-picture"
                />
              )}
              <div className="discover-slide-shade" />

              <div className="slide-copy">
                <span className="hero-label">{item.kicker}</span>
                <h1>{item.title}</h1>
                <div className="hero-meta"><b>{item.score / 10}</b><span>{item.year}</span><span>{item.episodes} episodes</span><span>{item.genres.join(" · ")}</span></div>
                <p>{item.summary}</p>
                <div className="hero-actions">
                  <a className="primary-button" href={`/anime/${item.id}`}>View anime</a>
                  <button className={saved.has(item.id) ? "secondary-button saved" : "secondary-button"} onClick={() => toggleSaved(item.id)}>{saved.has(item.id) ? "In your list ✓" : "+ Add to list"}</button>
                </div>
              </div>

              <aside className="slide-actions" aria-label={`${item.title} actions`}>
                <button onClick={() => toggleSaved(item.id)}><span>{saved.has(item.id) ? "Saved" : "Save"}</span><b>{saved.has(item.id) ? "✓" : "+"}</b></button>
                <button onClick={() => share(item.id)}><span>{shared === item.id ? "Copied" : "Share"}</span><b>↗︎</b></button>
                {item.trailerId && <button onClick={() => setMuted((value) => !value)}><span>{muted ? "Sound" : "Mute"}</span><b>{muted ? "OFF" : "ON"}</b></button>}
              </aside>

              <div className="scroll-cue">Keep scrolling — there is always another anime <span>↓</span></div>
            </section>
          );
        })}
      </main>
    </AppShell>
  );
}
