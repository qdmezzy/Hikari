const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

// Route AniList calls through the background service worker (api.request.xhr)
// rather than fetch(). Content scripts on strict-CSP streaming sites (e.g.
// Crunchyroll) can't fetch cross-origin directly, but the background can.
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

export async function fetchMediaById(id: number) {
  const json = await anilistPost(MEDIA_QUERY, { id });
  return json?.data?.Media ?? null;
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

// Fetch next-airing info for a set of AniList ids. Only returns titles that
// actually have an upcoming episode scheduled.
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
