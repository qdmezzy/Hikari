-- Shared cache for AniList proxy responses.
-- The in-memory cache inside the serverless function dies on every cold start
-- and isn't shared between instances; this table is the durable layer that
-- keeps repeat queries (Discover, homepage, search) off AniList's rate limit.
-- Only the service role touches it — RLS is enabled with no policies.

create table if not exists public.anilist_query_cache (
  cache_key text primary key,
  status integer not null,
  body text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.anilist_query_cache enable row level security;

create index if not exists anilist_query_cache_expires_at_idx
  on public.anilist_query_cache (expires_at);
