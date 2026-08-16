-- Let children abandon only their own, unsubmitted general adventures.
-- Keep the task row so parents can see the history and why it left the board.

alter table public.tasks
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text;

alter table public.tasks
  drop constraint if exists tasks_status_check,
  drop constraint if exists tasks_growth_status_timing_check,
  drop constraint if exists tasks_cancelled_by_check;

alter table public.tasks
  add constraint tasks_status_check
    check (status in ('proposed', 'proposal_revision_requested', 'todo', 'pending', 'revision_requested', 'completed', 'cancelled')),
  add constraint tasks_cancelled_by_check
    check (cancelled_by is null or cancelled_by in ('child', 'parent')),
  add constraint tasks_growth_status_timing_check
    check (
      (status in ('proposed', 'todo') and completed_at is null and submitted_at is null and reviewed_at is null and cancelled_at is null and cancelled_by is null)
      or (status = 'proposal_revision_requested' and completed_at is null and submitted_at is null and reviewed_at is not null and revision_note is not null and cancelled_at is null and cancelled_by is null)
      or (status = 'pending' and submitted_at is not null and cancelled_at is null and cancelled_by is null)
      or (status = 'revision_requested' and reviewed_at is not null and revision_note is not null and cancelled_at is null and cancelled_by is null)
      or (status = 'completed' and completed_at is not null and submitted_at is not null and reviewed_at is not null and cancelled_at is null and cancelled_by is null)
      or (status = 'cancelled' and cancelled_at is not null and cancelled_by is not null and submitted_at is null and reviewed_at is null and completed_at is null)
    );

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
     or not private.is_child_owner(task_row.family_id, task_row.child_profile_id) then
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
