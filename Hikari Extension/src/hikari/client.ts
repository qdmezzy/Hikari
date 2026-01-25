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

async function request(path: string, options: RequestInit = {}) {
  const { url, anonKey } = getHikariConfig();
  const session = await getValidSession();
  if (!session) {
    throw new Error('Not signed in.');
  }

  const headers = new Headers(options.headers || {});
  headers.set('apikey', anonKey);
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  headers.set('Content-Type', 'application/json');

  const res = await fetch(`${url}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Request failed');
  }

  if (res.status === 204) {
    return null;
  }

  return res.json();
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
