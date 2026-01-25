import { searchInterface } from '../definitions';

type JikanItem = {
  mal_id: number;
  title?: string;
  title_english?: string | null;
  title_japanese?: string | null;
  title_synonyms?: string[];
  url?: string;
  type?: string;
  score?: number | null;
  year?: number | null;
  episodes?: number | null;
  chapters?: number | null;
  images?: {
    jpg?: {
      image_url?: string | null;
      large_image_url?: string | null;
    };
  };
  aired?: {
    prop?: {
      from?: { year?: number | null };
    };
  };
  published?: {
    prop?: {
      from?: { year?: number | null };
    };
  };
};

const buildAltNames = (item: JikanItem): string[] =>
  [item.title_english, item.title_japanese, ...(item.title_synonyms || [])].filter(
    (value): value is string => Boolean(value),
  );

const getYear = (item: JikanItem, type: 'anime' | 'manga') => {
  if (item.year) return item.year;
  if (type === 'anime') return item.aired?.prop?.from?.year ?? null;
  return item.published?.prop?.from?.year ?? null;
};

export const search: searchInterface = async function (
  keyword,
  type: 'anime' | 'manga',
  options = {},
  sync = false,
) {
  const query = keyword.trim();
  if (!query) return [];

  const url = `https://api.jikan.moe/v4/${type}?q=${encodeURIComponent(query)}&limit=15&order_by=popularity`;
  const response = await api.request.xhr('GET', url);
  const json = JSON.parse(response.responseText || '{}');
  const items = (json?.data as JikanItem[]) || [];

  return items.map(item => {
    const image = item.images?.jpg?.image_url || '';
    const imageLarge = item.images?.jpg?.large_image_url || image;
    const itemType = item.type || '';
    const isNovel = itemType.toLowerCase().includes('novel');
    const title = item.title || item.title_english || item.title_japanese || '';
    return {
      id: item.mal_id,
      name: title,
      altNames: buildAltNames(item),
      url: item.url || `https://myanimelist.net/${type}/${item.mal_id}`,
      malUrl: async () => `https://myanimelist.net/${type}/${item.mal_id}`,
      image,
      imageLarge,
      media_type: itemType,
      isNovel,
      score: String(item.score ?? ''),
      year: String(getYear(item, type) ?? ''),
      totalEp: type === 'anime' ? item.episodes || 0 : item.chapters || 0,
    };
  });
};
