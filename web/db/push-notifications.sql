-- Web push: browser subscriptions + which titles each user wants episode
-- alerts for. Subscriptions are written by the server (service role) after
-- verifying the user's token; alerts are managed by the user directly.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

create table if not exists public.episode_alerts (
  user_id uuid not null references auth.users (id) on delete cascade,
  media_id integer not null,
  last_notified_episode integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

alter table public.episode_alerts enable row level security;

drop policy if exists "Users manage own episode alerts" on public.episode_alerts;
create policy "Users manage own episode alerts"
on public.episode_alerts
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
