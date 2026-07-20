-- Bootstrap a family for a legitimate parent account in one privileged,
-- authenticated operation. This avoids a client-side families insert being
-- rejected by RLS between profile and membership setup.

create or replace function public.ensure_parent_family()
returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := (select auth.uid());
  existing_family_id uuid;
  created_family_id uuid;
  parent_name text;
begin
  if current_user_id is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'parent authentication required' using errcode = '42501';
  end if;

  select m.family_id into existing_family_id
    from public.family_members m
   where m.profile_id = current_user_id and m.role = 'parent'
   order by m.created_at
   limit 1;
  if existing_family_id is not null then
    return existing_family_id;
  end if;

  select p.display_name into parent_name from public.profiles p where p.id = current_user_id;
  if parent_name is null or parent_name = '' then
    parent_name := left(current_user_id::text, 8);
  end if;

  insert into public.profiles (id, display_name)
  values (current_user_id, parent_name)
  on conflict (id) do nothing;

  insert into public.families (name, created_by)
  values (parent_name || ' 的家庭', current_user_id)
  returning id into created_family_id;

  insert into public.family_members (family_id, profile_id, role)
  values (created_family_id, current_user_id, 'parent');
  return created_family_id;
end;
$$;

revoke all on function public.ensure_parent_family() from public, anon;
grant execute on function public.ensure_parent_family() to authenticated;
