-- Keep child goal proposals available in parent child-mode after the
-- execution-time RPC was redefined without the parent authorization branch.
create or replace function public.propose_child_goal(
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
  if (select auth.uid()) is null
     or not (
       private.is_child_owner(target_family_id, target_child_profile_id)
       or private.is_family_parent(target_family_id)
     ) then
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

revoke all on function public.propose_child_goal(uuid, uuid, text, integer, text, text, integer, date, time, time) from public, anon;
grant execute on function public.propose_child_goal(uuid, uuid, text, integer, text, text, integer, date, time, time) to authenticated;
