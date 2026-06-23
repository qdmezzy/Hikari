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
