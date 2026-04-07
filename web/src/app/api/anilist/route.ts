import { NextResponse } from "next/server";

type CacheEntry = {
  status: number;
  body: string;
  cachedAt: number;
  ttlMs: number;
};

const CACHE_TTL_MS = 1000 * 60 * 2;
const RATE_LIMIT_TTL_MS = 1000 * 8;
const CACHE_VERSION = "v2";
// Rely on AniList's isAdult flag for NSFW filtering. A plain "adult" text match
// in descriptions/tags causes false positives for legitimate series.
const BLOCKED_TERMS = ["hentai"];

const containsBlockedTerm = (value: unknown) => {
  if (typeof value !== "string") return false;
  const normalized = value.toLowerCase();
  return BLOCKED_TERMS.some((term) => normalized.includes(term));
};

const sanitizeVariables = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeVariables(item))
      .filter((item) => item !== null && item !== undefined && item !== "");
  }

  if (!value || typeof value !== "object") return value;

  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(input)) {
    if (/^isadult$/i.test(key) && raw === true) {
      out[key] = false;
      continue;
    }

    if (typeof raw === "string" && /genre|tag|search/i.test(key) && containsBlockedTerm(raw)) {
      continue;
    }

    out[key] = sanitizeVariables(raw);
  }

  return out;
};

const sanitizeAniListRequest = (rawBody: unknown) => {
  const body = rawBody && typeof rawBody === "object" ? { ...(rawBody as Record<string, unknown>) } : {};

  if (typeof body.query === "string") {
    body.query = body.query.replace(/isAdult\s*:\s*true/gi, "isAdult: false");
  }

  if ("variables" in body) {
    body.variables = sanitizeVariables(body.variables);
  }

  return body;
};

const mediaIsBlocked = (item: Record<string, unknown>) => {
  if (item.isAdult === true) return true;

  const title = item.title && typeof item.title === "object" ? (item.title as Record<string, unknown>) : null;
  if (title && Object.values(title).some((v) => containsBlockedTerm(v))) return true;

  if (Array.isArray(item.genres) && item.genres.some((g) => containsBlockedTerm(g))) return true;

  if (Array.isArray(item.tags)) {
    const hasBlockedTag = item.tags.some((tag) => {
      if (!tag || typeof tag !== "object") return containsBlockedTerm(tag);
      const t = tag as Record<string, unknown>;
      return containsBlockedTerm(t.name) || containsBlockedTerm(t.description) || t.isAdult === true;
    });
    if (hasBlockedTag) return true;
  }

  if (containsBlockedTerm(item.description)) return true;

  return false;
};

const sanitizeAniListResponse = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeAniListResponse(item))
      .filter((item) => item !== null && item !== undefined);
  }

  if (!value || typeof value !== "object") return value;

  const input = value as Record<string, unknown>;
  if (mediaIsBlocked(input)) return null;

  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    out[key] = sanitizeAniListResponse(raw);
  }
  return out;
};

const getCaches = () => {
  const g = globalThis as unknown as {
    __hikariAniListCache?: Map<string, CacheEntry>;
    __hikariAniListInflight?: Map<string, Promise<CacheEntry>>;
  };
  if (!g.__hikariAniListCache) g.__hikariAniListCache = new Map();
  if (!g.__hikariAniListInflight) g.__hikariAniListInflight = new Map();
  return { cache: g.__hikariAniListCache, inflight: g.__hikariAniListInflight };
};

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const body = sanitizeAniListRequest(rawBody);
    const key = JSON.stringify({ v: CACHE_VERSION, body: body ?? {} });
    const { cache, inflight } = getCaches();

    const cached = cache.get(key);
    if (cached && Date.now() - cached.cachedAt < cached.ttlMs) {
      return new NextResponse(cached.body, {
        status: cached.status,
        headers: { "Content-Type": "application/json", "X-Hikari-Cache": "HIT" },
      });
    }

    const existing = inflight.get(key);
    if (existing) {
      const entry = await existing;
      return new NextResponse(entry.body, {
        status: entry.status,
        headers: { "Content-Type": "application/json", "X-Hikari-Cache": "SHARED" },
      });
    }

    const promise = (async (): Promise<CacheEntry> => {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let safeBody = text;

      try {
        const parsed = JSON.parse(text);
        const sanitized = sanitizeAniListResponse(parsed);
        safeBody = JSON.stringify(sanitized ?? { data: {} });
      } catch {
        // Keep original payload if AniList returns non-JSON text.
      }

      const ttlMs = res.status === 429 ? RATE_LIMIT_TTL_MS : CACHE_TTL_MS;
      const entry: CacheEntry = { status: res.status, body: safeBody, cachedAt: Date.now(), ttlMs };
      cache.set(key, entry);
      return entry;
    })();

    inflight.set(key, promise);
    try {
      const entry = await promise;
      return new NextResponse(entry.body, {
        status: entry.status,
        headers: { "Content-Type": "application/json", "X-Hikari-Cache": "MISS" },
      });
    } finally {
      inflight.delete(key);
    }
  } catch (err) {
    return NextResponse.json(
      { error: "AniList proxy failed", details: String(err) },
      { status: 500 }
    );
  }
}
