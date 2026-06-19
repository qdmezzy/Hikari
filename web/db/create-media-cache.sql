-- Server-side cache of AniList media metadata (covers, titles, genres, etc.).
--
-- This is the foundation for owning your own media API: the app talks to
-- /api/media instead of AniList directly, and /api/media serves from this
-- table first, only hitting AniList for misses/stale rows. Over time you
-- accumulate your own copy of the catalog — faster, outage-resistant, and a
-- drop-in seam to later swap AniList for your own synced dataset.
--
-- Writes happen ONLY via the service role (the /api/media route). RLS is on
-- with no policies, so regular clients can't read/write it directly.

CREATE TABLE IF NOT EXISTS public.media_cache (
  media_id BIGINT PRIMARY KEY,           -- AniList media id (your canonical id for now)
  data JSONB NOT NULL,                    -- the media object as the app consumes it
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_cache_fetched_at ON public.media_cache(fetched_at);

ALTER TABLE public.media_cache ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (server) touches this cache.
