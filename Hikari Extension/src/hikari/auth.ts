import { getHikariConfig } from './config';
import { getSession, setSession } from './storage';

type SessionResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      display_name?: string;
    };
  };
};

export async function signInWithPassword(email: string, password: string) {
  const { url, anonKey } = getHikariConfig();
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = (await res.json()) as SessionResponse;
  if (!res.ok) {
    throw new Error((data as any)?.error_description || 'Sign in failed');
  }

  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
  await setSession({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName: data.user.user_metadata?.display_name,
    },
  });
}

export async function signOut() {
  await setSession(null);
}

export async function getValidSession() {
  const session = await getSession();
  if (!session) return null;
  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt - 60 > now) return session;
  return refreshSession(session.refreshToken);
}

export async function refreshSession(refreshToken: string) {
  const { url, anonKey } = getHikariConfig();
  const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const data = (await res.json()) as SessionResponse;
  if (!res.ok) {
    await setSession(null);
    throw new Error((data as any)?.error_description || 'Session refresh failed');
  }

  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
  await setSession({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName: data.user.user_metadata?.display_name,
    },
  });
  return getSession();
}
