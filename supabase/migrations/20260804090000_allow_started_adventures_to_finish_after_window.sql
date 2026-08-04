-- Treat end_time as the latest time an adventure may be started.
-- A timer that was started inside the window may finish and be submitted after it.

create or replace function private.adventure_execution_day_is_current(
  target_task public.tasks
)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select case
    when target_task.adventure_type = 'daily' then
      target_task.occurrence_date = (timezone(target_task.execution_timezone, now()))::date
    when target_task.due_on is not null then
      target_task.due_on = (timezone(target_task.execution_timezone, now()))::date
    else true
  end;
$$;

create or replace function private.adventure_timer_started_in_window(
  target_task public.tasks,
  target_timer public.adventure_timer_sessions
)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select target_timer.started_at is not null
    and private.adventure_execution_day_is_current(target_task)
    and (
      target_task.due_time is null
      or (timezone(target_task.execution_timezone, target_timer.started_at))::time >= target_task.due_time
    )
    and (
      target_task.end_time is null
      or (timezone(target_task.execution_timezone, target_timer.started_at))::time < target_task.end_time
    );
$$;

revoke all on function private.adventure_execution_day_is_current(public.tasks) from public, anon, authenticated;
revoke all on function private.adventure_timer_started_in_window(public.tasks, public.adventure_timer_sessions) from public, anon, authenticated;

create or replace function private.adventure_execution_is_open(task_row public.tasks)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select (
    (
      private.adventure_execution_day_is_current(task_row)
      and (
        task_row.due_time is null
        or (timezone(task_row.execution_timezone, now()))::time >= task_row.due_time
      )
      and (
        task_row.end_time is null
        or (timezone(task_row.execution_timezone, now()))::time < task_row.end_time
      )
    )
    or exists (
      select 1
        from public.adventure_timer_sessions timer
       where timer.task_id = task_row.id
         and private.adventure_timer_started_in_window(task_row, timer)
    )
  );
$$;

create or replace function private.enforce_task_end_time()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.due_time is not null and new.end_time is not null and new.end_time <= new.due_time then
    raise exception 'task end time must be after start time' using errcode = '22023';
  end if;

  if tg_op = 'INSERT' and new.origin = 'child_proposed' and new.end_time is null then
    raise exception 'child proposed goals must have an end time' using errcode = '22023';
  end if;

  if tg_op = 'UPDATE'
     and private.is_child_owner(old.family_id, old.child_profile_id)
     and old.status in ('todo', 'revision_requested')
     and new.status = 'pending'
     and not private.adventure_execution_is_open(old) then
    raise exception 'task execution window has ended' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_end_time_guard on public.tasks;
create trigger tasks_end_time_guard
  before insert or update on public.tasks
  for each row execute function private.enforce_task_end_time();
