-- The output column family_id is also visible inside PL/pgSQL statements.
-- Referencing it in ON CONFLICT makes PostgreSQL report an ambiguous column.
-- Use the named unique constraint so child login can complete its binding.

create or replace function public.authenticate_child(child_password text)
returns table (family_id uuid, child_profile_id uuid)
language plpgsql security definer
set search_path = extensions, pg_catalog, public
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
   where extensions.crypt(child_password, cp.password_hash) = cp.password_hash
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
  on conflict on constraint family_members_family_id_profile_id_key
  do update set role = 'child';

  update public.child_profiles
     set profile_id = current_user_id
   where id = matched_child.id;

  return query select matched_child.family_id, matched_child.id;
end;
$$;

revoke all on function public.authenticate_child(text) from public;
grant execute on function public.authenticate_child(text) to anon, authenticated;
