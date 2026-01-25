const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

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
  const res = await fetch(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: { search, page: 1, perPage: 5 },
    }),
  });

  const json = await res.json();
  if (!res.ok || json?.errors) {
    throw new Error(json?.errors?.[0]?.message || 'AniList search failed');
  }

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
  const res = await fetch(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: MEDIA_QUERY,
      variables: { id },
    }),
  });

  const json = await res.json();
  if (!res.ok || json?.errors) {
    throw new Error(json?.errors?.[0]?.message || 'AniList lookup failed');
  }

  return json?.data?.Media ?? null;
}
