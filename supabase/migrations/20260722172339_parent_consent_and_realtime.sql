create table if not exists public.parent_consents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  parent_profile_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null check (consent_type = 'parental'),
  consent_version text not null check (char_length(trim(consent_version)) between 1 and 40),
  consented_at timestamptz not null default timezone('utc', now()),
  unique (family_id, parent_profile_id, consent_type)
);

alter table public.parent_consents enable row level security;
revoke all on table public.parent_consents from public, anon, authenticated;

create policy parent_consents_select on public.parent_consents
  for select to authenticated
  using (private.is_family_parent(family_id) and parent_profile_id = (select auth.uid()));

create or replace function public.record_parent_consent(target_family_id uuid, consent_version text)
returns public.parent_consents
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  consent_row public.parent_consents;
begin
  if (select auth.uid()) is null or not private.is_family_parent(target_family_id) then
    raise exception 'family not found or not authorized' using errcode = '42501';
  end if;
  if consent_version is null or char_length(trim(consent_version)) not between 1 and 40 then
    raise exception 'consent version is invalid' using errcode = '22023';
  end if;
  insert into public.parent_consents (family_id, parent_profile_id, consent_type, consent_version)
  values (target_family_id, (select auth.uid()), 'parental', trim(consent_version))
  on conflict (family_id, parent_profile_id, consent_type)
  do update set consent_version = excluded.consent_version, consented_at = timezone('utc', now())
  returning * into consent_row;
  return consent_row;
end;
$$;

revoke all on function public.record_parent_consent(uuid, text) from public, anon;
grant execute on function public.record_parent_consent(uuid, text) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles', 'families', 'family_members', 'child_profiles', 'task_templates', 'tasks', 'rewards', 'wishlist_items', 'reward_redemptions', 'point_ledger', 'parent_consents'] loop
    execute format('alter table public.%I replica identity full', table_name);
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception when duplicate_object then
      null;
    end;
  end loop;
end;
$$;
