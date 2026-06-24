const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

async function anilistPost(query: string, variables: Record<string, unknown>) {
  const response = await api.request.xhr('POST', {
    url: ANILIST_ENDPOINT,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    data: JSON.stringify({ query, variables }),
  });

  let json: any = {};
  try {
    json = JSON.parse(response.responseText || '{}');
  } catch {
    throw new Error('AniList returned an invalid response');
  }

  if (response.status < 200 || response.status >= 300 || json?.errors) {
    throw new Error(json?.errors?.[0]?.message || 'AniList request failed');
  }

  return json;
}

const SEARCH_QUERY = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
      id
      type
      title { romaji english }
      coverImage { large }
      nextAiringEpisode { episode }
      episodes
      chapters
      format
    }
  }
}
`;

export async function searchAniList(search: string) {
  const json = await anilistPost(SEARCH_QUERY, { search, page: 1, perPage: 5 });
  return json?.data?.Page?.media ?? [];
}

const MEDIA_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    type
    title { romaji english }
    coverImage { large }
    nextAiringEpisode { episode }
    episodes
    chapters
    format
  }
}
`;

const MEDIA_CACHE_KEY = 'hikariMediaCache';
const MEDIA_CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
const MEDIA_CACHE_CAP = 600;

type MediaCacheEntry = { data: any; ts: number };

async function readMediaCache(): Promise<Record<string, MediaCacheEntry>> {
  try {
    const r = await chrome.storage.local.get(MEDIA_CACHE_KEY);
    return (r[MEDIA_CACHE_KEY] as Record<string, MediaCacheEntry>) || {};
  } catch {
    return {};
  }
}

async function writeMediaCache(cache: Record<string, MediaCacheEntry>) {
  try {
    let toStore = cache;
    const entries = Object.entries(cache);
    if (entries.length > MEDIA_CACHE_CAP) {
      toStore = Object.fromEntries(entries.sort((a, b) => b[1].ts - a[1].ts).slice(0, MEDIA_CACHE_CAP));
    }
    await chrome.storage.local.set({ [MEDIA_CACHE_KEY]: toStore });
  } catch {
  }
}

export async function fetchMediaById(id: number) {
  const cache = await readMediaCache();
  const hit = cache[String(id)];
  if (hit && Date.now() - hit.ts < MEDIA_CACHE_TTL) return hit.data;

  const json = await anilistPost(MEDIA_QUERY, { id });
  const media = json?.data?.Media ?? null;
  if (media) {
    cache[String(id)] = { data: media, ts: Date.now() };
    await writeMediaCache(cache);
  }
  return media;
}

const MEDIA_BATCH_QUERY = `
query ($ids: [Int], $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(id_in: $ids) {
      id
      type
      title { romaji english }
      coverImage { large }
      nextAiringEpisode { episode }
      episodes
      chapters
      format
    }
  }
}
`;

export async function prefetchMedia(ids: number[]) {
  const unique = Array.from(new Set(ids.map(Number).filter(Number.isFinite)));
  if (!unique.length) return;

  const cache = await readMediaCache();
  const now = Date.now();
  const missing = unique.filter(id => {
    const hit = cache[String(id)];
    return !(hit && now - hit.ts < MEDIA_CACHE_TTL);
  });
  if (!missing.length) return;

  for (const batch of chunk(missing, 50)) {
    const json = await anilistPost(MEDIA_BATCH_QUERY, { ids: batch, perPage: batch.length });
    const media = (json?.data?.Page?.media ?? []) as any[];
    media.forEach(m => {
      if (m?.id) cache[String(m.id)] = { data: m, ts: Date.now() };
    });
  }
  await writeMediaCache(cache);
}

export type AiringMedia = {
  id: number;
  title: { romaji?: string; english?: string };
  coverImage: { large?: string };
  episodes: number | null;
  nextAiringEpisode: { episode: number; airingAt: number; timeUntilAiring: number } | null;
};

const AIRING_QUERY = `
query ($ids: [Int], $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(id_in: $ids, type: ANIME) {
      id
      title { romaji english }
      coverImage { large }
      episodes
      nextAiringEpisode { episode airingAt timeUntilAiring }
    }
  }
}
`;

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export async function fetchAiringByIds(ids: number[]): Promise<AiringMedia[]> {
  const unique = Array.from(new Set(ids.map(Number).filter(Number.isFinite)));
  if (!unique.length) return [];

  const results: AiringMedia[] = [];
  for (const batch of chunk(unique, 50)) {
    const json = await anilistPost(AIRING_QUERY, { ids: batch, perPage: batch.length });
    const media = (json?.data?.Page?.media ?? []) as AiringMedia[];
    media.forEach(item => {
      if (item?.nextAiringEpisode?.airingAt) results.push(item);
    });
  }

  return results.sort(
    (a, b) => (a.nextAiringEpisode!.airingAt || 0) - (b.nextAiringEpisode!.airingAt || 0),
  );
}
