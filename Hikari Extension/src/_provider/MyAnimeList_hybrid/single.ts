import { Cache } from '../../utils/Cache';
import { UrlNotSupportedError } from '../Errors';
import { SingleAbstract } from '../singleAbstract';
import * as helper from '../MyAnimeList_api/helper';

type JikanResponse = {
  data?: {
    mal_id?: number;
    title?: string;
    title_english?: string | null;
    title_japanese?: string | null;
    url?: string;
    type?: string;
    score?: number | null;
    episodes?: number | null;
    chapters?: number | null;
    volumes?: number | null;
    images?: {
      jpg?: {
        image_url?: string | null;
        large_image_url?: string | null;
      };
    };
  };
};

export class Single extends SingleAbstract {
  constructor(protected url: string) {
    super(url);
    this.logger = con.m(this.shortName, '#2e51a2');
    return this;
  }

  private animeInfo: any;

  private displayUrl = '';

  shortName = 'MAL';

  authenticationUrl = '';

  protected handleUrl(url) {
    if (url.match(/myanimelist\.net\/(anime|manga)\/\d*/i)) {
      this.type = utils.urlPart(url, 3) === 'anime' ? 'anime' : 'manga';
      this.ids.mal = Number(utils.urlPart(url, 4));
      return;
    }
    throw new UrlNotSupportedError(url);
  }

  getCacheKey() {
    return this.ids.mal;
  }

  getPageId() {
    return this.ids.mal;
  }

  _getStatus() {
    if (this.type === 'manga') {
      return parseInt(helper.mangaStatus[this.animeInfo.my_list_status.status]);
    }
    return parseInt(helper.animeStatus[this.animeInfo.my_list_status.status]);
  }

  _setStatus(status) {
    if (this.type === 'manga') {
      this.animeInfo.my_list_status.status = helper.mangaStatus[status];
      return;
    }
    this.animeInfo.my_list_status.status = helper.animeStatus[status];
  }

  _getStartDate() {
    return helper.getRoundedDate(this.animeInfo.my_list_status.start_date);
  }

  _setStartDate(startDate) {
    this.animeInfo.my_list_status.start_date = startDate;
  }

  _getFinishDate() {
    return helper.getRoundedDate(this.animeInfo.my_list_status.finish_date);
  }

  _setFinishDate(finishDate) {
    this.animeInfo.my_list_status.finish_date = finishDate;
  }

  _getRewatchCount() {
    if (this.type === 'manga') {
      return this.animeInfo.my_list_status.num_times_reread;
    }
    return this.animeInfo.my_list_status.num_times_rewatched;
  }

  _setRewatchCount(rewatchCount) {
    if (this.type === 'manga') {
      this.animeInfo.my_list_status.num_times_reread = rewatchCount;
    } else {
      this.animeInfo.my_list_status.num_times_rewatched = rewatchCount;
    }
  }

  _getScore() {
    return this.animeInfo.my_list_status.score || 0;
  }

  _setScore(score) {
    this.animeInfo.my_list_status.score = score || 0;
  }

  _getAbsoluteScore() {
    return this.getScore() * 10;
  }

  _setAbsoluteScore(score) {
    if (!score) {
      this.setScore(0);
      return;
    }
    if (score < 10) {
      this.setScore(1);
      return;
    }
    this.setScore(Math.round(score / 10));
  }

  _getEpisode() {
    if (this.type === 'manga') {
      return this.animeInfo.my_list_status.num_chapters_read;
    }
    return this.animeInfo.my_list_status.num_watched_episodes;
  }

  _setEpisode(episode) {
    if (!episode) episode = 0;
    if (this.type === 'manga') {
      this.animeInfo.my_list_status.num_chapters_read = episode;
      return;
    }
    this.animeInfo.my_list_status.num_watched_episodes = episode;
  }

  _getVolume() {
    if (this.type === 'manga') {
      return this.animeInfo.my_list_status.num_volumes_read;
    }
    return 0;
  }

  _setVolume(volume) {
    if (this.type === 'manga') {
      this.animeInfo.my_list_status.num_volumes_read = volume;
    }
  }

  _getTags() {
    if (!this.animeInfo.my_list_status.tags.length) {
      return '';
    }
    return this.animeInfo.my_list_status.tags.join(',');
  }

  _setTags(tags) {
    if (!tags || tags.trim() === ',') {
      this.animeInfo.my_list_status.tags = [];
      return;
    }
    this.animeInfo.my_list_status.tags = tags.split(',');
  }

  _getTitle() {
    return this.animeInfo.title;
  }

  _getTotalEpisodes() {
    if (this.type === 'manga') {
      return this.animeInfo.num_chapters;
    }
    return this.animeInfo.num_episodes;
  }

  _getTotalVolumes() {
    if (this.type === 'manga') {
      return this.animeInfo.num_volumes;
    }
    return 0;
  }

  _getDisplayUrl() {
    return this.displayUrl !== '' && this.displayUrl !== null ? this.displayUrl : this.url;
  }

  _getImage() {
    return this.animeInfo.main_picture?.medium ?? '';
  }

  _getRating() {
    return Promise.resolve(this.animeInfo.mean);
  }

  async _update() {
    const typePath = this.type === 'manga' ? 'manga' : 'anime';
    const cache = new Cache(`jikan/${typePath}/${this.ids.mal}`, 6 * 60 * 60 * 1000);
    let payload = await cache.getValue();

    if (!payload) {
      const url = `https://api.jikan.moe/v4/${typePath}/${this.ids.mal}`;
      const response = await api.request.xhr('GET', url);
      payload = JSON.parse(response.responseText || '{}');
      await cache.setValue(payload);
    }

    const data = (payload as JikanResponse)?.data;
    if (!data) {
      throw new Error('Jikan lookup failed');
    }

    const title = data.title_english || data.title || data.title_japanese || '';
    const image = data.images?.jpg?.image_url || '';
    const imageLarge = data.images?.jpg?.large_image_url || image;

    this._authenticated = true;
    this.animeInfo = {
      title,
      num_episodes: data.episodes || 0,
      num_chapters: data.chapters || 0,
      num_volumes: data.volumes || 0,
      mean: data.score || 0,
      main_picture: {
        medium: image,
        large: imageLarge,
      },
      my_list_status:
        this.type === 'manga'
          ? {
              is_rereading: false,
              num_chapters_read: 0,
              num_volumes_read: 0,
              num_times_reread: 0,
              score: 0,
              status: 'plan_to_read',
              tags: [],
              start_date: '',
              finish_date: '',
            }
          : {
              is_rewatching: false,
              num_watched_episodes: 0,
              num_times_rewatched: 0,
              score: 0,
              status: 'plan_to_watch',
              tags: [],
              start_date: '',
              finish_date: '',
            },
    };
    this.displayUrl = data.url || this.url;
    this._onList = false;
  }

  async _sync(): Promise<void> {
    return;
  }

  async _delete(): Promise<void> {
    return;
  }
}
