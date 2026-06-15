const ANILIST_URL = "https://graphql.anilist.co";

const requestAniList = async (query, variables = {}) => {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (!res.ok || json?.errors?.length) {
    const message = json?.errors?.[0]?.message || `AniList request failed (${res.status})`;
    throw new Error(message);
  }

  return json.data;
};

const SEARCH_ANIME_QUERY = `
query ($search: String!) {
  Media(search: $search, type: ANIME, isAdult: false) {
    id
    title { romaji english }
    description(asHtml: false)
    status
    format
    episodes
    averageScore
    startDate { year }
    genres
    studios(isMain: true) { nodes { name } }
    siteUrl
    coverImage { medium large }
    trailer { id site }
    externalLinks { site url }
  }
}
`;

const MEDIA_BY_IDS_QUERY = `
query ($ids: [Int], $perPage: Int) {
  Page(perPage: $perPage) {
    media(id_in: $ids, sort: POPULARITY_DESC, isAdult: false) {
      id
      title { romaji english }
      description(asHtml: false)
      status
      format
      episodes
      averageScore
      startDate { year }
      genres
      studios(isMain: true) { nodes { name } }
      siteUrl
      coverImage { medium large }
      trailer { id site }
      externalLinks { site url }
    }
  }
}
`;

const RECOMMENDATION_QUERY = `
query ($genreIn: [String], $tagIn: [String], $perPage: Int) {
  Page(perPage: $perPage) {
    media(
      type: ANIME,
      sort: POPULARITY_DESC,
      genre_in: $genreIn,
      tag_in: $tagIn,
      isAdult: false
    ) {
      id
      title { romaji english }
      description(asHtml: false)
      status
      format
      episodes
      averageScore
      startDate { year }
      genres
      studios(isMain: true) { nodes { name } }
      siteUrl
      coverImage { medium large }
      trailer { id site }
      externalLinks { site url }
    }
  }
}
`;

export const mediaTitle = (media) =>
  media?.title?.english || media?.title?.romaji || "Unknown title";

export const buildTrailerUrl = (media) => {
  const site = String(media?.trailer?.site || "").toLowerCase();
  const id = media?.trailer?.id;
  if (site === "youtube" && id) return `https://www.youtube.com/watch?v=${id}`;
  if (site === "dailymotion" && id) return `https://www.dailymotion.com/video/${id}`;

  const fallback = Array.isArray(media?.externalLinks)
    ? media.externalLinks.find((item) => /youtube|trailer/i.test(String(item?.site || "")))
    : null;

  return fallback?.url || media?.siteUrl || null;
};

export const searchAnime = async (searchText) => {
  const data = await requestAniList(SEARCH_ANIME_QUERY, { search: searchText });
  return data?.Media || null;
};

export const getAnimeByIds = async (ids) => {
  const uniqueIds = Array.from(new Set((ids || []).map((id) => Number(id)).filter(Number.isFinite)));
  if (uniqueIds.length === 0) return [];
  const data = await requestAniList(MEDIA_BY_IDS_QUERY, {
    ids: uniqueIds,
    perPage: Math.min(uniqueIds.length, 50),
  });
  return data?.Page?.media || [];
};

export const getRecommendationPool = async ({ genres = [], tags = [], perPage = 20 } = {}) => {
  const data = await requestAniList(RECOMMENDATION_QUERY, {
    genreIn: genres.length ? genres : null,
    tagIn: tags.length ? tags : null,
    perPage,
  });
  return data?.Page?.media || [];
};

const AIRING_SCHEDULE_QUERY = `
query ($start: Int, $end: Int, $perPage: Int) {
  Page(perPage: $perPage) {
    airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
      episode
      airingAt
      media {
        id
        isAdult
        format
        title { romaji english }
        siteUrl
        coverImage { medium }
      }
    }
  }
}
`;

/**
 * Episodes airing within the next `hours` window (default 24h), SFW only.
 * Returns [{ episode, airingAt, media }].
 */
export const getAiringSchedule = async ({ hours = 24, perPage = 50 } = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const data = await requestAniList(AIRING_SCHEDULE_QUERY, {
    start: now,
    end: now + hours * 3600,
    perPage,
  });
  return (data?.Page?.airingSchedules || []).filter((entry) => entry?.media && !entry.media.isAdult);
};
