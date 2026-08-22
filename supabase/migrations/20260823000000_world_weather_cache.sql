create table if not exists public.world_weather_cache (
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.world_weather_cache enable row level security;

revoke all on table public.world_weather_cache from public;
revoke all on table public.world_weather_cache from anon, authenticated;

comment on table public.world_weather_cache is 'Server-side cache for shared external weather responses.';
