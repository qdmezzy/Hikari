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

async function authRequest(path: string, body: Record<string, unknown>): Promise<SessionResponse> {
  const { url, anonKey } = getHikariConfig();
  const response = await api.request.xhr('POST', {
    url: `${url}${path}`,
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    data: JSON.stringify(body),
  });

  let data: any = {};
  try {
    data = JSON.parse(response.responseText || '{}');
  } catch {
    data = {};
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(data?.error_description || data?.msg || 'Authentication failed');
  }

  return data as SessionResponse;
}

const persist = async (data: SessionResponse) => {
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
};

export async function signInWithPassword(email: string, password: string) {
  const data = await authRequest('/auth/v1/token?grant_type=password', { email, password });
  await persist(data);
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
  try {
    const data = await authRequest('/auth/v1/token?grant_type=refresh_token', {
      refresh_token: refreshToken,
    });
    await persist(data);
  } catch (e) {
    await setSession(null);
    throw e;
  }
  return getSession();
}
