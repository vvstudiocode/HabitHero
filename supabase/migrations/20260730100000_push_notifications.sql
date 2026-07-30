-- Per-profile notification preferences and device registrations.
-- Tokens are scoped to the authenticated profile, not only auth.uid(), because
-- a child session is anonymous and the same physical device can switch roles.

alter table public.profiles
  add column if not exists notifications_enabled boolean not null default false;

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  child_profile_id uuid references public.child_profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  token text not null check (char_length(trim(token)) between 20 and 4096),
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, token)
);

create index if not exists push_devices_family_child_idx
  on public.push_devices (family_id, child_profile_id, enabled);

alter table public.push_devices enable row level security;
revoke all on table public.push_devices from public, anon;
-- The app only needs write access; raw APNs tokens are never readable by clients.
grant insert, update, delete on table public.push_devices to authenticated;

drop policy if exists push_devices_insert on public.push_devices;
create policy push_devices_insert on public.push_devices
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and private.is_family_member(family_id)
    and (
      child_profile_id is null
      or exists (
        select 1
        from public.child_profiles child
        where child.id = push_devices.child_profile_id
          and child.family_id = push_devices.family_id
          and (child.profile_id = (select auth.uid()) or private.is_family_parent(push_devices.family_id))
      )
    )
  );

drop policy if exists push_devices_update on public.push_devices;
create policy push_devices_update on public.push_devices
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and private.is_family_member(family_id)
    and (
      child_profile_id is null
      or exists (
        select 1
        from public.child_profiles child
        where child.id = push_devices.child_profile_id
          and child.family_id = push_devices.family_id
          and (child.profile_id = (select auth.uid()) or private.is_family_parent(push_devices.family_id))
      )
    )
  );

drop policy if exists push_devices_delete on public.push_devices;
create policy push_devices_delete on public.push_devices
  for delete to authenticated
  using (profile_id = (select auth.uid()));

drop trigger if exists push_devices_updated_at on public.push_devices;
create trigger push_devices_updated_at
  before update on public.push_devices
  for each row execute function private.touch_updated_at();
