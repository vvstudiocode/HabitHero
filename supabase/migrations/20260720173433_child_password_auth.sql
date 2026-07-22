-- Child login uses a password only. Anonymous Auth supplies a short-lived
-- authenticated session; this migration binds that session to one child row.

alter table public.child_profiles
  alter column profile_id drop not null;

alter table public.child_profiles
  add column if not exists display_name text;

update public.child_profiles
   set display_name = coalesce(display_name, '小孩');

alter table public.child_profiles
  alter column display_name set not null;

create table if not exists private.child_passwords (
  child_profile_id uuid primary key references public.child_profiles(id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table private.child_passwords enable row level security;
revoke all on table private.child_passwords from public, anon, authenticated;

create or replace function private.enforce_child_profile_membership()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if new.profile_id is not null and not exists (
    select 1 from public.family_members m
    where m.family_id = new.family_id and m.profile_id = new.profile_id and m.role = 'child'
  ) then
    raise exception 'child profile must reference a child family member' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.create_child_profile(
  target_family_id uuid,
  child_name text,
  child_password text
)
returns public.child_profiles
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  child_row public.child_profiles;
begin
  if (select auth.uid()) is null or not private.is_family_parent(target_family_id) then
    raise exception 'family not found or not authorized' using errcode = '42501';
  end if;
  if child_name is null or char_length(trim(child_name)) not between 1 and 80 then
    raise exception 'child name is invalid' using errcode = '22023';
  end if;
  if child_password is null or child_password !~ '^[A-Za-z0-9]{6,}$' then
    raise exception 'child password must be at least 6 alphanumeric characters' using errcode = '22023';
  end if;
  if exists (
    select 1
      from private.child_passwords cp
      join public.child_profiles c on c.id = cp.child_profile_id
     where crypt(child_password, cp.password_hash) = cp.password_hash
  ) then
    raise exception 'child password is already in use; choose another one' using errcode = '23505';
  end if;

  insert into public.child_profiles (family_id, profile_id, display_name)
  values (target_family_id, null, trim(child_name))
  returning * into child_row;

  insert into private.child_passwords (child_profile_id, password_hash)
  values (child_row.id, crypt(child_password, gen_salt('bf', 10)));
  return child_row;
end;
$$;

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
  if not exists (select 1 from public.child_profiles where id = target_child_profile_id and family_id = target_family_id) then
    raise exception 'child not found' using errcode = '42P01';
  end if;
  update private.child_passwords
     set password_hash = crypt(child_password, gen_salt('bf', 10)), updated_at = timezone('utc', now())
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
  existing_member public.family_members;
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

  -- A new anonymous session may be coming from another device. Detach the old
  -- anonymous profile without deleting the child record or its data.
  if matched_child.profile_id is not null and matched_child.profile_id <> current_user_id then
    delete from public.family_members where profile_id = matched_child.profile_id and family_id = matched_child.family_id;
    update public.child_profiles set profile_id = null where id = matched_child.id;
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

revoke all on function public.create_child_profile(uuid, text, text) from public, anon;
grant execute on function public.create_child_profile(uuid, text, text) to authenticated;
revoke all on function public.update_child_password(uuid, uuid, text) from public, anon;
grant execute on function public.update_child_password(uuid, uuid, text) to authenticated;
revoke all on function public.authenticate_child(text) from public, anon;
grant execute on function public.authenticate_child(text) to authenticated;

drop policy if exists child_profiles_insert on public.child_profiles;
create policy child_profiles_insert on public.child_profiles for insert to authenticated
  with check (private.is_family_parent(family_id) and (profile_id is null or exists (
    select 1 from public.family_members m where m.family_id = family_id and m.profile_id = child_profiles.profile_id and m.role = 'child'
  )));

drop policy if exists child_profiles_select on public.child_profiles;
create policy child_profiles_select on public.child_profiles for select to authenticated
  using (private.is_family_member(family_id) or private.is_family_parent(family_id));

revoke all on table public.child_profiles from authenticated;
grant select, insert, update, delete on table public.child_profiles to authenticated;

;
