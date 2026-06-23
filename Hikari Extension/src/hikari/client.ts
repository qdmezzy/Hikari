import { getHikariConfig } from './config';
import { getValidSession } from './auth';

type ListEntry = {
  user_id: string;
  media_id: number;
  media_type: 'ANIME' | 'MANGA';
  status: 'watching' | 'completed' | 'dropped' | 'on_hold' | 'rewatching' | 'plan_to_watch';
  progress: number;
  score?: number | null;
};

type FetchEntriesOptions = {
  status?: ListEntry['status'] | ListEntry['status'][];
  limit?: number;
  orderBy?: 'updated_at' | 'progress' | 'created_at';
  orderDir?: 'asc' | 'desc';
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
};

// All Supabase REST calls go through the background worker (api.request.xhr) so
// auto-tracking writes succeed from content scripts on CSP-locked sites too.
async function request(path: string, options: RequestOptions = {}) {
  const { url, anonKey } = getHikariConfig();
  const session = await getValidSession();
  if (!session) {
    throw new Error('Not signed in.');
  }

  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await api.request.xhr(options.method || 'GET', {
    url: `${url}${path}`,
    headers,
    data: options.body,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.responseText || 'Request failed');
  }

  if (!response.responseText) {
    return null;
  }

  try {
    return JSON.parse(response.responseText);
  } catch {
    return null;
  }
}

export async function fetchEntry(mediaId: number) {
  const session = await getValidSession();
  if (!session) throw new Error('Not signed in.');
  const params = new URLSearchParams({
    select: '*',
    user_id: `eq.${session.user.id}`,
    media_id: `eq.${mediaId}`,
  });
  const result = await request(`/rest/v1/list_entries?${params.toString()}`, { method: 'GET' });
  return Array.isArray(result) ? result[0] || null : null;
}

export async function upsertEntry(entry: ListEntry) {
  const params = new URLSearchParams({
    on_conflict: 'user_id,media_id',
  });
  await request(`/rest/v1/list_entries?${params.toString()}`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(entry),
  });
}

export async function fetchEntries(options: FetchEntriesOptions = {}) {
  const session = await getValidSession();
  if (!session) throw new Error('Not signed in.');

  const params = new URLSearchParams({
    select: 'media_id,status,progress,media_type,updated_at,created_at',
    user_id: `eq.${session.user.id}`,
  });

  if (options.status) {
    const statusList = Array.isArray(options.status) ? options.status : [options.status];
    params.set('status', `in.(${statusList.join(',')})`);
  }

  if (options.orderBy) {
    params.set('order', `${options.orderBy}.${options.orderDir || 'desc'}`);
  }

  if (options.limit) {
    params.set('limit', String(options.limit));
  }

  const result = await request(`/rest/v1/list_entries?${params.toString()}`, { method: 'GET' });
  return Array.isArray(result) ? result : [];
}
