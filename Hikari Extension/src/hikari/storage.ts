type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    id: string;
    email?: string;
    displayName?: string;
  };
};

const SESSION_KEY = 'hikariSession';
const MATCH_CACHE_KEY = 'hikariMatchCache';
const SETTINGS_KEY = 'hikariExtensionSettings';
const LAST_AUTO_UPDATE_KEY = 'hikariLastAutoUpdate';
const AUTO_UPDATES_KEY = 'hikariAutoUpdates';
const AUTO_UPDATES_CAP = 40;
const LIVE_PROGRESS_KEY = 'hikariLiveProgress';

export type ExtensionSettings = {
  autoTrack: boolean;
  notifications: boolean;
  quicklinks: string[];
};

export type LastAutoUpdate = {
  at: number;
  title?: string;
  episode?: number;
  site?: string;
  mediaId?: number;
  image?: string;
};

const DEFAULT_SETTINGS: ExtensionSettings = {
  autoTrack: true,
  notifications: true,
  quicklinks: ['crunchyroll'],
};

export async function getSession(): Promise<StoredSession | null> {
  const result = await chrome.storage.local.get(SESSION_KEY);
  return (result[SESSION_KEY] as StoredSession) || null;
}

export async function setSession(session: StoredSession | null) {
  if (!session) {
    await chrome.storage.local.remove(SESSION_KEY);
    return;
  }
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

export async function getMatchCache(): Promise<Record<string, number>> {
  const result = await chrome.storage.local.get(MATCH_CACHE_KEY);
  return (result[MATCH_CACHE_KEY] as Record<string, number>) || {};
}

export async function setMatchCache(cache: Record<string, number>) {
  await chrome.storage.local.set({ [MATCH_CACHE_KEY]: cache });
}

export async function cacheMatch(key: string, mediaId: number) {
  const cache = await getMatchCache();
  cache[key] = mediaId;
  await setMatchCache(cache);
}

export async function getCachedMatch(key: string): Promise<number | null> {
  const cache = await getMatchCache();
  return cache[key] || null;
}

export async function getExtensionSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as ExtensionSettings | undefined;
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}

export async function setExtensionSettings(settings: ExtensionSettings) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function getLastAutoUpdate(): Promise<LastAutoUpdate | null> {
  const result = await chrome.storage.local.get(LAST_AUTO_UPDATE_KEY);
  return (result[LAST_AUTO_UPDATE_KEY] as LastAutoUpdate) || null;
}

export async function setLastAutoUpdate(update: LastAutoUpdate) {
  await chrome.storage.local.set({ [LAST_AUTO_UPDATE_KEY]: update });
}

// Live "now watching" status the content script writes as you watch, so the
// popup can show exactly what's happening (and self-heal state) in real time.
export type LiveProgress = {
  at: number;
  episode?: number;
  fraction: number; // 0..1 of the episode watched
  state: 'watching' | 'saving' | 'saved' | 'error';
  site?: string;
};

export async function getLiveProgress(): Promise<LiveProgress | null> {
  const result = await chrome.storage.local.get(LIVE_PROGRESS_KEY);
  return (result[LIVE_PROGRESS_KEY] as LiveProgress) || null;
}

export async function setLiveProgress(progress: LiveProgress | null) {
  if (!progress) {
    await chrome.storage.local.remove(LIVE_PROGRESS_KEY);
    return;
  }
  await chrome.storage.local.set({ [LIVE_PROGRESS_KEY]: progress });
}

export async function getAutoUpdates(): Promise<LastAutoUpdate[]> {
  const result = await chrome.storage.local.get(AUTO_UPDATES_KEY);
  return (result[AUTO_UPDATES_KEY] as LastAutoUpdate[]) || [];
}

// Append an auto-tracked update to the running history (newest first, deduped
// by media+episode so re-fires don't pile up). Also keeps lastAutoUpdate.
export async function pushAutoUpdate(update: LastAutoUpdate) {
  const list = await getAutoUpdates();
  const filtered = list.filter(
    item => !(item.mediaId === update.mediaId && item.episode === update.episode),
  );
  const next = [update, ...filtered].slice(0, AUTO_UPDATES_CAP);
  await chrome.storage.local.set({
    [AUTO_UPDATES_KEY]: next,
    [LAST_AUTO_UPDATE_KEY]: update,
  });
}
