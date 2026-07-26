alter table public.tasks
  add column if not exists end_time time;

create or replace function private.is_task_execution_window_open(
  target_start_time time,
  target_end_time time
)
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  select (target_start_time is null or (timezone('Asia/Taipei', now()))::time >= target_start_time)
     and (target_end_time is null or (timezone('Asia/Taipei', now()))::time < target_end_time);
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
     and not private.is_task_execution_window_open(old.due_time, old.end_time) then
    raise exception 'task execution window has ended' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_end_time_guard on public.tasks;
create trigger tasks_end_time_guard
  before insert or update on public.tasks
  for each row execute function private.enforce_task_end_time();

drop function if exists public.propose_child_goal(uuid, uuid, text, integer, text, text, integer, date, time);

create function public.propose_child_goal(
  target_family_id uuid,
  target_child_profile_id uuid,
  goal_name text,
  goal_points integer,
  goal_icon text,
  goal_category text,
  goal_duration_minutes integer default null,
  goal_due_on date default null,
  goal_due_time time default null,
  goal_end_time time default null
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
  normalized_name text := trim(goal_name);
  normalized_icon text := coalesce(nullif(trim(goal_icon), ''), 'Target');
begin
  if (select auth.uid()) is null or not private.is_child_owner(target_family_id, target_child_profile_id) then
    raise exception 'child goal not found or not authorized' using errcode = '42501';
  end if;
  if normalized_name is null or char_length(normalized_name) not between 1 and 120 then
    raise exception 'goal name is invalid' using errcode = '22023';
  end if;
  if goal_points is null or goal_points <= 0 then
    raise exception 'goal points must be positive' using errcode = '22023';
  end if;
  if char_length(normalized_icon) not between 1 and 32 then
    raise exception 'goal icon is invalid' using errcode = '22023';
  end if;
  if goal_duration_minutes is not null and goal_duration_minutes not between 1 and 1440 then
    raise exception 'goal duration is invalid' using errcode = '22023';
  end if;
  if goal_due_time is null or goal_end_time is null or goal_end_time <= goal_due_time then
    raise exception 'goal execution window is invalid' using errcode = '22023';
  end if;

  insert into public.tasks (
    family_id, child_profile_id, name, points, status, icon, duration_minutes,
    due_on, due_time, end_time, category, origin, original_name, original_points
  ) values (
    target_family_id, target_child_profile_id, normalized_name, goal_points, 'todo',
    normalized_icon, goal_duration_minutes, coalesce(goal_due_on, current_date),
    goal_due_time, goal_end_time, private.validate_task_category(goal_category),
    'child_proposed', normalized_name, goal_points
  ) returning * into task_row;
  return task_row;
end;
$$;

grant execute on function public.propose_child_goal(uuid, uuid, text, integer, text, text, integer, date, time, time) to authenticated;
