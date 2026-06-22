-- Tables backing the public /status page.
-- Run this in the Supabase SQL editor. Safe to re-run.

-- 1) Bot (and future services) liveness heartbeat.
create table if not exists public.service_heartbeats (
  service text primary key,
  last_seen timestamptz not null default now(),
  meta jsonb
);

-- 2) Manually-posted incidents / status updates shown on /status.
create table if not exists public.status_incidents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  severity text not null default 'minor',     -- minor | major | maintenance
  title text not null,
  body text,
  resolved boolean not null default false,
  resolved_at timestamptz
);

create index if not exists status_incidents_created_idx
  on public.status_incidents (created_at desc);

-- The /status API reads these with the service-role key (server-side), so RLS
-- can stay restrictive. Enable RLS and add no public policies: the anon client
-- never touches these tables directly.
alter table public.service_heartbeats enable row level security;
alter table public.status_incidents enable row level security;

-- Example: post an incident
--   insert into public.status_incidents (severity, title, body)
--   values ('major', 'Login is degraded', 'We are investigating slow sign-ins.');
-- Mark it resolved
--   update public.status_incidents
--   set resolved = true, resolved_at = now()
--   where title = 'Login is degraded';
