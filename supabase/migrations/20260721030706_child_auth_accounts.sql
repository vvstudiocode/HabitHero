alter table public.child_profiles
  add column if not exists login_name text;

alter table public.child_profiles
  drop constraint if exists child_profiles_login_name_format;
alter table public.child_profiles
  add constraint child_profiles_login_name_format
  check (login_name is null or login_name ~ '^[a-z0-9][a-z0-9_]{2,31}$');

create unique index if not exists child_profiles_login_name_key
  on public.child_profiles (login_name)
  where login_name is not null;

create or replace function public.provision_child_account(
  target_family_id uuid,
  child_name text,
  target_login_name text,
  target_profile_id uuid
)
returns public.child_profiles
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  child_row public.child_profiles;
  normalized_login_name text := lower(trim(target_login_name));
begin
  if (select auth.uid()) is null or not private.is_family_parent(target_family_id) then
    raise exception 'family not found or not authorized' using errcode = '42501';
  end if;
  if child_name is null or char_length(trim(child_name)) not between 1 and 80 then
    raise exception 'child name is invalid' using errcode = '22023';
  end if;
  if normalized_login_name !~ '^[a-z0-9][a-z0-9_]{2,31}$' then
    raise exception 'child account name is invalid' using errcode = '22023';
  end if;
  if target_profile_id is null or not exists (select 1 from auth.users where id = target_profile_id) then
    raise exception 'child auth account was not created' using errcode = '22023';
  end if;
  if exists (select 1 from public.child_profiles where login_name = normalized_login_name) then
    raise exception 'child account name is already in use' using errcode = '23505';
  end if;

  insert into public.profiles (id, display_name)
  values (target_profile_id, trim(child_name))
  on conflict (id) do update set display_name = excluded.display_name;

  insert into public.family_members (family_id, profile_id, role)
  values (target_family_id, target_profile_id, 'child');

  insert into public.child_profiles (family_id, profile_id, display_name, login_name)
  values (target_family_id, target_profile_id, trim(child_name), normalized_login_name)
  returning * into child_row;

  return child_row;
end;
$$;

revoke all on function public.provision_child_account(uuid, text, text, uuid) from public, anon;
grant execute on function public.provision_child_account(uuid, text, text, uuid) to authenticated;

revoke all on function public.create_child_profile(uuid, text, text) from public, anon, authenticated;
revoke all on function public.update_child_password(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.authenticate_child(text) from public, anon, authenticated;;
