-- Child-created general adventures may begin immediately. Completion still
-- goes through submit_adventure_completion and the existing parent review RPC
-- before any points are awarded.

create or replace function private.enforce_task_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if new.origin = 'child_proposed' then
      if new.status <> 'todo'
         or new.adventure_type <> 'general'
         or new.confirmed_at is null
         or new.confirmed_by is distinct from (select auth.uid())
         or new.submitted_at is not null
         or new.completed_at is not null
         or new.reviewed_at is not null
         or new.reviewed_by is not null
         or new.approved_points is not null
         or new.parent_feedback_text is not null
         or new.parent_correction_text is not null
         or new.feedback_tone is not null
         or new.revision_note is not null
         or new.due_time is null
         or new.end_time is null
         or new.end_time <= new.due_time then
        raise exception 'child-created general adventures must be ready to execute and await parent completion review' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  if old.status = 'completed' then
    raise exception 'completed tasks cannot be changed' using errcode = '42501';
  end if;

  if private.is_child_owner(old.family_id, old.child_profile_id)
     and not private.is_family_parent(old.family_id) then
    if old.status not in ('todo', 'revision_requested')
       or new.id <> old.id
       or new.family_id <> old.family_id
       or new.child_profile_id <> old.child_profile_id
       or new.template_id is distinct from old.template_id
       or new.name <> old.name
       or new.points <> old.points
       or new.icon <> old.icon
       or new.duration_minutes is distinct from old.duration_minutes
       or new.is_daily <> old.is_daily
       or new.due_on is distinct from old.due_on
       or new.due_time is distinct from old.due_time
       or new.end_time is distinct from old.end_time
       or new.category is distinct from old.category
       or new.origin is distinct from old.origin
       or new.original_name is distinct from old.original_name
       or new.original_points is distinct from old.original_points
       or new.confirmed_at is distinct from old.confirmed_at
       or new.confirmed_by is distinct from old.confirmed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.reviewed_by is distinct from old.reviewed_by
       or new.approved_points is distinct from old.approved_points
       or new.parent_feedback_text is distinct from old.parent_feedback_text
       or new.parent_correction_text is distinct from old.parent_correction_text
       or new.feedback_tone is distinct from old.feedback_tone
       or new.revision_note is distinct from old.revision_note
       or new.status <> 'pending'
       or new.submitted_at is null
       or new.completed_at is null then
      raise exception 'children may only submit their own confirmed adventure completion' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- Bring adventures created by the previous proposal-only RPC into the new
-- immediately executable flow. Returned proposals stay untouched so a child
-- still has to address the parent's requested revision.
update public.tasks as task
set status = 'todo',
    confirmed_at = coalesce(task.confirmed_at, timezone('utc', now())),
    confirmed_by = coalesce(task.confirmed_by, child.profile_id),
    updated_at = timezone('utc', now())
from public.child_profiles as child
where child.id = task.child_profile_id
  and child.family_id = task.family_id
  and task.origin = 'child_proposed'
  and task.adventure_type = 'general'
  and task.status = 'proposed';

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
    'quick', false, 'Asia/Taipei',
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
