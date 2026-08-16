-- The child dashboard is also used by a family parent in child preview mode.
-- Keep the same task restrictions, but allow that authenticated parent to
-- perform the selected child's abandonment action without changing sessions.

create or replace function public.abandon_child_adventure(target_task_id uuid)
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
   where id = target_task_id
   for update;

  if not found
     or not (
       private.is_child_owner(task_row.family_id, task_row.child_profile_id)
       or private.is_family_parent(task_row.family_id)
     ) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;

  if not (
    task_row.origin = 'child_proposed'
    and task_row.adventure_type = 'general'
    and task_row.status in ('proposed', 'proposal_revision_requested', 'todo')
    and task_row.submitted_at is null
    and task_row.cancelled_at is null
    and not exists (
      select 1
        from public.adventure_timer_sessions timer
       where timer.task_id = task_row.id
    )
  ) then
    raise exception 'only an unstarted child-proposed general adventure can be abandoned' using errcode = '22023';
  end if;

  update public.tasks
     set status = 'cancelled',
         cancelled_at = timezone('utc', now()),
         cancelled_by = 'child',
         updated_at = timezone('utc', now())
   where id = task_row.id
   returning * into task_row;

  return task_row;
end;
$$;

revoke all on function public.abandon_child_adventure(uuid) from public, anon;
grant execute on function public.abandon_child_adventure(uuid) to authenticated;
