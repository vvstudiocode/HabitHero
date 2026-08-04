-- A child goal with an explicit duration is a timed adventure. Keep the
-- server-side timer gate aligned with the child detail UI.

update public.tasks as task
set requires_timer = true,
    updated_at = timezone('utc', now())
where task.origin = 'child_proposed'
  and task.adventure_type = 'general'
  and task.duration_minutes is not null
  and not task.requires_timer;

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
  group_row public.adventure_groups;
  normalized_name text := trim(goal_name);
  normalized_icon text := coalesce(nullif(trim(goal_icon), ''), 'Target');
begin
  if (select auth.uid()) is null
     or not (
       private.is_child_owner(target_family_id, target_child_profile_id)
       or private.is_family_parent(target_family_id)
     ) then
    raise exception 'child adventure not found or not authorized' using errcode = '42501';
  end if;
  if normalized_name is null or char_length(normalized_name) not between 1 and 120
     or goal_points is null or goal_points < 0
     or char_length(normalized_icon) not between 1 and 32
     or goal_category not in ('life_habit', 'learning', 'health', 'relationship', 'family_contribution', 'creativity')
     or (goal_duration_minutes is not null and goal_duration_minutes not between 1 and 1440)
     or goal_due_time is null
     or goal_end_time is null
     or goal_end_time <= goal_due_time then
    raise exception 'general adventure details are invalid' using errcode = '22023';
  end if;

  group_row := private.ensure_active_general_group(target_family_id, target_child_profile_id);

  insert into public.tasks (
    family_id, child_profile_id, name, points, status, icon, duration_minutes,
    is_daily, due_on, due_time, end_time, category, origin, original_name,
    original_points, adventure_type, adventure_group_id, occurrence_date,
    completion_report_mode, requires_timer, execution_timezone,
    confirmed_at, confirmed_by
  ) values (
    target_family_id, target_child_profile_id, normalized_name, goal_points,
    'todo', normalized_icon, goal_duration_minutes, false,
    coalesce(goal_due_on, (timezone('Asia/Taipei', now()))::date),
    goal_due_time, goal_end_time, goal_category, 'child_proposed',
    normalized_name, goal_points, 'general', group_row.id,
    coalesce(goal_due_on, (timezone('Asia/Taipei', now()))::date),
    'quick', goal_duration_minutes is not null, 'Asia/Taipei',
    timezone('utc', now()), (select auth.uid())
  )
  returning * into task_row;

  return task_row;
end;
$$;

revoke all on function public.propose_child_goal(
  uuid, uuid, text, integer, text, text, integer, date, time, time
) from public, anon;
grant execute on function public.propose_child_goal(
  uuid, uuid, text, integer, text, text, integer, date, time, time
) to authenticated;
