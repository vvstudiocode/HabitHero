-- Harden parent authorization without changing the child anonymous-session flow.
-- SECURITY DEFINER is retained only where the RPC must perform privileged,
-- atomic writes across RLS-protected tables.

-- Anonymous users use the authenticated Postgres role in Supabase. Parent-only
-- checks must therefore reject anonymous sessions explicitly.
create or replace function private.is_family_parent(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
    and exists (
      select 1
      from public.family_members m
      where m.family_id = target_family_id
        and m.profile_id = (select auth.uid())
        and m.role = 'parent'
    );
$$;

revoke all on function private.is_family_parent(uuid) from public, anon;
grant execute on function private.is_family_parent(uuid) to authenticated;

-- The previous predicate compared m.family_id with itself, so it was always
-- true and did not require the child membership to belong to this family.
drop policy if exists child_profiles_insert on public.child_profiles;

create policy child_profiles_insert
on public.child_profiles
for insert
to authenticated
with check (
  private.is_family_parent(family_id)
  and (
    profile_id is null
    or exists (
      select 1
      from public.family_members m
      where m.family_id = child_profiles.family_id
        and m.profile_id = child_profiles.profile_id
        and m.role = 'child'
    )
  )
);

-- Keep this compatibility wrapper, but enforce authentication and parent
-- authorization before delegating to the review RPC.
create or replace function public.approve_task_completion(target_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into task_row
    from public.tasks
   where id = target_task_id;

  if not found or not private.is_family_parent(task_row.family_id) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;

  return public.review_task_completion(
    target_task_id,
    true,
    task_row.points,
    'task approved',
    null,
    'encouraging',
    null
  );
end;
$$;

revoke all on function public.approve_task_completion(uuid) from public, anon;
grant execute on function public.approve_task_completion(uuid) to authenticated;

