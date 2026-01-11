"use client";

import { useState } from "react";
import { MediaCard } from "@/components/MediaCard";

type Media = {
  id: number;
  type: "ANIME" | "MANGA";
  title: { romaji: string; english: string | null; native: string | null };
  coverImage: { large: string };
  format: string | null;
  episodes: number | null;
  chapters: number | null;
  averageScore: number | null;
};

const QUERY = `
query ($search: String, $type: MediaType, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(search: $search, type: $type, sort: POPULARITY_DESC) {
      id
      type
      title { romaji english native }
      coverImage { large }
      format
      episodes
      chapters
      averageScore
    }
  }
}
`;

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"ANIME" | "MANGA">("ANIME");
  const [results, setResults] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/anilist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: QUERY,
          variables: { search: q, type, page: 1, perPage: 24 },
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.errors) {
        const msg =
          data?.errors?.[0]?.message || `Request failed (${res.status})`;
        throw new Error(msg);
      }

      setResults(data.data.Page.media);
    } catch (e: any) {
      setError(e?.message || "Something broke");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Search</h1>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="w-full sm:w-[420px] rounded-md border border-neutral-300 px-3 py-2"
          placeholder="Search anime or manga"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
          }}
        />

        <select
          className="rounded-md border border-neutral-300 px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value as "ANIME" | "MANGA")}
        >
          <option value="ANIME">Anime</option>
          <option value="MANGA">Manga</option>
        </select>

        <button
          className="rounded-md bg-black text-white px-4 py-2 disabled:opacity-60"
          onClick={runSearch}
          disabled={loading}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm">
          {error}
        </div>
      )}

      <div className="mt-4 text-sm text-neutral-500">
        Results: {results.length}
      </div>

      <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 items-start justify-items-center">
        {results.map((m) => (
          <MediaCard key={m.id} media={m} />
        ))}
      </div>

      {!loading && results.length === 0 && (
        <div className="mt-8 text-sm text-neutral-500">
          No results yet. Search something.
        </div>
      )}
    </main>
  );
}
