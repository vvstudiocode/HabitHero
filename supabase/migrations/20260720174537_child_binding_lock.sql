-- A child password identifies one child and must not silently move the child
-- to another anonymous device. Only an explicit parent password reset may
-- release the existing device binding.

create or replace function public.update_child_password(
  target_family_id uuid,
  target_child_profile_id uuid,
  child_password text
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if (select auth.uid()) is null or not private.is_family_parent(target_family_id) then
    raise exception 'family not found or not authorized' using errcode = '42501';
  end if;
  if child_password is null or child_password !~ '^[A-Za-z0-9]{6,}$' then
    raise exception 'child password must be at least 6 alphanumeric characters' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.child_profiles
    where id = target_child_profile_id and family_id = target_family_id
  ) then
    raise exception 'child not found' using errcode = '42P01';
  end if;
  if exists (
    select 1
      from private.child_passwords cp
      join public.child_profiles c on c.id = cp.child_profile_id
     where cp.child_profile_id <> target_child_profile_id
       and crypt(child_password, cp.password_hash) = cp.password_hash
  ) then
    raise exception 'child password is already in use; choose another one' using errcode = '23505';
  end if;

  -- Explicit parent reset releases the previous anonymous device binding.
  delete from public.family_members
   where family_id = target_family_id
     and profile_id = (select profile_id from public.child_profiles where id = target_child_profile_id)
     and role = 'child';
  update public.child_profiles
     set profile_id = null
   where id = target_child_profile_id;

  update private.child_passwords
     set password_hash = crypt(child_password, gen_salt('bf', 10)),
         updated_at = timezone('utc', now())
   where child_profile_id = target_child_profile_id;
end;
$$;

create or replace function public.authenticate_child(child_password text)
returns table (family_id uuid, child_profile_id uuid)
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  matched_child public.child_profiles;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true' then
    raise exception 'child authentication requires an anonymous session' using errcode = '42501';
  end if;
  if child_password is null or child_password !~ '^[A-Za-z0-9]{6,}$' then
    raise exception 'child password is invalid' using errcode = '42501';
  end if;

  select c.* into matched_child
    from private.child_passwords cp
    join public.child_profiles c on c.id = cp.child_profile_id
   where crypt(child_password, cp.password_hash) = cp.password_hash
   for update of cp, c;

  if not found then
    raise exception 'child password is incorrect' using errcode = '42501';
  end if;
  if exists (select 1 from public.family_members m where m.profile_id = current_user_id and m.role <> 'child') then
    raise exception 'session is already used by another role' using errcode = '42501';
  end if;
  if matched_child.profile_id is not null and matched_child.profile_id <> current_user_id then
    raise exception 'child is already bound; ask parent to reset the password' using errcode = '42501';
  end if;

  insert into public.profiles (id, display_name)
  values (current_user_id, matched_child.display_name)
  on conflict (id) do update set display_name = excluded.display_name;

  insert into public.family_members (family_id, profile_id, role)
  values (matched_child.family_id, current_user_id, 'child')
  on conflict (family_id, profile_id) do update set role = 'child';

  update public.child_profiles
     set profile_id = current_user_id
   where id = matched_child.id
   returning public.child_profiles.family_id, public.child_profiles.id into family_id, child_profile_id;
  return next;
end;
$$;

revoke all on function public.update_child_password(uuid, uuid, text) from public, anon;
grant execute on function public.update_child_password(uuid, uuid, text) to authenticated;
revoke all on function public.authenticate_child(text) from public, anon;
grant execute on function public.authenticate_child(text) to authenticated;
;
