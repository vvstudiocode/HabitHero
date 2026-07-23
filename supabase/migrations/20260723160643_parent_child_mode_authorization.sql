-- Allow the authenticated family parent to operate the selected child from a
-- shared device without replacing the parent session with a child session.

create or replace function public.propose_child_goal(
  target_family_id uuid,
  target_child_profile_id uuid,
  goal_name text,
  goal_points integer,
  goal_icon text,
  goal_category text,
  goal_duration_minutes integer default null,
  goal_due_on date default null,
  goal_due_time time default null
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
  if goal_due_time is null then
    raise exception 'goal due time is required' using errcode = '22023';
  end if;

  insert into public.tasks (
    family_id, child_profile_id, name, points, status, icon,
    duration_minutes, due_on, due_time, category, origin,
    original_name, original_points
  )
  values (
    target_family_id, target_child_profile_id, normalized_name, goal_points,
    'todo', normalized_icon, goal_duration_minutes,
    coalesce(goal_due_on, current_date), goal_due_time,
    private.validate_task_category(goal_category), 'child_proposed',
    normalized_name, goal_points
  )
  returning * into task_row;

  return task_row;
end;
$$;

create or replace function public.submit_task_reflection(
  target_task_id uuid,
  reflection text,
  mood text,
  difficulty smallint
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
  normalized_reflection text := trim(reflection);
  submitted_time timestamptz := timezone('utc', now());
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if normalized_reflection is null or char_length(normalized_reflection) not between 1 and 2000 then
    raise exception 'reflection is invalid' using errcode = '22023';
  end if;
  if mood is not null and mood not in ('proud', 'happy', 'calm', 'okay', 'tired', 'frustrated') then
    raise exception 'mood is invalid' using errcode = '22023';
  end if;
  if difficulty is null or difficulty not between 1 and 5 then
    raise exception 'difficulty is invalid' using errcode = '22023';
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
  if task_row.status not in ('todo', 'revision_requested') then
    raise exception 'task is not ready for child submission' using errcode = '22023';
  end if;
  if not private.is_family_parent(task_row.family_id)
     and not private.is_task_execution_time_reached(task_row.due_time) then
    raise exception 'task execution time has not started' using errcode = '22023';
  end if;

  update public.tasks
     set status = 'pending',
         submitted_at = submitted_time,
         completed_at = submitted_time,
         child_reflection_text = normalized_reflection,
         child_mood = mood,
         child_difficulty = difficulty
   where id = task_row.id
   returning * into task_row;

  return task_row;
end;
$$;

drop policy if exists wishlist_insert on public.wishlist_items;
create policy wishlist_insert on public.wishlist_items
  for insert to authenticated
  with check (
    private.is_family_parent(family_id)
    or private.is_child_owner(family_id, child_profile_id)
  );

revoke all on function public.propose_child_goal(uuid, uuid, text, integer, text, text, integer, date, time) from public, anon;
grant execute on function public.propose_child_goal(uuid, uuid, text, integer, text, text, integer, date, time) to authenticated;
revoke all on function public.submit_task_reflection(uuid, text, text, smallint) from public, anon;
grant execute on function public.submit_task_reflection(uuid, text, text, smallint) to authenticated;
