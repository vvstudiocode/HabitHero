create or replace function public.provision_existing_child_account(
  target_family_id uuid,
  target_child_profile_id uuid,
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
  if target_profile_id is null or not exists (select 1 from auth.users where id = target_profile_id) then
    raise exception 'child auth account was not created' using errcode = '22023';
  end if;
  if normalized_login_name !~ '^[a-z0-9][a-z0-9_]{2,31}$' then
    raise exception 'child account name is invalid' using errcode = '22023';
  end if;
  if exists (select 1 from public.child_profiles where login_name = normalized_login_name) then
    raise exception 'child account name is already in use' using errcode = '23505';
  end if;

  select * into child_row
    from public.child_profiles
   where id = target_child_profile_id
     and family_id = target_family_id
   for update;
  if not found or child_row.profile_id is not null then
    raise exception 'child already has an account or was not found' using errcode = '23505';
  end if;

  insert into public.profiles (id, display_name)
  values (target_profile_id, child_row.display_name)
  on conflict (id) do update set display_name = excluded.display_name;
  insert into public.family_members (family_id, profile_id, role)
  values (target_family_id, target_profile_id, 'child');
  update public.child_profiles
     set profile_id = target_profile_id, login_name = normalized_login_name
   where id = target_child_profile_id
  returning * into child_row;
  return child_row;
end;
$$;

revoke all on function public.provision_existing_child_account(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.provision_existing_child_account(uuid, uuid, text, uuid) to authenticated;;
