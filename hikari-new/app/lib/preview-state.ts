"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { anime } from "./data";

export type LibraryEntry = { id: number; status: string; progress: number; total: number | null; score: number | null };
export type Collection = { slug: string; name: string; note: string; ids: number[]; visibility: "Private" | "Public"; color: string };
export const librarySeed: LibraryEntry[] = anime.map((item, i) => ({ id: item.id, status: ["Watching", "Planning", "Watching", "Watching", "Completed", "Planning"][i], progress: [7, 0, 2, 1146, 12, 0][i], total: [10, 24, null, null, 12, null][i], score: [9, null, 8, 10, 7, null][i] }));
export const collectionSeed: Collection[] = [
  { slug: "rainy-night-anime", name: "Rainy night anime", note: "For when the rain is louder than your thoughts.", ids: [190569, 195600, 182205], visibility: "Private", color: "violet" },
  { slug: "starter-shonen", name: "Start here, stay forever", note: "A few reasons I fell in love with anime.", ids: [185874, 21, 187538, 182205], visibility: "Public", color: "orange" },
  { slug: "rays-all-timers", name: "The all-timers", note: "The ones I keep coming back to.", ids: [21, 185874, 190569], visibility: "Public", color: "green" },
];
export const profileSeed = { name: "rays", handle: "rays", bio: "One more episode. Then I’m definitely going to sleep.", banner: anime[3].banner };
export const preferencesSeed = { theme: "Dark", autoplay: false, spoilers: true, adult: false, compact: false, releases: true, replies: true, activity: true, privateProfile: false, quietHours: "23:00–08:00" };
export const previewKeys = { library: "hikari.redesign.library.v1", collections: "hikari.redesign.collections.v1", profile: "hikari.redesign.profile.v1", preferences: "hikari.redesign.preferences.v1", reminders: "hikari.redesign.reminders.v1" };

export function usePreviewState<T>(key: string, initial: T) {
  const [error, setError] = useState("");
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener("hikari-preview-change", callback);
    window.addEventListener("storage", callback);
    return () => { window.removeEventListener("hikari-preview-change", callback); window.removeEventListener("storage", callback); };
  }, []);
  const snapshot = useCallback(() => { try { return window.localStorage.getItem(key); } catch { return null; } }, [key]);
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const value = useMemo<T>(() => { try { return raw === null ? initial : JSON.parse(raw) as T; } catch { return initial; } }, [raw, initial]);
  const update = useCallback((next: T | ((current: T) => T)) => {
    try {
      let current = initial;
      const stored = window.localStorage.getItem(key);
      if (stored) current = JSON.parse(stored) as T;
      const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      window.localStorage.setItem(key, JSON.stringify(resolved));
      window.dispatchEvent(new Event("hikari-preview-change"));
      setError("");
      return true;
    } catch { setError("Your browser couldn’t save this change. Check that local storage is available and try again."); return false; }
  }, [key, initial]);
  return { value, update, error };
}

export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
