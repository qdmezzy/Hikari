import { pageInterface } from '../pageInterface';

type ZoroSyncData = {
  page: 'episode' | 'anime';
  name: string;
  anime_id: string;
  mal_id: string;
  anilist_id: string;
  series_url: string;
  selector_position?: string;
  episode?: string;
  next_episode_url?: string;
};

let jsonData: ZoroSyncData | null = null;
let fallbackData: ZoroSyncData | null = null;

const isWatchPage = (url: string) => /\/watch\//.test(url);
const isAnimePage = (url: string) => !isWatchPage(url) && /\/[^/]+-\d+(?:\?|$)/.test(url);

const getSlugFromUrl = (url: string) => {
  const cleaned = url.split('?')[0].split('#')[0];
  const parts = cleaned.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
};

const getAnimeIdFromSlug = (slug: string) => {
  const match = slug.match(/-(\d+)$/);
  return match ? match[1] : '';
};

const getOverviewUrlFromUrl = (url: string) => url.replace('/watch/', '/').split('?')[0];

const getTitleFromDom = () => {
  const ogTitle = j.$('meta[property="og:title"]').attr('content');
  const filmName = j.$('.film-name').first().text().trim();
  const heading = j.$('h2.film-name').first().text().trim();
  const docTitle = document.title.replace(/\s*[-|].*$/, '').trim();
  return utils.htmlDecode(filmName || heading || ogTitle || docTitle || '');
};

const getEpisodeFromDom = () => {
  const active = j
    .$(
      '.ss-list > a.active, .ss-list > a[aria-current="true"], .ss-list > a.active, .ep-item.active',
    )
    .first();
  const attrNumber = active.attr('data-number');
  if (attrNumber) return attrNumber;
  const textMatch = active.text().trim().match(/\d+/);
  if (textMatch) return textMatch[0];
  const epLabel = j.$('.episode-number, .ep-number, .episode-title').first().text().trim();
  const labelMatch = epLabel.match(/\d+/);
  return labelMatch ? labelMatch[0] : '';
};

const getNextEpisodeUrlFromDom = () => {
  const link = j
    .$(
      'a.btn-next, a.ss-next, a.btn-next-ep, a.next-episode, a.btn-next-episode, a.next',
    )
    .first()
    .attr('href');
  return link ? utils.absoluteLink(link, Zoro.domain) : '';
};

const buildFallbackData = (url: string): ZoroSyncData | null => {
  const slug = getSlugFromUrl(url);
  const animeId = getAnimeIdFromSlug(slug);
  const identifier = animeId || slug;
  const title = getTitleFromDom();
  if (!identifier && !title) return null;
  const watchPage = isWatchPage(url);
  return {
    page: watchPage ? 'episode' : 'anime',
    name: title,
    anime_id: identifier,
    mal_id: '',
    anilist_id: '',
    series_url: getOverviewUrlFromUrl(url),
    selector_position: '.anisc-detail, .ani_detail, .film-stats, .film-name',
    episode: watchPage ? getEpisodeFromDom() : undefined,
    next_episode_url: watchPage ? getNextEpisodeUrlFromDom() : undefined,
  };
};

const getData = () => jsonData || fallbackData;

export const Zoro: pageInterface = {
  name: 'HiAnime',
  domain: 'https://hianime.to',
  languages: ['English'],
  type: 'anime',
  database: 'Zoro',
  isSyncPage(url) {
    const data = getData();
    if (data?.page) return data.page === 'episode';
    return isWatchPage(url);
  },
  isOverviewPage(url) {
    const data = getData();
    if (data?.page) return data.page === 'anime';
    return isAnimePage(url);
  },
  sync: {
    getTitle(url) {
      const data = getData();
      return utils.htmlDecode(data?.name || getTitleFromDom());
    },
    getIdentifier(url) {
      const data = getData();
      if (data?.anime_id) return data.anime_id;
      const slug = getSlugFromUrl(url);
      return getAnimeIdFromSlug(slug) || slug;
    },
    getOverviewUrl(url) {
      const data = getData();
      if (data?.series_url) return data.series_url.replace('watch/', '');
      return getOverviewUrlFromUrl(url);
    },
    getEpisode(url) {
      const data = getData();
      const episodeValue = data?.episode || getEpisodeFromDom();
      const parsed = parseInt(episodeValue || '0', 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    },
    nextEpUrl(url) {
      const data = getData();
      return data?.next_episode_url || getNextEpisodeUrlFromDom();
    },
    getMalUrl(provider) {
      const data = getData();
      if (data?.mal_id) return `https://myanimelist.net/anime/${data.mal_id}`;
      if (provider === 'ANILIST' && data?.anilist_id)
        return `https://anilist.co/anime/${data.anilist_id}`;
      return false;
    },
  },
  overview: {
    getTitle(url) {
      const data = getData();
      return utils.htmlDecode(data?.name || getTitleFromDom());
    },
    getIdentifier(url) {
      const data = getData();
      if (data?.anime_id) return data.anime_id;
      const slug = getSlugFromUrl(url);
      return getAnimeIdFromSlug(slug) || slug;
    },
    uiSelector(selector) {
      const data = getData();
      const targetSelector = data?.selector_position || '.anisc-detail, .ani_detail, .film-stats';
      const target = j.$(targetSelector).first();
      if (target.length) {
        target.append(j.html(selector));
      }
    },
    getMalUrl(provider) {
      return Zoro.sync.getMalUrl!(provider);
    },
    list: {
      offsetHandler: false,
      elementsSelector() {
        return j.$('.ss-list > a');
      },
      elementUrl(selector) {
        return utils.absoluteLink(selector.attr('href'), Zoro.domain);
      },
      elementEp(selector) {
        return Number(selector.attr('data-number'));
      },
    },
  },
  init(page) {
    api.storage.addStyle(
      require('!to-string-loader!css-loader!less-loader!./style.less').toString(),
    );

    let _debounce;

    utils.changeDetect(check, () => `${location.href}|${j.$('#syncData').text()}`);
    check();

    function check() {
      page.reset();
      jsonData = null;
      fallbackData = null;
      if (j.$('#syncData').length) {
        try {
          jsonData = JSON.parse(j.$('#syncData').text());
        } catch (error) {
          jsonData = null;
        }
      }
      if (!jsonData) {
        fallbackData = buildFallbackData(location.href);
      }

      if (jsonData || fallbackData) {
        clearTimeout(_debounce);
        _debounce = setTimeout(() => {
          page.handlePage();
        }, 500);
      }
    }
  },
};
